import type { AttachmentFailureReason } from './types'

/** Image formats the Anthropic Messages API accepts as image blocks. */
export const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp'
}

/** Document formats the API accepts as document blocks. */
export const DOCUMENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf'
}

export const SUPPORTED_IMAGE_MEDIA_TYPES = new Set(Object.values(IMAGE_TYPES))

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024
/** Files up to this size are attached in full. */
export const TEXT_FULL_LIMIT_BYTES = 512 * 1024
/** Larger text files are truncated to this many bytes. */
export const TEXT_PREVIEW_LIMIT_BYTES = 200 * 1024

export function extensionOf(name: string): string {
  const cleaned = name.split(/[\\/]/).pop() || name
  const index = cleaned.lastIndexOf('.')
  return index >= 0 ? cleaned.slice(index + 1).toLowerCase() : ''
}

export function isSvgFile(name: string, mediaType?: string): boolean {
  return (
    extensionOf(name) === 'svg' ||
    (mediaType || '').toLowerCase() === 'image/svg+xml'
  )
}

export function failureText(reason: AttachmentFailureReason): string {
  switch (reason) {
    case 'too-large':
      return '文件过大'
    case 'unreadable':
      return '无法读取文件'
    case 'empty':
      return '文件内容为空'
    default:
      return '不支持的文件类型'
  }
}

/**
 * Decode buffered text, or return `null` when the bytes look binary.
 *
 * Supports UTF-8, UTF-16 (with BOM), and GB18030 as a fallback, which covers
 * source code, config files, SVG/XML, CSV, and Chinese text files that are not
 * UTF-8. A NUL byte in the first 8 KB is treated as a binary file.
 */
export function decodeTextBytes(bytes: Uint8Array): string | null {
  if (bytes.length === 0) return ''

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  }

  const sample = bytes.subarray(0, Math.min(bytes.length, 8192))
  for (const byte of sample) {
    if (byte === 0) return null
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    try {
      return new TextDecoder('gb18030').decode(bytes)
    } catch {
      return null
    }
  }
}
