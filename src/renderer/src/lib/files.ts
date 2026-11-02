import type { Attachment } from '../../../shared/types'

const DOCUMENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf'
}

const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp'
}

function extension(name: string): string {
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index + 1).toLowerCase() : ''
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export async function fileToAttachment(file: File): Promise<Attachment | null> {
  const mediaType = file.type || IMAGE_TYPES[extension(file.name)]
  if (mediaType.startsWith('image/')) {
    if (file.size > 12 * 1024 * 1024) return null
    const dataUrl = await readAsDataUrl(file)
    const comma = dataUrl.indexOf(',')
    if (comma < 0) return null
    return {
      kind: 'image',
      name: file.name || '图片',
      mediaType,
      data: dataUrl.slice(comma + 1)
    }
  }

  const documentType = DOCUMENT_TYPES[extension(file.name)]
  if (documentType) {
    if (file.size > 20 * 1024 * 1024) return null
    const dataUrl = await readAsDataUrl(file)
    const comma = dataUrl.indexOf(',')
    if (comma < 0) return null
    return {
      kind: 'document',
      name: file.name || '文档',
      mediaType: documentType,
      data: dataUrl.slice(comma + 1)
    }
  }

  if (file.size <= 512 * 1024) {
    const text = await file.text()
    if (!text) return null
    return { kind: 'text', name: file.name || '附件', text }
  }

  const slice = file.slice(0, 200 * 1024)
  const text = await slice.text()
  return {
    kind: 'text',
    name: file.name || '附件',
    text: `${text}\n\n…（文件过大，已截断）`
  }
}

export function attachmentLabel(attachment: Attachment): string {
  return attachment.name
}
