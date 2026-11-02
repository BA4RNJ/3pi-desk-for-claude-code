import test from 'node:test'
import assert from 'node:assert/strict'
import {
  decodeTextBytes,
  extensionOf,
  failureText,
  isSvgFile
} from '../src/shared/attachments.ts'

test('extracts lower-case extensions from paths', () => {
  assert.equal(extensionOf('/tmp/Icon.SVG'), 'svg')
  assert.equal(extensionOf('archive.tar.gz'), 'gz')
  assert.equal(extensionOf('README'), '')
})

test('detects SVG by extension or MIME type', () => {
  assert.equal(isSvgFile('icon.svg'), true)
  assert.equal(isSvgFile('icon', 'image/svg+xml'), true)
  assert.equal(isSvgFile('icon.png', 'image/png'), false)
})

test('decodes UTF-8 text', () => {
  const bytes = new TextEncoder().encode('你好，Claude')
  assert.equal(decodeTextBytes(bytes), '你好，Claude')
})

test('decodes UTF-16LE with BOM', () => {
  const bytes = new Uint8Array([0xff, 0xfe, 0x2d, 0x4e, 0x87, 0x65])
  assert.equal(decodeTextBytes(bytes), '中文')
})

test('falls back to GB18030 for non-UTF-8 Chinese text', () => {
  const bytes = new Uint8Array([0xd6, 0xd0, 0xce, 0xc4])
  assert.equal(decodeTextBytes(bytes), '中文')
})

test('rejects binary data containing NUL bytes', () => {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01])
  assert.equal(decodeTextBytes(bytes), null)
})

test('returns an empty string for an empty file', () => {
  assert.equal(decodeTextBytes(new Uint8Array()), '')
})

test('maps failure reasons to user-facing text', () => {
  assert.equal(failureText('unsupported'), '不支持的文件类型')
  assert.equal(failureText('too-large'), '文件过大')
  assert.equal(failureText('unreadable'), '无法读取文件')
  assert.equal(failureText('empty'), '文件内容为空')
})
