import type { UIMessage } from '../types'

function attachmentText(message: UIMessage): string {
  if (message.role !== 'user' || !message.attachments?.length) return ''
  return message.attachments
    .map((attachment) =>
      attachment.kind === 'image'
        ? `- 图片：${attachment.name}`
        : `- 附件：${attachment.name}`
    )
    .join('\n')
}

export function messagesToMarkdown(messages: UIMessage[], title: string): string {
  const lines: string[] = [`# ${title}`, '', `> 导出时间：${new Date().toLocaleString('zh-CN')}`, '']

  for (const message of messages) {
    if (message.role === 'user') {
      lines.push('## 用户', '')
      lines.push(message.text || '（附件）')
      const attachments = attachmentText(message)
      if (attachments) lines.push('', attachments)
      lines.push('')
      continue
    }
    if (message.role === 'assistant') {
      lines.push('## 助手', '')
      for (const block of message.blocks) {
        if (block.kind === 'text' && block.text.trim()) {
          lines.push(block.text, '')
        } else if (block.kind === 'thinking' && block.text.trim()) {
          lines.push('<details>', '<summary>思考过程</summary>', '', block.text, '', '</details>', '')
        } else if (block.kind === 'tool') {
          lines.push(`### 工具：${block.name}`, '')
          const input = block.input?.command || block.input?.file_path || block.input?.pattern
          if (input) lines.push(`\`${String(input)}\``, '')
          if (block.result) {
            lines.push('```', block.result.slice(0, 4000), '```', '')
          }
        }
      }
      continue
    }
    lines.push(`> ${message.text}`, '')
  }

  return lines.join('\n')
}

export function safeFileName(name: string): string {
  return (name || '3pi-desk-session')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}
