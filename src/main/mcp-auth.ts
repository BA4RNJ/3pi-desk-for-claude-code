import { spawn, type ChildProcess } from 'node:child_process'
import type { McpLoginResult } from '../shared/types'
import { resolveClaudeExecutable } from './claude-cli'

const active = new Map<string, ChildProcess>()

export function extractFirstUrl(text: string): string | undefined {
  return text.match(/https?:\/\/[^\s<>"']+/i)?.[0]?.replace(/[),.;]+$/, '')
}

export interface McpLoginOptions {
  cwd: string
  onOutput?: (text: string) => void
  openUrl?: (url: string) => void
  timeoutMs?: number
}

/**
 * Runs `claude mcp login <name>` with closed stdin. The CLI may open the
 * system browser itself or print a URL; in both cases we surface the output
 * and open the first URL we see as a fallback.
 */
export function loginMcpServer(
  name: string,
  options: McpLoginOptions
): Promise<McpLoginResult> {
  const executable = resolveClaudeExecutable()
  if (!executable) {
    return Promise.resolve({
      ok: false,
      output: 'Claude Code CLI was not found. Install it or set its path in Settings → General.'
    })
  }

  return new Promise<McpLoginResult>((resolve) => {
    let output = ''
    let opened = false
    let settled = false
    const timeoutMs = Math.max(5_000, options.timeoutMs ?? 5 * 60_000)
    const child = spawn(executable, ['mcp', 'login', name], {
      cwd: options.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    active.set(name, child)

    const finish = (ok: boolean): void => {
      if (settled) return
      settled = true
      active.delete(name)
      const url = extractFirstUrl(output)
      resolve({ ok, output: output.trim(), url })
    }

    const timer = setTimeout(() => {
      output += '\nTimed out waiting for MCP authentication.\n'
      child.kill()
      finish(false)
    }, timeoutMs)

    const consume = (chunk: Buffer): void => {
      const text = chunk.toString('utf8')
      output += text
      options.onOutput?.(text)
      const url = extractFirstUrl(output)
      if (url && !opened) {
        opened = true
        options.openUrl?.(url)
      }
    }

    child.stdout?.on('data', consume)
    child.stderr?.on('data', consume)
    child.on('error', (error) => {
      output += `\n${error.message}\n`
      clearTimeout(timer)
      finish(false)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      finish(code === 0)
    })
  })
}

export function cancelMcpLogin(): void {
  for (const child of active.values()) {
    try {
      child.kill()
    } catch {
      // Ignore.
    }
  }
  active.clear()
}
