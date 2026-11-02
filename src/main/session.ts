import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  query,
  type Options,
  type PermissionMode,
  type PermissionResult,
  type PermissionUpdate,
  type Query,
  type SDKMessage,
  type SDKUserMessage
} from '@anthropic-ai/claude-agent-sdk'
import type {
  ContextUsage,
  DesktopEvent,
  EffortSetting,
  McpServerEntry,
  PermissionRequestPayload,
  RewindPreview,
  SendMessagePayload,
  SessionStartOptions,
  SessionState,
  SlashCommandInfo,
  TurnStats
} from '../shared/types'

export interface StartOptions extends SessionStartOptions {
  extraArgs?: Record<string, string | null>
  maxBudgetUsd?: number
  additionalDirectories?: string[]
  allowedTools?: string[]
  disallowedTools?: string[]
  contextWindow?: number
}

type PendingPermission = {
  resolve: (result: PermissionResult) => void
  input: Record<string, unknown>
  suggestions: PermissionUpdate[]
  kind: 'permission' | 'question' | 'plan'
}

class AsyncQueue<T> {
  private items: T[] = []
  private waiters: Array<(result: IteratorResult<T>) => void> = []
  private ended = false

  push(item: T): void {
    if (this.ended) return
    const waiter = this.waiters.shift()
    if (waiter) waiter({ value: item, done: false })
    else this.items.push(item)
  }

  end(): void {
    if (this.ended) return
    this.ended = true
    for (const waiter of this.waiters.splice(0)) {
      waiter({ value: undefined as T, done: true })
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        if (this.items.length > 0) {
          return Promise.resolve({ value: this.items.shift() as T, done: false })
        }
        if (this.ended) {
          return Promise.resolve({ value: undefined as T, done: true })
        }
        return new Promise<IteratorResult<T>>((resolve) => this.waiters.push(resolve))
      }
    }
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function resolveClaudeExecutable(): string | undefined {
  const binaryName = process.platform === 'win32' ? 'claude.exe' : 'claude'
  const packageName = `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}`

  try {
    const resolved = require.resolve(`${packageName}/${binaryName}`)
    if (!resolved.includes('app.asar')) {
      if (existsSync(resolved)) return resolved
    } else {
      const unpacked = resolved.replace(
        /([\\/])app\.asar([\\/])/,
        '$1app.asar.unpacked$2'
      )
      if (existsSync(unpacked)) return unpacked
    }
  } catch {
    // fall through to the resources path
  }

  const fallback = join(
    process.resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    ...packageName.split('/'),
    binaryName
  )
  return existsSync(fallback) ? fallback : undefined
}



export interface SessionCallbacks {
  emitEvent: (message: DesktopEvent) => void
  emitState: (state: SessionState) => void
  emitPermission: (request: PermissionRequestPayload) => void
  emitPermissionCancel: (id: string) => void
  onResult: (message: DesktopEvent) => void
}

export class SessionManager {
  private query: Query | null = null
  private queue: AsyncQueue<SDKUserMessage> | null = null
  private abort: AbortController | null = null
  private generation = 0
  private pending = new Map<string, PendingPermission>()
  private lastExtras: Pick<
    StartOptions,
    | 'extraArgs'
    | 'maxBudgetUsd'
    | 'contextWindow'
    | 'additionalDirectories'
    | 'allowedTools'
    | 'disallowedTools'
  > = {}

  private state: SessionState = {
    running: false,
    connecting: false,
    cwd: '',
    model: 'deepseek-v4.1-flash',
    permissionMode: 'default',
    effort: 'default'
  }

  constructor(private readonly callbacks: SessionCallbacks) {}

  getState(): SessionState {
    return {
      ...this.state,
      stats: this.state.stats ? { ...this.state.stats } : undefined,
      context: this.state.context ? { ...this.state.context } : undefined
    }
  }

  async start(options: StartOptions): Promise<SessionState> {
    await this.stop()

    const generation = ++this.generation
    this.lastExtras = {
      extraArgs: options.extraArgs,
      maxBudgetUsd: options.maxBudgetUsd,
      contextWindow: options.contextWindow,
      additionalDirectories: options.additionalDirectories,
      allowedTools: options.allowedTools,
      disallowedTools: options.disallowedTools
    }
    this.state = {
      running: false,
      connecting: true,
      cwd: options.cwd,
      model: options.model || this.state.model || 'deepseek-v4.1-flash',
      permissionMode: options.permissionMode || this.state.permissionMode || 'default',
      effort: options.effort || this.state.effort || 'default',
      sessionId: options.resume,
      stats: undefined,
      context: undefined
    }
    this.emitState()

    const queue = new AsyncQueue<SDKUserMessage>()
    const abort = new AbortController()
    this.queue = queue
    this.abort = abort

    const claudeExecutable = resolveClaudeExecutable()

    const queryOptions: Options = {
      cwd: options.cwd,
      pathToClaudeCodeExecutable: claudeExecutable,
      model: this.state.model,
      permissionMode: this.state.permissionMode as PermissionMode,
      effort:
        this.state.effort === 'default' ? undefined : this.state.effort,
      allowDangerouslySkipPermissions: true,
      enableFileCheckpointing: true,
      maxBudgetUsd: options.maxBudgetUsd,
      additionalDirectories: options.additionalDirectories,
      allowedTools: options.allowedTools,
      disallowedTools: options.disallowedTools,
      extraArgs: options.extraArgs,
      resume: options.resume,
      includePartialMessages: true,
      systemPrompt: { type: 'preset', preset: 'claude_code' },
      tools: { type: 'preset', preset: 'claude_code' },
      settingSources: ['user', 'project', 'local'],
      abortController: abort,
      env: {
        ...process.env,
        CLAUDE_AGENT_SDK_CLIENT_APP: '3pi-desk/0.4.0',
        ...(options.contextWindow && options.contextWindow > 0
          ? { CLAUDE_CODE_MAX_CONTEXT_TOKENS: String(options.contextWindow) }
          : {})
      },
      canUseTool: (toolName, input, toolOptions) =>
        this.requestPermission(toolName, input, toolOptions),
      stderr: (data) => {
        if (data.trim()) this.callbacks.emitEvent({ type: 'sdk_stderr', text: data })
      }
    }

    try {
      const activeQuery = query({ prompt: queue, options: queryOptions })
      this.query = activeQuery
      void this.consume(activeQuery, generation)
      void this.refreshContextUsage()
      void activeQuery
        .initializationResult()
        .then(() => {
          if (generation !== this.generation) return
          this.state.connecting = false
          this.emitState()
        })
        .catch(() => undefined)
    } catch (error) {
      this.state.connecting = false
      this.state.error = errorMessage(error)
      this.emitState()
      throw error
    }

    return this.getState()
  }

  async send(payload: SendMessagePayload): Promise<void> {
    if (!this.query || !this.queue) throw new Error('Chat has not started.')
    const trimmed = payload.text.trim()
    const attachments = payload.attachments ?? []
    if (!trimmed && attachments.length === 0) return

    const content: Array<Record<string, unknown>> = []
    if (trimmed) content.push({ type: 'text', text: trimmed })
    for (const attachment of attachments) {
      if (attachment.kind === 'image') {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: attachment.mediaType,
            data: attachment.data
          }
        })
      } else if (attachment.kind === 'document') {
        content.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: attachment.mediaType,
            data: attachment.data
          }
        })
      } else {
        content.push({
          type: 'text',
          text: `\n\n[Attachment: ${attachment.name}]\n${attachment.text}`
        })
      }
    }

    this.state.running = true
    this.state.error = undefined
    this.emitState()

    this.queue.push({
      type: 'user',
      message: {
        role: 'user',
        content: (attachments.length > 0 ? content : trimmed) as any
      },
      parent_tool_use_id: null,
      uuid: payload.uuid
    } as SDKUserMessage)
  }

  async interrupt(): Promise<void> {
    if (!this.query) return
    try {
      await this.query.interrupt()
    } catch {
      if (this.abort) this.abort.abort()
    }
  }

  async setModel(model: string, contextWindow?: number): Promise<void> {
    if (!model) return
    const windowChanged = contextWindow !== this.lastExtras.contextWindow
    if (windowChanged && this.query) {
      if (this.state.running) {
        throw new Error('Stop the current task before switching to a model with a different context window.')
      }
      await this.start({
        cwd: this.state.cwd,
        model,
        permissionMode: this.state.permissionMode,
        effort: this.state.effort,
        resume: this.state.sessionId,
        ...this.lastExtras,
        contextWindow
      })
      return
    }
    if (this.query) {
      await this.query.setModel(model)
    }
    this.state.model = model
    this.lastExtras.contextWindow = contextWindow
    this.emitState()
  }

  async setPermissionMode(mode: PermissionMode): Promise<void> {
    if (this.query) {
      await this.query.setPermissionMode(mode)
    }
    this.state.permissionMode = mode
    this.emitState()
  }

  async setEffort(effort: EffortSetting): Promise<void> {
    if (this.state.running || this.state.connecting) {
      throw new Error('Stop the current task before changing effort.')
    }
    const sessionId = this.state.sessionId
    if (this.query && sessionId) {
      await this.start({
        cwd: this.state.cwd,
        model: this.state.model,
        permissionMode: this.state.permissionMode,
        effort,
        resume: sessionId,
        ...this.lastExtras
      })
      return
    }
    this.state.effort = effort
    this.emitState()
  }

  async rewind(userMessageId: string, dryRun: boolean): Promise<RewindPreview> {
    if (!this.query) throw new Error('Chat has not started.')
    const result = await this.query.rewindFiles(userMessageId, { dryRun })
    return {
      canRewind: result.canRewind,
      error: result.error,
      filesChanged: result.filesChanged,
      insertions: result.insertions,
      deletions: result.deletions,
      skippedLinks: result.skippedLinks
    }
  }

  async contextUsage(): Promise<ContextUsage> {
    if (!this.query) throw new Error('Chat has not started.')
    const usage = await this.query.getContextUsage({ detail: 'summary' })
    const context: ContextUsage = {
      used: usage.totalTokens,
      max: usage.maxTokens,
      percentage: usage.percentage,
      model: usage.model
    }
    this.state.context = context
    this.emitState()
    return context
  }

  async mcpStatus(): Promise<McpServerEntry[]> {
    if (!this.query) return []
    const servers = await this.query.mcpServerStatus()
    return servers.map((server) => ({
      name: server.name,
      scope:
        server.scope === 'user' || server.scope === 'project' || server.scope === 'local'
          ? server.scope
          : 'other',
      config: (server.config ?? {}) as Record<string, unknown>,
      status: server.status,
      source: server.source,
      tools: server.tools?.map((tool) => tool.name)
    }))
  }

  async toggleMcp(name: string, enabled: boolean): Promise<void> {
    if (!this.query) throw new Error('Chat has not started.')
    await this.query.toggleMcpServer(name, enabled)
  }

  async supportedCommands(): Promise<SlashCommandInfo[]> {
    if (!this.query) return []
    const commands = await this.query.supportedCommands()
    return commands.map((command) => ({
      name: command.name,
      description: command.description,
      argumentHint: command.argumentHint,
      aliases: command.aliases,
      builtin: command.builtin
    }))
  }

  respondPermission(
    id: string,
    decision: 'allow' | 'deny',
    always?: boolean,
    message?: string,
    answers?: Record<string, string | string[]>
  ): void {
    const pending = this.pending.get(id)
    if (!pending) return
    this.pending.delete(id)

    if (decision === 'allow') {
      if (pending.kind === 'question') {
        pending.resolve({
          behavior: 'allow',
          updatedInput: {
            ...pending.input,
            answers: answers || {}
          }
        })
        return
      }
      pending.resolve({
        behavior: 'allow',
        updatedInput: pending.input,
        updatedPermissions: always && pending.suggestions.length > 0
          ? pending.suggestions
          : undefined
      })
    } else {
      pending.resolve({
        behavior: 'deny',
        message: message || 'The user denied this action.'
      })
    }
  }

  async stop(): Promise<void> {
    this.generation += 1
    const queue = this.queue
    const activeQuery = this.query
    const abort = this.abort

    this.queue = null
    this.query = null
    this.abort = null

    queue?.end()
    for (const [id, pending] of this.pending) {
      pending.resolve({ behavior: 'deny', message: 'Chat ended.' })
      this.callbacks.emitPermissionCancel(id)
    }
    this.pending.clear()

    try {
      activeQuery?.close()
    } catch {
      // ignore
    }
    try {
      abort?.abort()
    } catch {
      // ignore
    }

    this.state.running = false
    this.state.connecting = false
    this.emitState()
  }

  private async consume(activeQuery: Query, generation: number): Promise<void> {
    try {
      for await (const message of activeQuery) {
        if (generation !== this.generation) return
        this.handleMessage(message)
      }
    } catch (error) {
      if (generation !== this.generation) return
      this.state.connecting = false
      this.state.running = false
      this.state.error = errorMessage(error)
      this.emitState()
    } finally {
      if (generation === this.generation) {
        this.state.connecting = false
        this.state.running = false
        this.emitState()
      }
    }
  }

  private handleMessage(message: SDKMessage): void {
    if ('session_id' in message && message.session_id) {
      this.state.sessionId = message.session_id
    }

    if (message.type === 'system' && message.subtype === 'init') {
      this.state.connecting = false
      this.state.cwd = message.cwd
      this.state.permissionMode = message.permissionMode
      if (message.model) this.state.model = message.model
      this.emitState()
      void this.refreshContextUsage()
    }

    if (message.type === 'result') {
      this.state.running = false
      this.state.connecting = false
      const usage = message.subtype === 'success' ? message.usage : undefined
      const stats: TurnStats = {
        costUsd: message.total_cost_usd,
        durationMs: message.duration_ms,
        inputTokens: usage?.input_tokens,
        outputTokens: usage?.output_tokens,
        cacheReadTokens: usage?.cache_read_input_tokens
      }
      this.state.stats = stats
      this.emitState()
      this.callbacks.onResult(message as unknown as DesktopEvent)
      void this.refreshContextUsage()
    }

    this.callbacks.emitEvent(message as unknown as DesktopEvent)
  }

  private async requestPermission(
    toolName: string,
    input: Record<string, unknown>,
    options: {
      signal: AbortSignal
      suggestions?: PermissionUpdate[]
      blockedPath?: string
      decisionReason?: string
      title?: string
      displayName?: string
      description?: string
      defaultToNo?: boolean
      suppressAlwaysAllowRule?: boolean
      toolUseID: string
    }
  ): Promise<PermissionResult> {
    const id = randomUUID()

    const suggestions: PermissionUpdate[] = (options.suggestions ?? []).map((suggestion) => ({
      ...suggestion,
      destination: 'session'
    })) as PermissionUpdate[]

    const kind =
      toolName === 'AskUserQuestion'
        ? 'question'
        : toolName === 'ExitPlanMode'
          ? 'plan'
          : 'permission'

    return new Promise<PermissionResult>((resolve) => {
      this.pending.set(id, { resolve, input, suggestions, kind })

      this.callbacks.emitPermission({
        id,
        kind,
        toolName,
        input,
        toolUseID: options.toolUseID,
        title:
          options.title ||
          (kind === 'question'
            ? '需要你的选择'
            : kind === 'plan'
              ? '计划已准备好'
              : undefined),
        displayName: options.displayName,
        description: options.description,
        decisionReason: options.decisionReason,
        blockedPath: options.blockedPath,
        suggestions,
        allowAlways:
          kind === 'permission' &&
          !options.suppressAlwaysAllowRule &&
          suggestions.length > 0,
        defaultToNo: options.defaultToNo
      })

      options.signal.addEventListener(
        'abort',
        () => {
          if (!this.pending.has(id)) return
          this.pending.delete(id)
          resolve({ behavior: 'deny', message: 'Operation cancelled.' })
          this.callbacks.emitPermissionCancel(id)
        },
        { once: true }
      )
    })
  }

  private async refreshContextUsage(): Promise<void> {
    const activeQuery = this.query
    if (!activeQuery) return
    const generation = this.generation
    try {
      const usage = await activeQuery.getContextUsage({ detail: 'summary' })
      if (generation !== this.generation) return
      this.state.context = {
        used: usage.totalTokens,
        max: usage.maxTokens,
        percentage: usage.percentage,
        model: usage.model
      }
      this.emitState()
    } catch {
      // context usage is best-effort
    }
  }

  private emitState(): void {
    this.callbacks.emitState(this.getState())
  }
}
