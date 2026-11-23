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

async function latestAppRelease(): Promise<{ version?: string; url?: string }> {
  try {
    const response = await fetch(
      'https://api.github.com/repos/BA4RNJ/3pi-desk-for-claude-code/releases/latest',
      {
        headers: { Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(12_000)
      }
    )
    if (!response.ok) return {}
    const body = (await response.json()) as { tag_name?: string; html_url?: string }
    const version = body.tag_name ? body.tag_name.replace(/^v/i, '').trim() : undefined
    return {
      version: version || undefined,
      url: body.html_url || undefined
    }
  } catch {
    return {}
  }
}

export async function versionInfo(checkLatest = true): Promise<VersionInfo> {
  const [claudeCode, latestSdk, release] = await Promise.all([
    claudeCodeVersion(),
    checkLatest ? latestSdkVersion() : Promise.resolve(undefined),
    checkLatest ? latestAppRelease() : Promise.resolve<{ version?: string; url?: string }>({})
  ])
  return {
    app: app.getVersion(),
    electron: process.versions.electron || '',
    node: process.versions.node || '',
    sdk: sdkVersion(),
    claudeCode,
    latestSdk,
    latestApp: release.version,
    releaseUrl: release.url
  }
}
