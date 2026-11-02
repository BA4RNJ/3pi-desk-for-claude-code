import { dialog } from 'electron'
import { promises as fs } from 'node:fs'
import { basename, relative } from 'node:path'
import type {
  Attachment,
  AttachmentFailure,
  AttachmentPickResult,
  FileContent,
  FileEntry,
  FileNode
} from '../shared/types'
import {
  DOCUMENT_TYPES,
  IMAGE_TYPES,
  MAX_DOCUMENT_BYTES,
  MAX_IMAGE_BYTES,
  TEXT_FULL_LIMIT_BYTES,
  TEXT_PREVIEW_LIMIT_BYTES,
  decodeTextBytes,
  extensionOf
} from '../shared/attachments'

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.cache',
  'dist',
  'build',
  'out',
  'release',
  '.venv',
  'venv',
  'target',
  '.next',
  '.nuxt',
  'coverage',
  '.idea',
  '.gradle',
  '.m2',
  '__pycache__'
])

const MAX_FILES = 8000
const MAX_RESULTS = 40

export async function searchFiles(cwd: string, query: string): Promise<FileEntry[]> {
  const needle = query.trim().toLowerCase()
  const results: Array<FileEntry & { score: number }> = []
  let visited = 0

  async function walk(directory: string, depth: number): Promise<void> {
    if (depth > 7 || visited >= MAX_FILES || results.length >= MAX_RESULTS * 4) return
    let entries
    try {
      entries = await fs.readdir(directory, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (visited >= MAX_FILES) return
      if (entry.name.startsWith('.') && entry.name !== '.claude') {
        if (entry.isDirectory()) continue
      }
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue
        await walk(`${directory}/${entry.name}`, depth + 1)
        continue
      }
      if (!entry.isFile()) continue
      visited += 1

      const absolute = `${directory}/${entry.name}`
      const relativePath = relative(cwd, absolute).split('\\').join('/')
      if (needle && !relativePath.toLowerCase().includes(needle)) continue

      const lowerName = entry.name.toLowerCase()
      let score = 0
      if (!needle) score = 1
      else if (lowerName === needle) score = 100
      else if (lowerName.startsWith(needle)) score = 80
      else if (relativePath.toLowerCase().startsWith(needle)) score = 70
      else if (lowerName.includes(needle)) score = 60
      else score = 40

      results.push({
        path: absolute,
        relativePath,
        name: entry.name,
        score
      })
    }
  }

  await walk(cwd, 0)
  results.sort((a, b) => b.score - a.score || a.relativePath.length - b.relativePath.length)
  return results.slice(0, MAX_RESULTS).map(({ score: _score, ...entry }) => entry)
}

async function readTextPreview(path: string, size: number): Promise<string | null> {
  const readSize = size > TEXT_FULL_LIMIT_BYTES ? TEXT_PREVIEW_LIMIT_BYTES : size
  if (readSize <= 0) return ''
  const handle = await fs.open(path, 'r')
  try {
    const buffer = Buffer.alloc(readSize)
    const { bytesRead } = await handle.read(buffer, 0, readSize, 0)
    return decodeTextBytes(buffer.subarray(0, bytesRead))
  } finally {
    await handle.close()
  }
}

/**
 * Read chosen files into attachments. Unsupported or oversized files are
 * reported to the renderer instead of being dropped silently.
 */
export async function readAttachments(paths: string[]): Promise<AttachmentPickResult> {
  const attachments: Attachment[] = []
  const errors: AttachmentFailure[] = []

  for (const path of paths) {
    const name = basename(path)
    try {
      const stat = await fs.stat(path)
      if (!stat.isFile()) {
        errors.push({ name, reason: 'unsupported' })
        continue
      }
      if (stat.size === 0) {
        errors.push({ name, reason: 'empty' })
        continue
      }

      const extension = extensionOf(path)
      const imageType = IMAGE_TYPES[extension]
      if (imageType) {
        if (stat.size > MAX_IMAGE_BYTES) {
          errors.push({ name, reason: 'too-large' })
          continue
        }
        const data = await fs.readFile(path)
        attachments.push({ kind: 'image', name, mediaType: imageType, data: data.toString('base64') })
        continue
      }

      const documentType = DOCUMENT_TYPES[extension]
      if (documentType) {
        if (stat.size > MAX_DOCUMENT_BYTES) {
          errors.push({ name, reason: 'too-large' })
          continue
        }
        const data = await fs.readFile(path)
        attachments.push({
          kind: 'document',
          name,
          mediaType: documentType,
          data: data.toString('base64')
        })
        continue
      }

      // SVG, source code, configs, CSV, logs, and other text-like files.
      const text = await readTextPreview(path, stat.size)
      if (text === null) {
        errors.push({ name, reason: 'unsupported' })
        continue
      }
      if (!text.trim()) {
        errors.push({ name, reason: 'empty' })
        continue
      }
      attachments.push({
        kind: 'text',
        name,
        text:
          stat.size > TEXT_FULL_LIMIT_BYTES
            ? `${text}\n\n… (file too large; truncated)`
            : text
      })
    } catch {
      errors.push({ name, reason: 'unreadable' })
    }
  }

  return { attachments, errors }
}

export async function pickAttachmentFiles(): Promise<AttachmentPickResult> {
  const result = await dialog.showOpenDialog({
    title: 'Choose files to attach',
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Images, PDF, and text files',
        extensions: [
          ...Object.keys(IMAGE_TYPES),
          ...Object.keys(DOCUMENT_TYPES),
          'svg',
          'txt',
          'md',
          'json',
          'jsonc',
          'yaml',
          'yml',
          'toml',
          'csv',
          'xml',
          'html',
          'css',
          'js',
          'jsx',
          'ts',
          'tsx',
          'py',
          'go',
          'rs',
          'java',
          'c',
          'cpp',
          'sh',
          'log'
        ]
      },
      { name: 'All files', extensions: ['*'] }
    ]
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { attachments: [], errors: [] }
  }
  return readAttachments(result.filePaths)
}

function isInside(cwd: string, target: string): boolean {
  const root = cwd.endsWith('/') ? cwd : `${cwd}/`
  return target === cwd || target.startsWith(root)
}

export async function fileTree(cwd: string): Promise<FileNode[]> {
  let budget = 600

  async function walk(directory: string, depth: number): Promise<FileNode[]> {
    if (depth > 4 || budget <= 0) return []
    let entries
    try {
      entries = await fs.readdir(directory, { withFileTypes: true })
    } catch {
      return []
    }
    const nodes: FileNode[] = []
    const sorted = entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    for (const entry of sorted) {
      if (budget <= 0) break
      if (entry.name.startsWith('.') && entry.name !== '.claude') continue
      if (IGNORED_DIRS.has(entry.name)) continue
      const absolute = `${directory}/${entry.name}`
      if (!isInside(cwd, absolute)) continue
      budget -= 1
      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: absolute,
          relativePath: relative(cwd, absolute).split('\\').join('/'),
          type: 'dir',
          children: await walk(absolute, depth + 1)
        })
      } else if (entry.isFile()) {
        nodes.push({
          name: entry.name,
          path: absolute,
          relativePath: relative(cwd, absolute).split('\\').join('/'),
          type: 'file'
        })
      }
    }
    return nodes
  }

  return walk(cwd, 0)
}

export async function readFileContent(cwd: string, path: string): Promise<FileContent> {
  const target = path.startsWith('/') ? path : `${cwd}/${path}`
  if (!isInside(cwd, target)) throw new Error('You can only open files inside the current workspace.')
  const stat = await fs.stat(target)
  if (!stat.isFile()) throw new Error('Not a file.')
  const extension = extensionOf(target)
  const mediaType = IMAGE_TYPES[extension]
  if (mediaType) {
    if (stat.size > 15 * 1024 * 1024) throw new Error('Image is too large (15 MB limit).')
    const data = await fs.readFile(target)
    return {
      kind: 'image',
      path: target,
      dataUrl: `data:${mediaType};base64,${data.toString('base64')}`,
      size: stat.size,
      mimeType: mediaType
    }
  }
  const limit = 1024 * 1024
  const handle = await fs.open(target, 'r')
  try {
    const buffer = Buffer.alloc(Math.min(stat.size, limit))
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    const text = decodeTextBytes(buffer.subarray(0, bytesRead))
    if (text !== null) {
      return {
        kind: 'text',
        path: target,
        text: text + (stat.size > limit ? '\n\n… (file too large; truncated)' : ''),
        size: stat.size
      }
    }
  } finally {
    await handle.close()
  }
  return { kind: 'binary', path: target, size: stat.size }
}

export async function writeFileContent(
  cwd: string,
  path: string,
  text: string
): Promise<void> {
  const target = path.startsWith('/') ? path : `${cwd}/${path}`
  if (!isInside(cwd, target)) throw new Error('You can only modify files inside the current workspace.')
  await fs.writeFile(target, text, 'utf8')
}
