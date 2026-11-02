import type {
  Attachment,
  EffortSetting,
  PermissionRequestPayload,
  SessionState,
  SlashCommandInfo
} from '../../shared/types'

export type ToolStatus = 'pending' | 'running' | 'done' | 'error'

export interface TextBlock {
  kind: 'text'
  text: string
}

export interface ThinkingBlock {
  kind: 'thinking'
  text: string
}

export interface ToolBlock {
  kind: 'tool'
  id: string
  name: string
  input: Record<string, unknown>
  inputJson: string
  status: ToolStatus
  result?: string
  resultIsError?: boolean
  elapsed?: number
  agentId?: string
  images?: string[]
}

export type ContentBlock = TextBlock | ThinkingBlock | ToolBlock

interface BaseMessage {
  id: string
  ts: number
  transcriptId?: string
  parentToolUseId?: string | null
}

export interface UserMessage extends BaseMessage {
  role: 'user'
  text: string
  attachments?: Attachment[]
  rewindId?: string
}

export interface AssistantMessage extends BaseMessage {
  role: 'assistant'
  blocks: ContentBlock[]
  streaming: boolean
  model?: string
}

export interface NoticeMessage extends BaseMessage {
  role: 'notice'
  text: string
  tone: 'info' | 'error'
  action?: {
    kind: 'rewind'
    messageId: string
  }
}

export type UIMessage = UserMessage | AssistantMessage | NoticeMessage

export type ThemeMode = 'light' | 'dark' | 'system'

export interface TabTask {
  id: string
  description: string
  subagentType?: string
  status: 'running' | 'completed' | 'failed' | 'stopped'
  summary?: string
  parentTaskId?: string
  outputFile?: string
  updatedAt: number
}

export interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
}

export interface ComposerDraft {
  text: string
  attachments: Attachment[]
  /** Changes when a new draft should be loaded into the composer. */
  token: number
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  costUSD?: number
  contextWindow?: number
  canonicalModel?: string
  provider?: string
}

export interface TabView {
  id: string
  cwd: string
  title: string
  messages: UIMessage[]
  state: SessionState
  permissions: PermissionRequestPayload[]
  loadingHistory: boolean
  sessionId?: string
  effort: EffortSetting
  tasks: TabTask[]
  usage?: Record<string, TokenUsage>
  commands: SlashCommandInfo[]
}

export interface TabRuntimeData extends TabView {
  started: boolean
  streamIds: Map<string, string>
}
