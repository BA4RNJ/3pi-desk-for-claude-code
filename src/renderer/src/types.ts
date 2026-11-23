import type {
  Attachment,
  EffortSetting,
  PermissionRequestPayload,
  SessionState,
  SlashCommandInfo,
  TabTask,
  TokenUsage
} from '../../shared/types'

export type { TabTask, TokenUsage } from '../../shared/types'
import type { TokenRateMeter, TokenRateSnapshot } from './lib/token-rate'

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
  /** Bumped when a streamed assistant/tool message changes in place. */
  revision?: number
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
  tone: 'info' | 'error' | 'attention'
  /** Rendered as a command-list card instead of a one-line notice. */
  help?: SlashCommandInfo[]
  action?: {
    kind: 'rewind'
    messageId: string
  }
}

export type UIMessage = UserMessage | AssistantMessage | NoticeMessage

export type ThemeMode = 'light' | 'dark' | 'system'

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
  /** Total time the AI has been working in this tab, in milliseconds. */
  workElapsedMs: number
  /** Set while a turn is running; the UI adds now - workStartedAt. */
  workStartedAt?: number
  /** Latest live output rate while the assistant is generating. */
  tokenRate?: TokenRateSnapshot
}

export interface TabRuntimeData extends TabView {
  started: boolean
  streamIds: Map<string, string>
  /** Runtime meter for the live tok/s estimate; not persisted. */
  rateMeter: TokenRateMeter
  /** Selected subscription model that should win over the CLI init report. */
  modelOverride?: string
}
