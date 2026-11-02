import { execFile } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { BackgroundSession, BackgroundStartResult } from '../shared/types'
import { resolveClaudeExecutable } from './session'

const execFileAsync = promisify(execFile)

function claudeBinary(): string {
  return resolveClaudeExecutable() || 'claude'
}

function configPath(): string {
  return join(homedir(), '.claude.json')
}

export async function listBackgroundSessions(): Promise<BackgroundSession[]> {
  try {
    const { stdout } = await execFileAsync(claudeBinary(), ['agents', '--json'], {
      cwd: homedir(),
      timeout: 20_000,
      maxBuffer: 5 * 1024 * 1024,
      env: process.env
    })
    const parsed = JSON.parse(stdout) as BackgroundSession[]
    return Array.isArray(parsed)
      ? parsed.filter((session) => session.kind === 'background')
      : []
  } catch {
    return []
  }
}

export function trustDirectory(cwd: string): void {
  const config = JSON.parse(readFileSync(configPath(), 'utf8')) as Record<string, any>
  config.projects = config.projects || {}
  config.projects[cwd] = {
    ...(config.projects[cwd] || {}),
    hasTrustDialogAccepted: true
  }
  writeFileSync(configPath(), JSON.stringify(config, null, 2) + '\n', { mode: 0o600 })
}

export async function startBackgroundSession(
  cwd: string,
  prompt: string,
  trust: boolean
): Promise<BackgroundStartResult> {
  if (trust) trustDirectory(cwd)
  const { stdout, stderr } = await execFileAsync(
    claudeBinary(),
    ['--bg', prompt],
    {
      cwd,
      timeout: 60_000,
      maxBuffer: 5 * 1024 * 1024,
      env: process.env
    }
  )
  const output = `${stdout}${stderr}`
  const match = output.match(/backgrounded\s*·\s*([0-9a-f]+)/i)
  const sessions = await listBackgroundSessions()
  return { id: match?.[1], output, sessions }
}

export async function backgroundLogs(id: string): Promise<string> {
  const { stdout, stderr } = await execFileAsync(claudeBinary(), ['logs', id], {
    cwd: homedir(),
    timeout: 30_000,
    maxBuffer: 5 * 1024 * 1024,
    env: process.env
  })
  return stripAnsi(`${stdout}${stderr}`)
}

function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')
}

export async function backgroundStop(id: string): Promise<string> {
  const { stdout, stderr } = await execFileAsync(claudeBinary(), ['stop', id], {
    cwd: homedir(),
    timeout: 30_000,
    maxBuffer: 5 * 1024 * 1024,
    env: process.env
  })
  return `${stdout}${stderr}`
}

export async function backgroundRemove(id: string): Promise<string> {
  const { stdout, stderr } = await execFileAsync(claudeBinary(), ['rm', id], {
    cwd: homedir(),
    timeout: 30_000,
    maxBuffer: 5 * 1024 * 1024,
    env: process.env
  })
  return `${stdout}${stderr}`
}
