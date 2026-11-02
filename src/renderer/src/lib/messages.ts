import type { SessionMessage } from '../../../shared/types'
import type {
  AssistantMessage,
  ContentBlock,
  ToolBlock,
  ToolStatus,
  TokenUsage,
  UIMessage
} from '../types'

type RawEvent = Record<string, any>

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function findAssistant(messages: UIMessage[], id: string): AssistantMessage | undefined {
  return messages.find(
    (message): message is AssistantMessage => message.role === 'assistant' && message.id === id
  )
}

function findTool(messages: UIMessage[], toolUseId: string): ToolBlock | undefined {
  for (const message of messages) {
    if (message.role !== 'assistant') continue
    for (const block of message.blocks) {
      if (block.kind === 'tool' && block.id === toolUseId) return block
    }
  }
  return undefined
}

function ensureAssistant(
  messages: UIMessage[],
  id: string,
  parentToolUseId?: string | null,
  model?: string
): AssistantMessage {
  const existing = findAssistant(messages, id)
  if (existing) return existing
  const message: AssistantMessage = {
    id,
    role: 'assistant',
    blocks: [],
    streaming: true,
    ts: Date.now(),
    parentToolUseId: parentToolUseId ?? null,
    model
  }
  messages.push(message)
  return message
}

function toolBlockFromApi(block: RawEvent): ToolBlock {
  return {
    kind: 'tool',
    id: String(block.id || newId()),
    name: String(block.name || 'tool'),
    input: (block.input as Record<string, unknown>) || {},
    inputJson: '',
    status: 'running'
  }
}

function mergeToolStatus(previous: ToolBlock | undefined, next: ToolBlock): ToolBlock {
  if (!previous) return next
  return {
    ...next,
    status: previous.status,
    result: previous.result,
    resultIsError: previous.resultIsError,
    elapsed: previous.elapsed
  }
}

export function apiBlocksToUI(content: unknown): ContentBlock[] {
  const blocks: ContentBlock[] = []
  const rawBlocks = Array.isArray(content) ? (content as RawEvent[]) : []

  for (const block of rawBlocks) {
    if (!block || typeof block !== 'object') continue
    if (block.type === 'text') {
      blocks.push({ kind: 'text', text: String(block.text ?? '') })
    } else if (block.type === 'thinking') {
      blocks.push({ kind: 'thinking', text: String(block.thinking ?? '') })
    } else if (block.type === 'tool_use' || block.type === 'server_tool_use') {
      blocks.push(toolBlockFromApi(block))
    }
  }

  return blocks
}

function mergeContent(message: AssistantMessage, content: unknown): boolean {
  const incoming = apiBlocksToUI(content)
  let changed = false

  for (const block of incoming) {
    if (block.kind === 'tool') {
      const index = message.blocks.findIndex(
        (existing) => existing.kind === 'tool' && existing.id === block.id
      )
      if (index >= 0) {
        const previous = message.blocks[index] as ToolBlock
        message.blocks[index] = mergeToolStatus(previous, block)
      } else {
        message.blocks.push(block)
      }
      changed = true
      continue
    }

    const candidates: Array<{ index: number; text: string }> = []
    message.blocks.forEach((existing, index) => {
      if (existing.kind === block.kind) candidates.push({ index, text: existing.text })
    })

    let match: number | undefined
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const candidate = candidates[index]
      if (
        candidate.text === block.text ||
        candidate.text === '' ||
        block.text.startsWith(candidate.text)
      ) {
        match = candidate.index
        break
      }
    }

    if (match !== undefined) {
      const target = message.blocks[match]
      if (target.kind !== 'tool' && target.text !== block.text) {
        target.text = block.text
        changed = true
      }
    } else {
      message.blocks.push(block)
      changed = true
    }
  }

  return changed
}

export function mergeAssistantEntry(
  messages: UIMessage[],
  entry: {
    id: string
    content: unknown
    parentToolUseId?: string | null
    ts?: number
    model?: string
    transcriptId?: string
  }
): boolean {
  const existing = findAssistant(messages, entry.id)
  if (existing) {
    const changed = mergeContent(existing, entry.content)
    if (entry.model) existing.model = entry.model
    if (entry.transcriptId) existing.transcriptId = entry.transcriptId
    if (entry.parentToolUseId !== undefined) existing.parentToolUseId = entry.parentToolUseId
    return changed
  }

  messages.push({
    id: entry.id,
    role: 'assistant',
    blocks: apiBlocksToUI(entry.content),
    streaming: false,
    ts: entry.ts ?? Date.now(),
    parentToolUseId: entry.parentToolUseId ?? null,
    model: entry.model,
    transcriptId: entry.transcriptId
  })
  return true
}

export function applyStreamEvent(
  messages: UIMessage[],
  messageId: string | undefined,
  parentToolUseId: string | null | undefined,
  rawEvent: RawEvent
): boolean {
  if (!messageId) return false

  if (rawEvent.type === 'message_start') {
    const message = ensureAssistant(
      messages,
      messageId,
      parentToolUseId,
      rawEvent.message?.model
    )
    message.streaming = true
    return true
  }

  const message = findAssistant(messages, messageId)
  if (!message) return false

  if (rawEvent.type === 'content_block_start') {
    const index = Number(rawEvent.index ?? message.blocks.length)
    const block = rawEvent.content_block
    if (!block) return false
    if (block.type === 'text') {
      message.blocks[index] = { kind: 'text', text: String(block.text ?? '') }
    } else if (block.type === 'thinking') {
      message.blocks[index] = { kind: 'thinking', text: String(block.thinking ?? '') }
    } else if (block.type === 'tool_use' || block.type === 'server_tool_use') {
      message.blocks[index] = toolBlockFromApi(block)
    } else {
      return false
    }
    message.streaming = true
    return true
  }

  if (rawEvent.type === 'content_block_delta') {
    const index = Number(rawEvent.index ?? 0)
    const block = message.blocks[index]
    if (!block) return false
    const delta = rawEvent.delta || {}
    if (block.kind === 'text' && delta.type === 'text_delta') {
      block.text += String(delta.text ?? '')
      return true
    }
    if (block.kind === 'thinking' && delta.type === 'thinking_delta') {
      block.text += String(delta.thinking ?? '')
      return true
    }
    if (block.kind === 'tool' && delta.type === 'input_json_delta') {
      block.inputJson += String(delta.partial_json ?? '')
      return true
    }
    return false
  }

  if (rawEvent.type === 'content_block_stop') {
    const index = Number(rawEvent.index ?? 0)
    const block = message.blocks[index]
    if (!block || block.kind !== 'tool' || !block.inputJson) return false
    try {
      block.input = JSON.parse(block.inputJson)
    } catch {
      // keep streaming json as-is
    }
    return true
  }

  if (rawEvent.type === 'message_stop') {
    message.streaming = false
    return true
  }

  return false
}

export function applyAssistantMessage(
  messages: UIMessage[],
  event: RawEvent
): boolean {
  const payload = event.message
  if (!payload?.content) return false
  const id = String(payload.id || event.uuid || newId())
  return mergeAssistantEntry(messages, {
    id,
    content: payload.content,
    parentToolUseId: event.parent_tool_use_id ?? null,
    model: payload.model ? String(payload.model) : undefined,
    transcriptId: event.uuid ? String(event.uuid) : undefined
  })
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === 'string') return block
        if (block?.type === 'text') return String(block.text ?? '')
        if (block?.type === 'image') return '[图片]'
        if (block?.type === 'document') return '[文档]'
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

export function applyUserMessage(messages: UIMessage[], event: RawEvent): boolean {
  if (event.isReplay) return false
  const content = event.message?.content
  const blocks = Array.isArray(content) ? (content as RawEvent[]) : []
  let changed = false

  for (const block of blocks) {
    if (block?.type !== 'tool_result') continue
    const tool = findTool(messages, String(block.tool_use_id))
    if (!tool) continue
    tool.status = block.is_error ? 'error' : 'done'
    tool.resultIsError = Boolean(block.is_error)
    tool.result = extractText(block.content)
    if (Array.isArray(block.content)) {
      const images = block.content
        .filter((item: RawEvent) => item?.type === 'image' && item.source?.data)
        .map(
          (item: RawEvent) =>
            `data:${item.source.media_type || 'image/png'};base64,${item.source.data}`
        )
      if (images.length > 0) tool.images = images
    }
    changed = true
  }

  return changed
}

export function bindRewind(messages: UIMessage[], uuid: string): boolean {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== 'user') continue
    if (message.rewindId === uuid) return false
    message.rewindId = uuid
    return true
  }
  return false
}

export function applyEvent(messages: UIMessage[], event: RawEvent): boolean {
  const uuid =
    event.user_message_uuid ||
    (Array.isArray(event.user_message_uuids)
      ? event.user_message_uuids[event.user_message_uuids.length - 1]
      : undefined)
  if (uuid) bindRewind(messages, String(uuid))

  switch (event.type) {
    case 'assistant':
      return applyAssistantMessage(messages, event)
    case 'user':
      return applyUserMessage(messages, event)
    case 'tool_progress': {
      const tool = findTool(messages, String(event.tool_use_id))
      if (!tool) return false
      tool.elapsed = Number(event.elapsed_time_seconds ?? tool.elapsed ?? 0)
      if (tool.status !== 'pending') tool.status = 'running'
      return true
    }
    case 'system': {
      if (event.subtype === 'permission_denied') {
        const tool = findTool(messages, String(event.tool_use_id))
        if (!tool) return false
        tool.status = 'error'
        tool.resultIsError = true
        tool.result = String(event.message || '权限被拒绝')
        return true
      }
      if (event.subtype === 'compact_boundary') {
        messages.push({
          id: newId(),
          role: 'notice',
          text: '上下文已自动压缩，对话将继续',
          tone: 'info',
          ts: Date.now()
        })
        return true
      }
      return false
    }
    case 'result': {
      let changed = false
      for (const message of messages) {
        if (message.role === 'assistant' && message.streaming) {
          message.streaming = false
          changed = true
        }
      }
      if (event.subtype !== 'success') {
        const text =
          String(event.result || '') ||
          (event.api_error_status ? `请求失败（HTTP ${event.api_error_status}）` : '本轮执行出错')
        messages.push({
          id: newId(),
          role: 'notice',
          text,
          tone: 'error',
          ts: Date.now()
        })
        changed = true
      }
      return changed
    }
    default:
      return false
  }
}

export function markToolStatus(
  messages: UIMessage[],
  toolUseId: string,
  status: ToolStatus,
  result?: string
): boolean {
  const tool = findTool(messages, toolUseId)
  if (!tool) return false
  tool.status = status
  if (result !== undefined) tool.result = result
  return true
}

export function markAllStreamingDone(messages: UIMessage[]): boolean {
  let changed = false
  for (const message of messages) {
    if (message.role === 'assistant' && message.streaming) {
      message.streaming = false
      changed = true
    }
  }
  return changed
}

function looksLikeSystemText(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  return (
    trimmed.startsWith('<system-reminder>') ||
    trimmed.startsWith('<command-name>') ||
    trimmed.startsWith('<local-command') ||
    trimmed.includes('<system-reminder>')
  )
}

export function usageFromHistory(
  raw: SessionMessage[],
  fallbackModel?: string
): Record<string, TokenUsage> | undefined {
  const unique = new Map<string, { model: string; usage: RawEvent }>()
  for (const item of raw) {
    if (item.type !== 'assistant') continue
    const payload = item.message as RawEvent | undefined
    const usage = payload?.usage
    if (!usage || typeof usage !== 'object') continue
    const id = String(payload?.id || item.uuid)
    unique.set(id, {
      model: String(payload?.model || fallbackModel || 'unknown'),
      usage: usage as RawEvent
    })
  }
  if (unique.size === 0) return undefined

  const totals: Record<string, TokenUsage> = {}
  for (const { model, usage } of unique.values()) {
    const current = totals[model] || {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0
    }
    current.inputTokens += Number(usage.input_tokens || 0)
    current.outputTokens += Number(usage.output_tokens || 0)
    current.cacheReadInputTokens += Number(usage.cache_read_input_tokens || 0)
    current.cacheCreationInputTokens += Number(usage.cache_creation_input_tokens || 0)
    totals[model] = current
  }
  return totals
}

export function historyToMessages(raw: SessionMessage[]): UIMessage[] {
  const messages: UIMessage[] = []

  for (const item of raw) {
    if (item.type === 'assistant') {
      const payload = item.message as RawEvent | undefined
      if (!payload?.content) continue
      const id = String(payload.id || item.uuid)
      mergeAssistantEntry(messages, {
        id,
        content: payload.content,
        parentToolUseId: item.parent_tool_use_id ?? null,
        ts: Date.parse(String(payload.timestamp ?? '')) || Date.now(),
        model: payload.model ? String(payload.model) : undefined,
        transcriptId: item.uuid
      })
      continue
    }

    if (item.type === 'user') {
      const payload = item.message as RawEvent | undefined
      if (!payload) continue
      const content = payload.content
      const blocks = Array.isArray(content) ? (content as RawEvent[]) : []

      if (blocks.some((block) => block?.type === 'tool_result')) {
        applyUserMessage(messages, {
          type: 'user',
          message: payload
        })
        continue
      }

      const text = typeof content === 'string' ? content : extractText(content)
      if (looksLikeSystemText(text)) continue
      messages.push({
        id: String(payload.id || item.uuid),
        role: 'user',
        text,
        ts: Date.parse(String(payload.timestamp ?? '')) || Date.now(),
        transcriptId: item.uuid
      })
    }
  }

  return messages
}
