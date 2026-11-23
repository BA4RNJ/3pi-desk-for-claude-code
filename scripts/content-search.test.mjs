import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { searchContent } from '../src/main/content-search.ts'

async function fixture() {
  const root = await fs.mkdtemp(join(tmpdir(), '3pi-content-search-'))
  await fs.mkdir(join(root, 'src'), { recursive: true })
  await fs.mkdir(join(root, 'node_modules'), { recursive: true })
  await fs.writeFile(join(root, 'src', 'a.ts'), 'const hello = 1\n// hello again\n')
  await fs.writeFile(join(root, 'README.md'), '# Hello World\n')
  await fs.writeFile(join(root, 'node_modules', 'ignored.ts'), 'hello\n')
  await fs.writeFile(join(root, 'binary.bin'), Buffer.from([0x68, 0x00, 0x69]))
  return root
}

test('finds matches, reports line/column, and skips ignored directories', async () => {
  const root = await fixture()
  try {
    const results = await searchContent(root, 'hello')
    assert.equal(results.length, 3)
    assert.ok(results.every((item) => !item.relativePath.startsWith('node_modules/')))
    const first = results.find((item) => item.relativePath === 'src/a.ts')
    assert.equal(first.line, 1)
    assert.equal(first.column, 7)
    assert.match(first.preview, /const hello/)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('search is case-insensitive and respects the limit', async () => {
  const root = await fixture()
  try {
    const all = await searchContent(root, 'HELLO')
    assert.equal(all.length, 3)
    const limited = await searchContent(root, 'hello', { limit: 1 })
    assert.equal(limited.length, 1)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('returns no matches for empty queries or binary files', async () => {
  const root = await fixture()
  try {
    assert.deepEqual(await searchContent(root, '   '), [])
    assert.deepEqual(await searchContent(root, '\u0000'), [])
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
