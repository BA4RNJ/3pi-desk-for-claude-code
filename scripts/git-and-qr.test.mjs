import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getGitDiff, getGitStatus } from '../src/main/git.ts'
import { generateQrMatrix, qrSvgPath } from '../src/renderer/src/lib/qr.ts'

test('generateQrMatrix and qrSvgPath produce valid QR structures for pairing URLs', () => {
  const url = 'https://desk-demo.trycloudflare.com/?pair=abcDEF123_-xyz9876543210'
  const matrix = generateQrMatrix(url)
  assert.ok(matrix.length >= 21 && matrix.length <= 57)
  assert.equal(matrix.length, matrix[0].length)
  // Top-left finder pattern corner must be dark
  assert.equal(matrix[0][0], true)
  assert.equal(matrix[0][6], true)
  assert.equal(matrix[6][0], true)

  const svg = qrSvgPath(url)
  assert.equal(svg.size, matrix.length)
  assert.match(svg.path, /^M\d+,\d+h1v1h-1z/)
})

test('getGitStatus and getGitDiff inspect a temporary git repository', async () => {
  const dir = mkdtempSync(join(tmpdir(), '3pi-git-test-'))
  try {
    const nonRepo = await getGitStatus(dir)
    assert.equal(nonRepo.isRepo, false)

    execFileSync('git', ['init', '-b', 'main'], { cwd: dir })
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir })
    execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: dir })

    const file = join(dir, 'hello.txt')
    writeFileSync(file, 'line 1\nline 2\n', 'utf8')
    execFileSync('git', ['add', 'hello.txt'], { cwd: dir })
    execFileSync('git', ['commit', '-m', 'init'], { cwd: dir })

    writeFileSync(file, 'line 1\nline 2 modified\nline 3\n', 'utf8')
    writeFileSync(join(dir, 'untracked.txt'), 'new file\n', 'utf8')

    const status = await getGitStatus(dir)
    assert.equal(status.isRepo, true)
    assert.equal(status.branch, 'main')
    assert.equal(status.files.length, 2)
    const modified = status.files.find((item) => item.path === 'hello.txt')
    assert.ok(modified)
    assert.equal(modified.additions, 2)
    assert.equal(modified.deletions, 1)

    const diff = await getGitDiff(dir, 'hello.txt')
    assert.equal(diff.before, 'line 1\nline 2\n')
    assert.equal(diff.after, 'line 1\nline 2 modified\nline 3\n')
    assert.match(diff.patch, /\+line 2 modified/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
