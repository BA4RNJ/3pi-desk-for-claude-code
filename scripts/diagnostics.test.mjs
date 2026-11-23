import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatDiagnostics,
  redactDiagnostics
} from '../src/shared/diagnostics.ts'

test('redacts common credential shapes', () => {
  const text = [
    'ANTHROPIC_AUTH_TOKEN=sk-abcdefghijklmnopqrstuvwxyz',
    'Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz',
    'api_key=super-secret-value'
  ].join('\n')
  const redacted = redactDiagnostics(text)
  assert.doesNotMatch(redacted, /sk-abcdefghijklmnopqrstuvwxyz/)
  assert.doesNotMatch(redacted, /ghp_abcdefghijklmnopqrstuvwxyz/)
  assert.doesNotMatch(redacted, /super-secret-value/)
  assert.match(redacted, /\[redacted\]/)
})

test('formats a diagnostics report with metadata and recent log lines', () => {
  const report = formatDiagnostics({
    appVersion: '0.4.3',
    electron: '45.2.1',
    node: '24.0.0',
    platform: 'linux',
    arch: 'x64',
    cliPath: '/usr/bin/claude',
    cliVersion: '2.1.0',
    cliSource: 'system',
    providerId: 'opencode-go',
    model: 'deepseek-v4.1-flash',
    logLines: ['line one', 'line two'],
    generatedAt: '2026-11-09T00:00:00.000Z'
  })
  assert.match(report, /app: 0\.4\.3/)
  assert.match(report, /platform: linux x64/)
  assert.match(report, /provider: opencode-go/)
  assert.match(report, /line one\nline two/)
})
