import type { Attachment, AttachmentFailureReason } from '../../../shared/types'
import {
  DOCUMENT_TYPES,
  IMAGE_TYPES,
  MAX_DOCUMENT_BYTES,
  MAX_IMAGE_BYTES,
  SUPPORTED_IMAGE_MEDIA_TYPES,
  TEXT_FULL_LIMIT_BYTES,
  TEXT_PREVIEW_LIMIT_BYTES,
  decodeTextBytes,
  extensionOf,
  isSvgFile
} from '../../../shared/attachments'

export interface FileAttachmentResult {
  attachment: Attachment | null
  reason?: AttachmentFailureReason
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function base64Payload(file: File): Promise<string | null> {
  const dataUrl = await readAsDataUrl(file)
  const comma = dataUrl.indexOf(',')
  return comma >= 0 ? dataUrl.slice(comma + 1) : null
}

/**
 * Convert a dropped/pasted/chosen browser File into an API attachment.
 *
 * Images are limited to formats the Messages API accepts. SVG is attached as
 * text (its source), and any other file is sniffed: text-like files become
 * text attachments, binary/unsupported files are reported back to the UI
 * instead of being silently dropped.
 */
export async function fileToAttachment(file: File): Promise<FileAttachmentResult> {
  const extension = extensionOf(file.name)
  const declaredType = (file.type || '').toLowerCase()
  const imageType =
    IMAGE_TYPES[extension] ||
    (SUPPORTED_IMAGE_MEDIA_TYPES.has(declaredType) ? declaredType : '')

  if (!isSvgFile(file.name, declaredType) && imageType) {
    if (file.size > MAX_IMAGE_BYTES) {
      return { attachment: null, reason: 'too-large' }
    }
    const data = await base64Payload(file)
    if (!data) return { attachment: null, reason: 'unreadable' }
    return {
      attachment: {
        kind: 'image',
        name: file.name || '图片',
        mediaType: imageType,
        data
      }
    }
  }

  if (declaredType.startsWith('image/') && !isSvgFile(file.name, declaredType)) {
    return { attachment: null, reason: 'unsupported' }
  }

  const documentType =
    DOCUMENT_TYPES[extension] || (declaredType === 'application/pdf' ? declaredType : '')
  if (documentType) {
    if (file.size > MAX_DOCUMENT_BYTES) {
      return { attachment: null, reason: 'too-large' }
    }
    const data = await base64Payload(file)
    if (!data) return { attachment: null, reason: 'unreadable' }
    return {
      attachment: {
        kind: 'document',
        name: file.name || '文档',
        mediaType: documentType,
        data
      }
    }
  }

  const readSize =
    file.size > TEXT_FULL_LIMIT_BYTES
      ? Math.min(file.size, TEXT_PREVIEW_LIMIT_BYTES)
      : file.size
  const buffer = await file.slice(0, readSize).arrayBuffer()
  const text = decodeTextBytes(new Uint8Array(buffer))
  if (text === null) return { attachment: null, reason: 'unsupported' }
  if (!text.trim()) return { attachment: null, reason: 'empty' }

  return {
    attachment: {
      kind: 'text',
      name: file.name || '附件',
      text:
        file.size > TEXT_FULL_LIMIT_BYTES
          ? `${text}\n\n…（文件过大，已截断）`
          : text
    }
  }
}

export function attachmentLabel(attachment: Attachment): string {
  return attachment.name
}
