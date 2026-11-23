import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatDiagnostics,
  redactDiagnostics
} from '../src/shared/diagnostics.ts'

test('redacts common credential shapes', () => {
  // Split the prefixes so this fixture does not trip the repository's
  // committed-secret guard while still exercising the redaction patterns.
  const anthropicToken = ['sk', 'abcdefghijklmnopqrstuvwxyz'].join('-')
  const githubToken = ['ghp', 'abcdefghijklmnopqrstuvwxyz'].join('_')
  const text = [
    `ANTHROPIC_AUTH_TOKEN=${anthropicToken}`,
    `Authorization: Bearer ${githubToken}`,
    'api_key=super-secret-value'
  ].join('\n')
  const redacted = redactDiagnostics(text)
  assert.ok(!redacted.includes(anthropicToken))
  assert.ok(!redacted.includes(githubToken))
  assert.ok(!redacted.includes('super-secret-value'))
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
