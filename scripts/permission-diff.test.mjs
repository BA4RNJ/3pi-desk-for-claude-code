import test from 'node:test'
import assert from 'node:assert/strict'
import { permissionDiff } from '../src/shared/permission-diff.ts'

test('builds an Edit diff from old and new strings', () => {
  const blocks = permissionDiff('Edit', {
    file_path: '/tmp/a.ts',
    old_string: 'const a = 1',
    new_string: 'const a = 2'
  })
  assert.deepEqual(blocks, [
    { label: '/tmp/a.ts', before: 'const a = 1', after: 'const a = 2' }
  ])
})

test('builds one block per MultiEdit entry', () => {
  const blocks = permissionDiff('MultiEdit', {
    file_path: '/tmp/a.ts',
    edits: [
      { old_string: 'a', new_string: 'b' },
      { old_string: 'c', new_string: 'd' }
    ]
  })
  assert.equal(blocks.length, 2)
  assert.equal(blocks[1].label, '/tmp/a.ts · 编辑 2')
  assert.equal(blocks[1].before, 'c')
  assert.equal(blocks[1].after, 'd')
})

test('treats Write as an all-add diff', () => {
  const blocks = permissionDiff('Write', {
    file_path: '/tmp/new.ts',
    content: 'export const x = 1'
  })
  assert.deepEqual(blocks, [
    { label: '/tmp/new.ts', before: '', after: 'export const x = 1' }
  ])
})

test('returns no diff for unrelated tools', () => {
  assert.deepEqual(permissionDiff('Bash', { command: 'rm -rf /tmp/x' }), [])
})
