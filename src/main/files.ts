import { dialog } from 'electron'
import { promises as fs } from 'node:fs'
import { basename, relative } from 'node:path'
import type { Attachment, FileContent, FileEntry, FileNode } from '../shared/types'

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

const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp'
}

const DOCUMENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf'
}

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'mdx',
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'json',
  'jsonc',
  'yaml',
  'yml',
  'toml',
  'ini',
  'conf',
  'cfg',
  'py',
  'go',
  'rs',
  'java',
  'kt',
  'c',
  'h',
  'cpp',
  'hpp',
  'cs',
  'rb',
  'php',
  'swift',
  'css',
  'scss',
  'less',
  'html',
  'vue',
  'svelte',
  'xml',
  'csv',
  'sql',
  'sh',
  'bash',
  'zsh',
  'fish',
  'log',
  'env'
])

function extensionOf(path: string): string {
  const name = basename(path)
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index + 1).toLowerCase() : ''
}

export async function readAttachments(paths: string[]): Promise<Attachment[]> {
  const attachments: Attachment[] = []
  for (const path of paths) {
    try {
      const stat = await fs.stat(path)
      if (!stat.isFile()) continue
      const extension = extensionOf(path)
      const name = basename(path)
      const mediaType = IMAGE_TYPES[extension]
      if (mediaType) {
        if (stat.size > 12 * 1024 * 1024) continue
        const data = await fs.readFile(path)
        attachments.push({ kind: 'image', name, mediaType, data: data.toString('base64') })
        continue
      }
      const documentType = DOCUMENT_TYPES[extension]
      if (documentType) {
        if (stat.size > 20 * 1024 * 1024) continue
        const data = await fs.readFile(path)
        attachments.push({
          kind: 'document',
          name,
          mediaType: documentType,
          data: data.toString('base64')
        })
        continue
      }
      if (TEXT_EXTENSIONS.has(extension) || !extension) {
        if (stat.size > 512 * 1024) {
          const handle = await fs.open(path, 'r')
          try {
            const buffer = Buffer.alloc(200 * 1024)
            const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
            attachments.push({
              kind: 'text',
              name,
              text: `${buffer.subarray(0, bytesRead).toString('utf8')}\n\n… (file too large; truncated)`
            })
          } finally {
            await handle.close()
          }
        } else {
          attachments.push({ kind: 'text', name, text: await fs.readFile(path, 'utf8') })
        }
      }
    } catch {
      // skip unreadable files
    }
  }
  return attachments
}

export async function pickAttachmentFiles(): Promise<Attachment[]> {
  const result = await dialog.showOpenDialog({
    title: 'Choose files to attach',
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Images and text files',
        extensions: [
          ...Object.keys(IMAGE_TYPES),
          ...Object.keys(DOCUMENT_TYPES),
          ...Array.from(TEXT_EXTENSIONS)
        ]
      },
      { name: 'All files', extensions: ['*'] }
    ]
  })
  if (result.canceled || result.filePaths.length === 0) return []
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
  if (TEXT_EXTENSIONS.has(extension) || !extension) {
    const limit = 1024 * 1024
    const handle = await fs.open(target, 'r')
    try {
      const buffer = Buffer.alloc(Math.min(stat.size, limit))
      await handle.read(buffer, 0, buffer.length, 0)
      const text =
        buffer.toString('utf8') +
        (stat.size > limit ? '\n\n… (file too large; truncated)' : '')
      return { kind: 'text', path: target, text, size: stat.size }
    } finally {
      await handle.close()
    }
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
