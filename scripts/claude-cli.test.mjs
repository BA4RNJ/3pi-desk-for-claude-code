import test from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import {
  cachedCliPath,
  claudeBinaryName,
  compareVersions,
  isCompatibleCliVersion,
  isExecutableFile,
  parseCliVersion,
  platformPackageNames,
  systemBinaryCandidates,
  versionManagerCandidates
} from '../src/main/claude-cli-paths.ts'

test('parses CLI versions from --version output', () => {
  assert.equal(parseCliVersion('2.1.309 (Claude Code)'), '2.1.309')
  assert.equal(parseCliVersion('claude 1.2.3-beta.1'), '1.2.3-beta.1')
  assert.equal(parseCliVersion('no version here'), undefined)
})

test('compares semantic versions numerically', () => {
  assert.equal(compareVersions('2.1.309', '2.1.10'), 1)
  assert.equal(compareVersions('2.0.0', '2.0.0'), 0)
  assert.equal(compareVersions('1.9.9', '2.0.0'), -1)
  assert.equal(isCompatibleCliVersion('2.0.0'), true)
  assert.equal(isCompatibleCliVersion('1.0.0'), false)
  assert.equal(isCompatibleCliVersion(undefined), false)
})

test('uses platform-specific package and binary names', () => {
  assert.deepEqual(platformPackageNames('linux', 'x64'), [
    '@anthropic-ai/claude-agent-sdk-linux-x64',
    '@anthropic-ai/claude-agent-sdk-linux-x64-musl'
  ])
  assert.deepEqual(platformPackageNames('darwin', 'arm64'), [
    '@anthropic-ai/claude-agent-sdk-darwin-arm64'
  ])
  assert.equal(claudeBinaryName('win32'), 'claude.exe')
  assert.equal(claudeBinaryName('linux'), 'claude')
})

test('puts PATH entries first and deduplicates candidates', () => {
  const candidates = systemBinaryCandidates({
    platform: 'linux',
    envPath: ['/opt/bin', '/usr/bin', '/opt/bin'].join(delimiter),
    home: '/home/tester'
  })
  assert.equal(candidates[0], join('/opt/bin', 'claude'))
  assert.equal(candidates[1], join('/usr/bin', 'claude'))
  assert.ok(candidates.includes(join('/home/tester', '.local', 'bin', 'claude')))
  assert.equal(new Set(candidates).size, candidates.length)
})

test('lists official-installer versions newest first', () => {
  const home = mkdtempSync(join(tmpdir(), 'claude-cli-test-'))
  try {
    const versions = join(home, '.local', 'share', 'claude', 'versions')
    for (const version of ['2.0.9', '2.1.309', '1.0.0']) {
      mkdirSync(join(versions, version), { recursive: true })
    }
    const found = versionManagerCandidates(home)
    assert.deepEqual(
      found.map((path) => path.split('/').pop()),
      ['2.1.309', '2.0.9', '1.0.0']
    )
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('detects executable files and builds the cache path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'claude-cli-exec-'))
  try {
    const file = join(dir, 'claude')
    writeFileSync(file, '#!/bin/sh\n')
    chmodSync(file, 0o755)
    assert.equal(isExecutableFile(file), true)

    const plain = join(dir, 'plain')
    writeFileSync(plain, 'text')
    if (process.platform !== 'win32') {
      chmodSync(plain, 0o644)
      assert.equal(isExecutableFile(plain), false)
    }

    assert.equal(
      cachedCliPath('/home/tester/.config/claude-desk', '0.3.316', 'linux'),
      join('/home/tester/.config/claude-desk', 'claude-cli', '0.3.316', 'claude')
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
