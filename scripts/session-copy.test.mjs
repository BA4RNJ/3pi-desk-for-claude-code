import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  copySessionToWorkspace,
  encodeProjectDir,
  relocateProjectTranscripts
} from '../src/main/session-copy.ts'

test('encodes project directories the same way as Claude Code', () => {
  assert.equal(encodeProjectDir('/tmp/foo bar'), '-tmp-foo-bar')
  assert.equal(
    encodeProjectDir('/home/user/桌面/3PI desk'),
    '-home-user----3PI-desk'
  )
})

test('copies a transcript across workspaces and rewrites cwd', async () => {
  const root = await fs.mkdtemp(join(tmpdir(), '3pi-session-copy-'))
  const previous = process.env.CLAUDE_CONFIG_DIR
  process.env.CLAUDE_CONFIG_DIR = root
  const sourceCwd = join(root, 'source')
  const targetCwd = join(root, 'target')
  await fs.mkdir(sourceCwd, { recursive: true })
  await fs.mkdir(targetCwd, { recursive: true })
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const sourceDir = join(root, 'projects', encodeProjectDir(sourceCwd))
  await fs.mkdir(sourceDir, { recursive: true })
  const entries = [
    {
      parentUuid: null,
      isSidechain: false,
      userType: 'external',
      cwd: sourceCwd,
      sessionId: id,
      version: '2.1.309',
      gitBranch: '',
      type: 'user',
      message: { role: 'user', content: 'hello' },
      uuid: 'u1',
      timestamp: new Date().toISOString()
    },
    {
      parentUuid: 'u1',
      isSidechain: false,
      userType: 'external',
      cwd: sourceCwd,
      sessionId: id,
      version: '2.1.309',
      gitBranch: '',
      type: 'assistant',
      message: {
        id: 'm1',
        type: 'message',
        role: 'assistant',
        model: 'deepseek-v4.1-flash',
        content: [{ type: 'text', text: 'hi' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 }
      },
      uuid: 'a1',
      timestamp: new Date().toISOString()
    }
  ]
  await fs.writeFile(
    join(sourceDir, `${id}.jsonl`),
    entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n'
  )
  try {
    const newId = await copySessionToWorkspace(id, sourceCwd, targetCwd)
    assert.notEqual(newId, id)
    const targetFile = join(
      root,
      'projects',
      encodeProjectDir(targetCwd),
      `${newId}.jsonl`
    )
    const text = await fs.readFile(targetFile, 'utf8')
    const copied = text.trim().split('\n').map((line) => JSON.parse(line))
    const withCwd = copied.filter((entry) => typeof entry.cwd === 'string')
    assert.ok(withCwd.length >= 2)
    assert.ok(withCwd.every((entry) => entry.cwd === targetCwd))
    assert.ok(await fs.access(join(sourceDir, `${id}.jsonl`)).then(() => true, () => false))
    assert.ok(
      !(await fs
        .access(join(sourceDir, `${newId}.jsonl`))
        .then(() => true, () => false))
    )
  } finally {
    if (previous === undefined) delete process.env.CLAUDE_CONFIG_DIR
    else process.env.CLAUDE_CONFIG_DIR = previous
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('relocates a renamed project without touching the originals', async () => {
  const root = await fs.mkdtemp(join(tmpdir(), '3pi-relocate-'))
  const previous = process.env.CLAUDE_CONFIG_DIR
  process.env.CLAUDE_CONFIG_DIR = root
  const oldCwd = join(root, 'old-project')
  const newCwd = join(root, 'new-project')
  await fs.mkdir(oldCwd, { recursive: true })
  await fs.mkdir(newCwd, { recursive: true })
  const id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const sourceDir = join(root, 'projects', encodeProjectDir(oldCwd))
  const targetDir = join(root, 'projects', encodeProjectDir(newCwd))
  await fs.mkdir(join(sourceDir, id, 'subagents'), { recursive: true })
  await fs.mkdir(join(sourceDir, 'memory'), { recursive: true })
  await fs.writeFile(
    join(sourceDir, `${id}.jsonl`),
    JSON.stringify({
      type: 'user',
      cwd: oldCwd,
      sessionId: id,
      message: { role: 'user', content: 'hello' }
    }) + '\n'
  )
  await fs.writeFile(
    join(sourceDir, id, 'subagents', 'agent.jsonl'),
    JSON.stringify({ type: 'user', cwd: oldCwd, sessionId: id }) + '\n'
  )
  await fs.writeFile(join(sourceDir, 'memory', 'notes.md'), 'old project memory\n')
  try {
    const result = await relocateProjectTranscripts(oldCwd, newCwd)
    assert.deepEqual(result, { sessions: 1, files: 2, skipped: 0 })

    const copied = await fs.readFile(join(targetDir, `${id}.jsonl`), 'utf8')
    assert.equal(JSON.parse(copied.trim()).cwd, newCwd)
    const subagent = await fs.readFile(
      join(targetDir, id, 'subagents', 'agent.jsonl'),
      'utf8'
    )
    assert.equal(JSON.parse(subagent.trim()).cwd, newCwd)
    assert.equal(
      await fs.readFile(join(targetDir, 'memory', 'notes.md'), 'utf8'),
      'old project memory\n'
    )

    // The original transcript stays under the old project directory.
    const original = await fs.readFile(join(sourceDir, `${id}.jsonl`), 'utf8')
    assert.equal(JSON.parse(original.trim()).cwd, oldCwd)

    // Running it again never overwrites files already in the new project.
    const again = await relocateProjectTranscripts(oldCwd, newCwd)
    assert.deepEqual(again, { sessions: 0, files: 0, skipped: 3 })

    // Same source and target is a no-op.
    assert.deepEqual(await relocateProjectTranscripts(oldCwd, oldCwd), {
      sessions: 0,
      files: 0,
      skipped: 0
    })
  } finally {
    if (previous === undefined) delete process.env.CLAUDE_CONFIG_DIR
    else process.env.CLAUDE_CONFIG_DIR = previous
    await fs.rm(root, { recursive: true, force: true })
  }
})
