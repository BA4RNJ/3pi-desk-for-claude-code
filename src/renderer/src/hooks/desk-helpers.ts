import { FALLBACK_COMMANDS } from '../../../shared/ui-options'
import type {
  DesktopEvent,
  ModelOption,
  PermissionRequestPayload,
  SessionState
} from '../../../shared/types'
import type { TabRuntimeData, TabTask, TabView } from '../types'
import { TokenRateMeter } from '../lib/token-rate'

export const FALLBACK_MODELS: ModelOption[] = [
  {
    id: 'deepseek-v4.1-flash',
    name: 'DeepSeek V4.1 Flash',
    description: '快速 · 日常编码',
    contextWindow: 1_000_000,
    effortLevels: ['low', 'high', 'max'],
    supportsImages: true,
    pricing: {
      inputPerMillion: 0.15,
      outputPerMillion: 0.6,
      cacheReadPerMillion: 0.003,
      peakMultiplier: 2,
      peakWindowsUtc: [
        { days: [1, 2, 3, 4, 5], startHour: 1, endHour: 4 },
        { days: [1, 2, 3, 4, 5], startHour: 6, endHour: 10 }
      ]
    }
  },
  {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    description: '更强推理 · 复杂任务',
    contextWindow: 1_000_000,
    effortLevels: ['low', 'high', 'max'],
    supportsImages: true,
    pricing: {
      inputPerMillion: 0.66,
      outputPerMillion: 1.98,
      cacheReadPerMillion: 0.022,
      peakMultiplier: 2,
      peakWindowsUtc: [
        { days: [1, 2, 3, 4, 5], startHour: 1, endHour: 4 },
        { days: [1, 2, 3, 4, 5], startHour: 6, endHour: 10 }
      ]
    }
  }
]

export const EMPTY_STATE: SessionState = {
  running: false,
  connecting: false,
  cwd: '',
  model: 'deepseek-v4.1-flash',
  permissionMode: 'default',
  effort: 'default',
  pendingTurns: 0
}

export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function questionNoticeText(request: PermissionRequestPayload): string {
  const raw = request.input.questions
  const first = Array.isArray(raw)
    ? raw.find((item) => item && typeof item === 'object')
    : undefined
  const question =
    first && typeof (first as Record<string, unknown>).question === 'string'
      ? String((first as Record<string, unknown>).question).trim()
      : ''
  if (question) return `Claude 需要你的回答：${question}`
  return request.title ? `Claude 需要你的回答：${request.title}` : 'Claude 需要你的回答'
}

export function fallbackModelsFor(providerId?: string): ModelOption[] {
  return providerId === 'opencode-go' ? FALLBACK_MODELS : []
}

export function toView(tab: TabRuntimeData): TabView {
  return {
    id: tab.id,
    cwd: tab.cwd,
    title: tab.title,
    messages: tab.messages.slice(),
    state: { ...tab.state },
    permissions: tab.permissions.slice(),
    loadingHistory: tab.loadingHistory,
    sessionId: tab.sessionId,
    effort: tab.effort,
    tasks: tab.tasks.slice(),
    usage: tab.usage ? { ...tab.usage } : undefined,
    commands: tab.commands.slice(),
    workElapsedMs: tab.workElapsedMs,
    workStartedAt: tab.workStartedAt,
    tokenRate: tab.rateMeter.snapshot()
  }
}

export function emptyTab(
  id: string,
  cwd: string,
  model: string,
  sessionId?: string,
  title?: string
): TabRuntimeData {
  return {
    id,
    cwd,
    title: title || '新对话',
    messages: [],
    state: { ...EMPTY_STATE, cwd, model },
    permissions: [],
    loadingHistory: false,
    sessionId,
    effort: 'default',
    tasks: [],
    commands: FALLBACK_COMMANDS,
    workElapsedMs: 0,
    workStartedAt: undefined,
    started: false,
    streamIds: new Map(),
    rateMeter: new TokenRateMeter()
  }
}

export function taskFromEvent(message: DesktopEvent): TabTask | null {
  if (message.type !== 'system') return null
  if (message.ambient) return null
  if (message.subtype === 'task_started' || message.subtype === 'task_progress') {
    const id = String(message.task_id || '')
    if (!id) return null
    return {
      id,
      description: String(message.description || '后台任务'),
      subagentType: message.subagent_type ? String(message.subagent_type) : undefined,
      status: 'running',
      summary: message.summary ? String(message.summary) : undefined,
      parentTaskId: message.parent_task_id ? String(message.parent_task_id) : undefined,
      outputFile: message.output_file ? String(message.output_file) : undefined,
      updatedAt: Date.now()
    }
  }
  if (message.subtype === 'task_notification') {
    const id = String(message.task_id || '')
    if (!id) return null
    return {
      id,
      description: String(message.summary || message.description || '后台任务'),
      status:
        message.status === 'completed'
          ? 'completed'
          : message.status === 'failed'
            ? 'failed'
            : 'stopped',
      summary: message.summary ? String(message.summary) : undefined,
      parentTaskId: message.parent_task_id ? String(message.parent_task_id) : undefined,
      outputFile: message.output_file ? String(message.output_file) : undefined,
      updatedAt: Date.now()
    }
  }
  return null
}
