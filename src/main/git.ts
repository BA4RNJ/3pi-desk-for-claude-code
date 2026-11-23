import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { GitDiffResult, GitFileChange, GitStatusSnapshot } from '../shared/types'

const execFileAsync = promisify(execFile)

const GIT_TIMEOUT_MS = 10_000
const GIT_MAX_BUFFER = 8 * 1024 * 1024
const DIFF_PREVIEW_LIMIT = 200_000

async function runGit(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return await execFileAsync('git', args, {
    cwd,
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: GIT_MAX_BUFFER,
    env: {
      ...process.env,
      GIT_OPTIONAL_LOCKS: '0'
    }
  })
}

export async function getGitStatus(cwd: string): Promise<GitStatusSnapshot> {
  if (!cwd || !cwd.trim()) {
    return { isRepo: false, files: [] }
  }
  try {
    const { stdout: statusOut } = await runGit(cwd, [
      'status',
      '--porcelain=v1',
      '-b',
      '-uall'
    ])
    const lines = statusOut.split(/\r?\n/).filter(Boolean)
    let branch: string | undefined
    const entries: Array<{ path: string; status: string; staged: boolean }> = []

    for (const line of lines) {
      if (line.startsWith('## ')) {
        const rawBranch = line.slice(3).trim()
        branch = rawBranch.split('...')[0]?.trim() || rawBranch
        continue
      }
      if (line.length < 4) continue
      const indexStatus = line[0]
      const workTreeStatus = line[1]
      let rawPath = line.slice(3).trim()
      if (rawPath.includes(' -> ')) {
        rawPath = rawPath.split(' -> ').pop()?.trim() || rawPath
      }
      if (rawPath.startsWith('"') && rawPath.endsWith('"')) {
        rawPath = rawPath.slice(1, -1)
      }
      const code = `${indexStatus}${workTreeStatus}`.trim() || 'M'
      const staged = indexStatus !== ' ' && indexStatus !== '?'
      entries.push({ path: rawPath, status: code, staged })
    }

    const statsMap = new Map<string, { additions: number; deletions: number }>()
    const collectNumstat = async (args: string[]): Promise<void> => {
      try {
        const { stdout } = await runGit(cwd, args)
        for (const row of stdout.split(/\r?\n/)) {
          if (!row.trim()) continue
          const parts = row.split('\t')
          if (parts.length < 3) continue
          const add = Number.parseInt(parts[0], 10)
          const del = Number.parseInt(parts[1], 10)
          let file = parts.slice(2).join('\t').trim()
          if (file.includes(' => ')) {
            file = file.replace(/\{[^}]* => ([^}]*)\}/g, '$1')
            if (file.includes(' => ')) file = file.split(' => ').pop()?.trim() || file
          }
          const prev = statsMap.get(file) || { additions: 0, deletions: 0 }
          statsMap.set(file, {
            additions: prev.additions + (Number.isFinite(add) ? add : 0),
            deletions: prev.deletions + (Number.isFinite(del) ? del : 0)
          })
        }
      } catch {
        // ignore numstat failure
      }
    }

    if (entries.length > 0) {
      await Promise.all([
        collectNumstat(['diff', '--numstat']),
        collectNumstat(['diff', '--cached', '--numstat'])
      ])
    }

    const files: GitFileChange[] = entries.map((item) => {
      const stat = statsMap.get(item.path)
      return {
        path: item.path,
        status: item.status,
        staged: item.staged,
        additions: stat?.additions,
        deletions: stat?.deletions
      }
    })

    return {
      isRepo: true,
      branch,
      files
    }
  } catch {
    return {
      isRepo: false,
      files: []
    }
  }
}

export async function getGitDiff(cwd: string, filePath?: string): Promise<GitDiffResult> {
  if (!cwd || !cwd.trim()) {
    return { path: filePath, before: '', after: '', patch: '' }
  }
  if (!filePath) {
    try {
      const { stdout } = await runGit(cwd, ['diff', 'HEAD'])
      return {
        before: '',
        after: '',
        patch: stdout.slice(0, DIFF_PREVIEW_LIMIT)
      }
    } catch {
      const { stdout } = await runGit(cwd, ['diff']).catch(() => ({ stdout: '' }))
      return {
        before: '',
        after: '',
        patch: stdout.slice(0, DIFF_PREVIEW_LIMIT)
      }
    }
  }

  let before = ''
  try {
    const { stdout } = await runGit(cwd, ['show', `HEAD:${filePath}`])
    before = stdout.slice(0, DIFF_PREVIEW_LIMIT)
  } catch {
    before = ''
  }

  let after = ''
  try {
    const raw = await readFile(join(cwd, filePath), 'utf8')
    after = raw.slice(0, DIFF_PREVIEW_LIMIT)
  } catch {
    after = ''
  }

  let patch = ''
  try {
    const { stdout } = await runGit(cwd, ['diff', 'HEAD', '--', filePath])
    patch = stdout.slice(0, DIFF_PREVIEW_LIMIT)
  } catch {
    const { stdout } = await runGit(cwd, ['diff', '--', filePath]).catch(() => ({ stdout: '' }))
    patch = stdout.slice(0, DIFF_PREVIEW_LIMIT)
  }

  return {
    path: filePath,
    before,
    after,
    patch
  }
}
