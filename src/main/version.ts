import { app } from 'electron'
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import type { VersionInfo } from '../shared/types'
import { resolveClaudeExecutable } from './session'

const execFileAsync = promisify(execFile)

function sdkVersion(): string {
  try {
    const resolved = require.resolve('@anthropic-ai/claude-agent-sdk')
    const packageJson = join(dirname(resolved), 'package.json')
    const parsed = JSON.parse(readFileSync(packageJson, 'utf8')) as { version?: string }
    return parsed.version || 'unknown'
  } catch {
    return 'unknown'
  }
}

async function claudeCodeVersion(): Promise<string> {
  try {
    const binary = resolveClaudeExecutable()
    if (!binary) return 'not found'
    const { stdout } = await execFileAsync(binary, ['--version'], {
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
      env: process.env
    })
    return stdout.trim() || 'unknown'
  } catch {
    return 'unknown'
  }
}

async function latestSdkVersion(): Promise<string | undefined> {
  try {
    const response = await fetch('https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/latest', {
      signal: AbortSignal.timeout(12_000)
    })
    if (!response.ok) return undefined
    const body = (await response.json()) as { version?: string }
    return body.version
  } catch {
    return undefined
  }
}

export async function versionInfo(checkLatest = true): Promise<VersionInfo> {
  return {
    app: app.getVersion(),
    electron: process.versions.electron || '',
    node: process.versions.node || '',
    sdk: sdkVersion(),
    claudeCode: await claudeCodeVersion(),
    latestSdk: checkLatest ? await latestSdkVersion() : undefined
  }
}
