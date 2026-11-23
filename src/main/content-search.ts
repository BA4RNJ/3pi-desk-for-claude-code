import { promises as fs } from 'node:fs'
import { relative } from 'node:path'
import type { ContentSearchMatch } from '../shared/types'

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.cache',
  'dist',
  'build',
  'out',
  'release',
  'release-wsl',
  '.venv',
  'venv',
  'target',
  '.next',
  '.nuxt',
  'coverage',
  '.idea',
  '.gradle',
  '.m2',
  '__pycache__',
  '.turbo',
  '.parcel-cache'
])

const MAX_FILES = 6000
const MAX_MATCHES = 200
const MAX_FILE_BYTES = 1024 * 1024
const MAX_DEPTH = 14
const PREVIEW_LIMIT = 240

export interface ContentSearchOptions {
  limit?: number
  maxFileBytes?: number
}

function relativePath(cwd: string, path: string): string {
  return relative(cwd, path).split('\\').join('/')
}

function preview(line: string): string {
  const trimmed = line.trim()
  return trimmed.length > PREVIEW_LIMIT ? `${trimmed.slice(0, PREVIEW_LIMIT)}…` : trimmed
}

function decodeSearchText(buffer: Buffer): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return null
  }
}

/**
 * Case-insensitive text search over the workspace. It is intentionally
 * bounded: large repositories return the first N matches instead of walking
 * forever or loading binary/large files.
 */
export async function searchContent(
  cwd: string,
  query: string,
  options: ContentSearchOptions = {}
): Promise<ContentSearchMatch[]> {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  const limit = Math.min(1000, Math.max(1, options.limit ?? MAX_MATCHES))
  const maxFileBytes = Math.max(1, options.maxFileBytes ?? MAX_FILE_BYTES)
  const matches: ContentSearchMatch[] = []
  let visited = 0

  async function walk(directory: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH || visited >= MAX_FILES || matches.length >= limit) return
    let entries
    try {
      entries = await fs.readdir(directory, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (visited >= MAX_FILES || matches.length >= limit) return
      if (entry.isSymbolicLink()) continue
      const absolute = `${directory}/${entry.name}`
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') && entry.name !== '.claude') continue
        if (IGNORED_DIRS.has(entry.name)) continue
        await walk(absolute, depth + 1)
        continue
      }
      if (!entry.isFile()) continue
      if (entry.name.startsWith('.')) continue
      visited += 1

      let stat
      try {
        stat = await fs.stat(absolute)
      } catch {
        continue
      }
      if (!stat.isFile() || stat.size === 0 || stat.size > maxFileBytes) continue

      let text: string | null = null
      try {
        const buffer = await fs.readFile(absolute)
        if (buffer.subarray(0, 4096).includes(0)) continue
        text = decodeSearchText(buffer)
      } catch {
        continue
      }
      if (text === null) continue

      const lines = text.split(/\r?\n/)
      for (let index = 0; index < lines.length; index += 1) {
        const lineText = lines[index]
        const column = lineText.toLowerCase().indexOf(needle)
        if (column === -1) continue
        matches.push({
          path: absolute,
          relativePath: relativePath(cwd, absolute),
          line: index + 1,
          column: column + 1,
          preview: preview(lineText)
        })
        if (matches.length >= limit) return
      }
    }
  }

  await walk(cwd, 0)
  return matches
}
