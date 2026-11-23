import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  backupSessionId,
  copyBackup,
  listBackups,
  readBackup
} from '../src/main/backups.ts'

const SESSION_ID = '11111111-2222-3333-4444-555555555555'
const NAME = `2026-11-09T00-00-00-000Z-${SESSION_ID}.jsonl`

test('parses the session id from a backup name', () => {
  assert.equal(backupSessionId(NAME), SESSION_ID)
  assert.equal(backupSessionId('notes.txt'), undefined)
})

test('lists, reads, and copies session backups', async () => {
  const root = await fs.mkdtemp(join(tmpdir(), '3pi-backups-'))
  try {
    const source = join(root, NAME)
    await fs.writeFile(source, '{"type":"user"}\n{"type":"assistant"}\n')
    const backups = await listBackups(root)
    assert.equal(backups.length, 1)
    assert.equal(backups[0].sessionId, SESSION_ID)
    assert.equal(backups[0].size, 37)
    assert.match(await readBackup(root, NAME), /assistant/)

    const target = join(root, 'export.jsonl')
    await copyBackup(root, NAME, target)
    assert.equal(await fs.readFile(target, 'utf8'), await fs.readFile(source, 'utf8'))
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('rejects path traversal and non-jsonl names', async () => {
  const root = await fs.mkdtemp(join(tmpdir(), '3pi-backups-'))
  try {
    await assert.rejects(() => readBackup(root, '../secret.jsonl'))
    await assert.rejects(() => readBackup(root, 'notes.txt'))
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
