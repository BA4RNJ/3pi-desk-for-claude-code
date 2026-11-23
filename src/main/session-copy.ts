import { constants as fsConstants, promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { forkSession } from '@anthropic-ai/claude-agent-sdk'

function projectsRoot(): string {
  return join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'projects')
}

/**
 * Claude Code stores transcripts under a path where every non-alphanumeric
 * character is replaced by '-'. Keep this in sync with the CLI; a mismatch
 * would make the copied session invisible to `listSessions()`.
 */
export function encodeProjectDir(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-')
}

function rewriteCwd(value: unknown, cwd: string): unknown {
  if (Array.isArray(value)) return value.map((item) => rewriteCwd(item, cwd))
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  for (const [key, item] of Object.entries(record)) {
    if (key === 'cwd' && typeof item === 'string') {
      record[key] = cwd
    } else {
      record[key] = rewriteCwd(item, cwd)
    }
  }
  return record
}

async function findForkFile(sessionId: string): Promise<string | null> {
  let entries
  try {
    entries = await fs.readdir(projectsRoot(), { withFileTypes: true })
  } catch {
    return null
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const candidate = join(projectsRoot(), entry.name, `${sessionId}.jsonl`)
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // keep looking
    }
  }
  return null
}

/**
 * Copy a transcript into another workspace. The Agent SDK's `forkSession`
 * only accepts a source directory, so for a cross-workspace copy we fork in
 * the source project, rewrite cwd fields, and move the new transcript into the
 * target project directory.
 */
export async function copySessionToWorkspace(
  sessionId: string,
  sourceCwd: string,
  targetCwd: string
): Promise<string> {
  if (!sourceCwd.trim() || !targetCwd.trim()) {
    throw new Error('Source and target workspace are required.')
  }
  const forked = await forkSession(sessionId, { dir: sourceCwd })
  if (encodeProjectDir(sourceCwd) === encodeProjectDir(targetCwd)) {
    return forked.sessionId
  }

  const sourceFile = await findForkFile(forked.sessionId)
  if (!sourceFile) {
    throw new Error('The forked transcript could not be found.')
  }

  const targetDir = join(projectsRoot(), encodeProjectDir(targetCwd))
  await fs.mkdir(targetDir, { recursive: true })
  const targetFile = join(targetDir, `${forked.sessionId}.jsonl`)
  let moved = false
  try {
    const text = await fs.readFile(sourceFile, 'utf8')
    const lines = text
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.stringify(rewriteCwd(JSON.parse(line), targetCwd))
        } catch {
          return line
        }
      })
    await fs.writeFile(targetFile, `${lines.join('\n')}\n`, { mode: 0o600 })
    moved = true
  } finally {
    // The intermediate fork belongs to the source project; remove only the
    // file we just created, never the user's original transcript.
    if (moved) await fs.unlink(sourceFile).catch(() => undefined)
  }
  return forked.sessionId
}

export interface ProjectRelocation {
  /** Top-level session transcripts copied into the new project. */
  sessions: number
  /** Other files copied (memory, subagent transcripts, tool results). */
  files: number
  /** Files left untouched because the target already existed. */
  skipped: number
}

function rewriteTranscriptLines(text: string, cwd: string): string {
  return text
    .split('\n')
    .map((line) => {
      if (!line.trim()) return line
      try {
        return JSON.stringify(rewriteCwd(JSON.parse(line), cwd))
      } catch {
        return line
      }
    })
    .join('\n')
}

async function writeExclusive(path: string, text: string): Promise<boolean> {
  try {
    await fs.writeFile(path, text, { mode: 0o600, flag: 'wx' })
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false
    throw error
  }
}

async function copyExclusive(source: string, target: string): Promise<boolean> {
  try {
    await fs.copyFile(source, target, fsConstants.COPYFILE_EXCL)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false
    throw error
  }
}

async function relocateDir(
  sourceDir: string,
  targetDir: string,
  newCwd: string,
  relativePath: string,
  result: ProjectRelocation
): Promise<void> {
  let entries
  try {
    entries = await fs.readdir(sourceDir, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry.name)
    const relPath = relativePath ? join(relativePath, entry.name) : entry.name
    const targetPath = join(targetDir, relPath)
    if (entry.isDirectory()) {
      await fs.mkdir(targetPath, { recursive: true })
      await relocateDir(sourcePath, targetDir, newCwd, relPath, result)
      continue
    }
    if (!entry.isFile()) continue
    await fs.mkdir(dirname(targetPath), { recursive: true })
    if (entry.name.endsWith('.jsonl')) {
      const text = await fs.readFile(sourcePath, 'utf8')
      const copied = await writeExclusive(
        targetPath,
        rewriteTranscriptLines(text, newCwd)
      )
      if (!copied) {
        result.skipped += 1
      } else if (relativePath) {
        result.files += 1
      } else {
        result.sessions += 1
      }
      continue
    }
    if (await copyExclusive(sourcePath, targetPath)) result.files += 1
    else result.skipped += 1
  }
}

/**
 * Make a renamed/moved project's transcripts usable under its new path.
 *
 * Claude Code keys transcripts by the absolute cwd, so after renaming a
 * folder its sessions live under the old encoded directory and every `cwd`
 * field points at the old path. Copy (never move) them into the new project
 * directory with `cwd` rewritten; the originals stay on disk.
 */
export async function relocateProjectTranscripts(
  oldCwd: string,
  newCwd: string
): Promise<ProjectRelocation> {
  const result: ProjectRelocation = { sessions: 0, files: 0, skipped: 0 }
  if (!oldCwd.trim() || !newCwd.trim()) return result
  const sourceDir = join(projectsRoot(), encodeProjectDir(oldCwd))
  const targetDir = join(projectsRoot(), encodeProjectDir(newCwd))
  if (sourceDir === targetDir) return result
  await fs.mkdir(targetDir, { recursive: true })
  await relocateDir(sourceDir, targetDir, newCwd, '', result)
  return result
}
