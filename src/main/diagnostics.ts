import { app } from 'electron'
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { formatDiagnostics, redactDiagnostics } from '../shared/diagnostics'
import { getApiSettings } from './settings'
import { getClaudeCliStatus } from './claude-cli'
import { versionInfo } from './version'

const MAX_LOG_BYTES = 2 * 1024 * 1024
const MAX_EXPORT_LINES = 400

function diagnosticsDir(): string {
  return join(app.getPath('userData'), 'diagnostics')
}

function logPath(): string {
  return join(diagnosticsDir(), 'app.log')
}

function rotateIfNeeded(): void {
  try {
    if (!existsSync(logPath())) return
    if (statSync(logPath()).size < MAX_LOG_BYTES) return
    renameSync(logPath(), `${logPath()}.1`)
  } catch {
    // Diagnostics must never break the app.
  }
}

export function logDiagnostic(message: string): void {
  try {
    mkdirSync(diagnosticsDir(), { recursive: true })
    rotateIfNeeded()
    const line = `[${new Date().toISOString()}] ${redactDiagnostics(message).replace(/\s+$/, '')}\n`
    appendFileSync(logPath(), line, { encoding: 'utf8', mode: 0o600 })
  } catch {
    // Ignore logging failures.
  }
}

export function installDiagnostics(): void {
  process.on('uncaughtException', (error) => {
    logDiagnostic(`uncaughtException: ${error.stack || error.message}`)
  })
  process.on('unhandledRejection', (reason) => {
    logDiagnostic(
      `unhandledRejection: ${reason instanceof Error ? reason.stack || reason.message : String(reason)}`
    )
  })
  const originalError = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    logDiagnostic(`console.error: ${args.map(String).join(' ')}`)
    originalError(...args)
  }
}

export function recentDiagnosticLines(limit = MAX_EXPORT_LINES): string[] {
  try {
    const text = readFileSync(logPath(), 'utf8')
    return text.split('\n').filter(Boolean).slice(-limit)
  } catch {
    return []
  }
}

export function diagnosticsLogPath(): string {
  return logPath()
}

export async function buildDiagnosticsText(): Promise<string> {
  const [info, cli] = await Promise.all([versionInfo(false), getClaudeCliStatus()])
  const api = getApiSettings()
  return formatDiagnostics({
    appVersion: info.app,
    electron: info.electron,
    node: info.node,
    platform: process.platform,
    arch: process.arch,
    cliPath: cli.path,
    cliVersion: cli.version,
    cliSource: cli.source,
    providerId: api.providerId,
    model: api.model,
    logLines: recentDiagnosticLines()
  })
}
