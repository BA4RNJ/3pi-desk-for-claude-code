import { app, BrowserWindow, net } from 'electron'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync
} from 'node:fs'
import { promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { x as extractTar } from 'tar'
import type {
  ClaudeCliProgress,
  ClaudeCliSource,
  ClaudeCliStatus
} from '../shared/types'
import {
  cachedCliPath,
  claudeBinaryName,
  isExecutableFile,
  parseCliVersion,
  platformPackageNames,
  systemBinaryCandidates
} from './claude-cli-paths'
import { getClaudeCliPath, saveClaudeCliPath } from './settings'

const execFileAsync = promisify(execFile)

const SDK_PACKAGE = '@anthropic-ai/claude-agent-sdk'
const FALLBACK_SDK_VERSION = '0.3.316'
const DEFAULT_REGISTRY = 'https://registry.npmjs.org'
const MAX_METADATA_BYTES = 2 * 1024 * 1024
const PROGRESS_INTERVAL_MS = 200

const BINARY_NAME = claudeBinaryName()

interface ResolvedCli {
  path: string
  source: Exclude<ClaudeCliSource, 'missing'>
}

interface DownloadState {
  downloading: boolean
  progress?: ClaudeCliProgress
  error?: string
}

let cachedResolution: ResolvedCli | null = null
let resolutionCached = false
let downloadState: DownloadState = { downloading: false }
let downloadPromise: Promise<ClaudeCliStatus> | null = null
const versionCache = new Map<string, string | undefined>()

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function sdkVersion(): string {
  try {
    const entry = require.resolve(SDK_PACKAGE)
    const pkg = JSON.parse(
      readFileSync(join(dirname(entry), 'package.json'), 'utf8')
    ) as { version?: string }
    if (pkg.version) return pkg.version
  } catch {
    // fall through to the app manifest
  }
  try {
    const pkg = JSON.parse(
      readFileSync(join(app.getAppPath(), 'package.json'), 'utf8')
    ) as { dependencies?: Record<string, string> }
    const range = pkg.dependencies?.[SDK_PACKAGE]
    if (range) return range.replace(/^[^0-9]*/, '')
  } catch {
    // fall through to the pinned fallback
  }
  return FALLBACK_SDK_VERSION
}

function cacheRoot(): string {
  return join(app.getPath('userData'), 'claude-cli')
}

/** Resolve the bundled platform CLI (offline builds). */
function resolveBundled(): string | undefined {
  for (const packageName of platformPackageNames(process.platform, process.arch)) {
    try {
      const resolved = require.resolve(`${packageName}/${BINARY_NAME}`)
      if (!resolved.includes('app.asar')) {
        if (existsSync(resolved)) return resolved
      } else {
        const unpacked = resolved.replace(
          /([\\/])app\.asar([\\/])/,
          '$1app.asar.unpacked$2'
        )
        if (existsSync(unpacked)) return unpacked
      }
    } catch {
      // package not installed in this build
    }

    const fallback = join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      ...packageName.split('/'),
      BINARY_NAME
    )
    if (existsSync(fallback)) return fallback
  }
  return undefined
}

/**
 * Resolution order:
 *   1. CLAUDE_CODE_EXECUTABLE
 *   2. explicit path from Settings
 *   3. bundled platform package (offline build)
 *   4. previously downloaded CLI
 *   5. system installation (PATH, official installer, Homebrew)
 */
function resolveClaudeCli(): ResolvedCli | null {
  if (resolutionCached) return cachedResolution

  const envPath = process.env.CLAUDE_CODE_EXECUTABLE?.trim()
  if (envPath && isExecutableFile(envPath)) {
    cachedResolution = { path: envPath, source: 'env' }
    resolutionCached = true
    return cachedResolution
  }

  const configured = getClaudeCliPath()
  if (configured && isExecutableFile(configured)) {
    cachedResolution = { path: configured, source: 'setting' }
    resolutionCached = true
    return cachedResolution
  }

  const bundled = resolveBundled()
  if (bundled) {
    cachedResolution = { path: bundled, source: 'bundled' }
    resolutionCached = true
    return cachedResolution
  }

  const cached = cachedCliPath(app.getPath('userData'), sdkVersion())
  if (isExecutableFile(cached)) {
    cachedResolution = { path: cached, source: 'cached' }
    resolutionCached = true
    return cachedResolution
  }

  for (const candidate of systemBinaryCandidates({
    platform: process.platform,
    envPath: process.env.PATH,
    home: homedir()
  })) {
    if (isExecutableFile(candidate)) {
      cachedResolution = { path: candidate, source: 'system' }
      resolutionCached = true
      return cachedResolution
    }
  }

  cachedResolution = null
  resolutionCached = true
  return null
}

export function invalidateClaudeCli(): void {
  cachedResolution = null
  resolutionCached = false
  versionCache.clear()
}

/** Synchronous resolver used by sessions, extensions, background tasks. */
export function resolveClaudeExecutable(): string | undefined {
  return resolveClaudeCli()?.path
}

export async function ensureClaudeExecutable(): Promise<string> {
  const resolved = resolveClaudeCli()
  if (resolved) return resolved.path

  // The user may have installed a CLI after the app started.
  invalidateClaudeCli()
  const retry = resolveClaudeCli()
  if (retry) return retry.path

  throw new Error(
    '未找到 Claude Code CLI。请在设置 → 常规中下载 CLI，或选择本机已安装的 claude。'
  )
}

async function readVersion(path: string): Promise<string | undefined> {
  if (versionCache.has(path)) return versionCache.get(path)
  try {
    const { stdout, stderr } = await execFileAsync(path, ['--version'], {
      timeout: 5_000,
      maxBuffer: 1024 * 1024,
      env: process.env
    })
    const version = parseCliVersion(`${stdout}\n${stderr}`)
    versionCache.set(path, version)
    return version
  } catch {
    versionCache.set(path, undefined)
    return undefined
  }
}

function currentStatus(): ClaudeCliStatus {
  const resolved = resolveClaudeCli()
  return {
    path: resolved?.path,
    source: resolved?.source ?? 'missing',
    version: resolved ? versionCache.get(resolved.path) : undefined,
    expectedVersion: sdkVersion(),
    downloading: downloadState.downloading,
    progress: downloadState.progress,
    error: downloadState.error
  }
}

function emitStatus(): void {
  const status = currentStatus()
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('claude-cli:status', status)
    }
  }
}

export async function getClaudeCliStatus(
  refresh = false
): Promise<ClaudeCliStatus> {
  if (refresh) invalidateClaudeCli()
  const status = currentStatus()
  if (status.path) status.version = await readVersion(status.path)
  return status
}

export async function setClaudeCliPath(
  path: string | null
): Promise<ClaudeCliStatus> {
  const trimmed = path?.trim() || null
  if (trimmed && !isExecutableFile(trimmed)) {
    throw new Error('所选文件不存在或不可执行。')
  }
  saveClaudeCliPath(trimmed)
  invalidateClaudeCli()
  return getClaudeCliStatus(true)
}

function netText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = net.request({ url, method: 'GET', redirect: 'follow' })
    request.on('response', (response) => {
      if (response.statusCode >= 400) {
        request.abort()
        reject(new Error(`HTTP ${response.statusCode}`))
        return
      }
      const chunks: Buffer[] = []
      let size = 0
      response.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > MAX_METADATA_BYTES) {
          request.abort()
          reject(new Error('下载元数据过大。'))
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'))
      })
      response.on('error', reject)
    })
    request.on('error', reject)
    request.end()
  })
}

async function resolveDownload(
  version: string
): Promise<{ url: string; integrity?: string }> {
  const override = process.env.CLAUDE_CLI_DOWNLOAD_URL?.trim()
  if (override) {
    return {
      url: override,
      integrity: process.env.CLAUDE_CLI_INTEGRITY?.trim() || undefined
    }
  }

  const registry = (
    process.env.CLAUDE_CLI_REGISTRY?.trim() || DEFAULT_REGISTRY
  ).replace(/\/+$/, '')
  const packageName = platformPackageNames(process.platform, process.arch)[0]
  const metadataUrl = `${registry}/${encodeURIComponent(packageName)}/${encodeURIComponent(version)}`
  const metadata = JSON.parse(await netText(metadataUrl)) as {
    dist?: { tarball?: string; integrity?: string }
  }
  if (!metadata.dist?.tarball) {
    throw new Error('npm 未返回 CLI 下载地址。')
  }
  return { url: metadata.dist.tarball, integrity: metadata.dist.integrity }
}

function downloadFile(
  url: string,
  destination: string,
  integrity: string | undefined,
  onProgress: (received: number, total: number | null) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = net.request({ url, method: 'GET', redirect: 'follow' })
    const output = createWriteStream(destination)
    const hash = createHash('sha512')
    let settled = false
    let received = 0
    let total: number | null = null
    let lastProgress = 0

    const fail = (error: unknown): void => {
      if (settled) return
      settled = true
      output.destroy()
      request.abort()
      reject(error instanceof Error ? error : new Error(String(error)))
    }

    request.on('response', (response) => {
      if (response.statusCode >= 400) {
        fail(new Error(`下载失败：HTTP ${response.statusCode}`))
        return
      }
      const header = response.headers['content-length']
      const rawLength = Array.isArray(header) ? header[0] : header
      const parsedLength = Number(rawLength)
      total = Number.isFinite(parsedLength) ? parsedLength : null

      response.on('data', (chunk: Buffer) => {
        received += chunk.length
        hash.update(chunk)
        if (!output.write(chunk)) {
          const stream = response as unknown as NodeJS.ReadableStream
          stream.pause()
          output.once('drain', () => stream.resume())
        }
        const now = Date.now()
        if (now - lastProgress >= PROGRESS_INTERVAL_MS) {
          lastProgress = now
          onProgress(received, total)
        }
      })
      response.on('end', () => {
        output.end(() => {
          if (settled) return
          if (integrity?.startsWith('sha512-')) {
            const expected = integrity.slice('sha512-'.length)
            const actual = hash.digest('base64')
            if (actual !== expected) {
              settled = true
              reject(new Error('CLI 下载校验失败，请重试。'))
              return
            }
          }
          settled = true
          onProgress(received, total ?? received)
          resolve()
        })
      })
      response.on('error', fail)
    })
    request.on('error', fail)
    output.on('error', fail)
    request.end()
  })
}

async function performDownload(): Promise<ClaudeCliStatus> {
  const version = sdkVersion()
  const destination = cachedCliPath(app.getPath('userData'), version)
  if (isExecutableFile(destination)) {
    invalidateClaudeCli()
    return getClaudeCliStatus(true)
  }

  downloadState = { downloading: true }
  emitStatus()

  const root = cacheRoot()
  const tempDir = join(root, `.tmp-${process.pid}-${Date.now()}`)
  const tarball = join(tempDir, 'cli.tgz')

  try {
    mkdirSync(tempDir, { recursive: true })
    const { url, integrity } = await resolveDownload(version)
    await downloadFile(url, tarball, integrity, (received, total) => {
      downloadState.progress = { phase: 'download', received, total }
      emitStatus()
    })

    downloadState.progress = { phase: 'extract', received: 0, total: null }
    emitStatus()

    const extractDir = join(tempDir, 'extract')
    mkdirSync(extractDir, { recursive: true })
    await extractTar({
      file: tarball,
      cwd: extractDir,
      filter: (path) => path === `package/${BINARY_NAME}`
    })

    const extracted = join(extractDir, 'package', BINARY_NAME)
    if (!existsSync(extracted)) {
      throw new Error('下载的 CLI 包中没有找到 claude 可执行文件。')
    }
    chmodSync(extracted, 0o755)
    mkdirSync(dirname(destination), { recursive: true })
    await fs.rm(destination, { force: true })
    await fs.rename(extracted, destination)

    invalidateClaudeCli()
    downloadState = { downloading: false }
    emitStatus()
    return getClaudeCliStatus(true)
  } catch (error) {
    downloadState = { downloading: false, error: errorMessage(error) }
    emitStatus()
    throw error
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

export function downloadClaudeCli(): Promise<ClaudeCliStatus> {
  if (!downloadPromise) {
    downloadPromise = performDownload().finally(() => {
      downloadPromise = null
    })
  }
  return downloadPromise
}
