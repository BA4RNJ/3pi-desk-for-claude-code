const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/sk-[A-Za-z0-9_-]{16,}/g, 'sk-[redacted]'],
  [/ghp_[A-Za-z0-9]{16,}/g, 'ghp_[redacted]'],
  [/github_pat_[A-Za-z0-9_]{16,}/g, 'github_pat_[redacted]'],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/g, 'xox[redacted]'],
  [/(ANTHROPIC_(?:AUTH_TOKEN|API_KEY)\s*[=:]\s*)[^\s"',}]+/gi, '$1[redacted]'],
  [/(Authorization\s*:\s*Bearer\s+)[^\s"',}]+/gi, '$1[redacted]'],
  [/(api[_-]?key\s*[=:]\s*)[^\s"',}]+/gi, '$1[redacted]']
]

/** Redact common credential shapes before diagnostics leave the machine. */
export function redactDiagnostics(text: string): string {
  let result = text
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    result = result.replace(pattern, replacement)
  }
  return result
}

export interface DiagnosticsInput {
  appVersion: string
  electron: string
  node: string
  platform: string
  arch: string
  cliPath?: string
  cliVersion?: string
  cliSource?: string
  providerId?: string
  model?: string
  logLines: string[]
  generatedAt?: string
}

export function formatDiagnostics(input: DiagnosticsInput): string {
  const now = input.generatedAt || new Date().toISOString()
  return redactDiagnostics(
    [
      '# 3PI Desk diagnostics',
      '',
      `generatedAt: ${now}`,
      `app: ${input.appVersion}`,
      `electron: ${input.electron}`,
      `node: ${input.node}`,
      `platform: ${input.platform} ${input.arch}`,
      `cliPath: ${input.cliPath || '(not found)'}`,
      `cliVersion: ${input.cliVersion || '(unknown)'}`,
      `cliSource: ${input.cliSource || '(unknown)'}`,
      `provider: ${input.providerId || '(unknown)'}`,
      `model: ${input.model || '(unknown)'}`,
      '',
      '## recent log',
      '',
      ...(input.logLines.length > 0 ? input.logLines : ['(no log entries)'])
    ].join('\n')
  )
}
