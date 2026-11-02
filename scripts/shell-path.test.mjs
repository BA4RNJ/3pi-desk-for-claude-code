import test from 'node:test'
import assert from 'node:assert/strict'
import { mergePathEntries, pathLooksMinimal } from '../src/main/shell-path.ts'

test('merges PATH segments and removes duplicates', () => {
  assert.equal(
    mergePathEntries('/opt/homebrew/bin:/usr/bin', '/usr/bin:/bin', '/usr/local/bin'),
    '/opt/homebrew/bin:/usr/bin:/bin:/usr/local/bin'
  )
})

test('ignores empty and missing values', () => {
  assert.equal(
    mergePathEntries(undefined, '', null, '/usr/bin::/bin'),
    '/usr/bin:/bin'
  )
})

test('keeps the first occurrence order', () => {
  assert.equal(mergePathEntries('/b:/a:/b', '/c:/a'), '/b:/a:/c')
})

test('recognizes the LaunchServices PATH as minimal', () => {
  assert.equal(pathLooksMinimal('/usr/bin:/bin:/usr/sbin:/sbin'), true)
  assert.equal(pathLooksMinimal(undefined), true)
})

test('does not treat an inherited developer PATH as minimal', () => {
  assert.equal(pathLooksMinimal('/opt/homebrew/bin:/usr/bin:/bin'), false)
  assert.equal(pathLooksMinimal('/usr/bin:/bin:/custom/bin:/usr/sbin:/sbin'), false)
})
