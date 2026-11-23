import type {
  AppDefaults,
  Attachment,
  ClaudeCliStatus,
  DeskTabInput,
  DesktopEvent,
  EffortSetting,
  PermissionRequestPayload,
  PermissionResponsePayload,
  RemoteStatus,
  RemoteTab,
  SendMessagePayload,
  SessionState,
  SettingsSnapshot,
  SlashCommandInfo,
  TabTask
} from '../shared/types'
import { isDesktopOnlyMethod } from '../shared/remote'

export interface HubClient {
  id: string
  kind: 'electron' | 'remote'
  deviceName?: string
  ip?: string
  send: (channel: string, payload: unknown) => void
  close?: () => void
}

export interface DeskHubOptions {
  invoke: (method: string, args: unknown[]) => Promise<unknown>
  hasSession: (tabId: string) => boolean
  getSessionState: (tabId: string) => SessionState | undefined
  getDefaults: () => AppDefaults
  getSettings: () => SettingsSnapshot
  getRemoteStatus: () => RemoteStatus
  getClaudeCliStatus: () => ClaudeCliStatus | null
  sendMessage: (tabId: string, payload: SendMessagePayload) => Promise<void>
  respondPermission: (tabId: string, response: PermissionResponsePayload) => void
  isPathAllowed?: (path: string) => boolean
  log?: (line: string) => void
}

interface DeskTab {
  id: string
  cwd: string
  title: string
  sessionId?: string
  started: boolean
  state: SessionState
  permissions: PermissionRequestPayload[]
  tasks: TabTask[]
  effort: EffortSetting
  commands: SlashCommandInfo[]
  workElapsedMs: number
  workStartedAt?: number
  liveEvents: DesktopEvent[]
  liveBytes: number
  liveTruncated: boolean
}

const MAX_LIVE_BYTES = 8 * 1024 * 1024
const DEFAULT_MODEL = 'deepseek-v4.1-flash'
const DEFAULT_TITLE = '新对话'

function defaultState(cwd: string): SessionState {
  return {
    running: false,
    connecting: false,
    cwd,
    model: DEFAULT_MODEL,
    permissionMode: 'default',
    effort: 'default',
    pendingTurns: 0
  }
}

function taskFromEvent(message: DesktopEvent): TabTask | null {
  if (message.type !== 'system' || message.ambient) return null
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

/**
 * Owns the shared tab registry and fans session events out to every client
 * (the Electron window and any number of remote browsers). Session state
 * itself stays in `SessionManager`; the hub only keeps the presentation
 * snapshot needed by late-joining clients.
 */
export class DeskHub {
  private readonly tabs = new Map<string, DeskTab>()
  private readonly clients = new Set<HubClient>()
  private readonly options: DeskHubOptions

  constructor(options: DeskHubOptions) {
    this.options = options
  }

  registerClient(client: HubClient): void {
    this.clients.add(client)
    client.send('tabs:changed', { tabs: this.listTabs() })
  }

  unregisterClient(client: HubClient): void {
    this.clients.delete(client)
  }

  get clientCount(): number {
    return this.clients.size
  }

  listClients(): HubClient[] {
    return [...this.clients]
  }

  broadcast(channel: string, payload: unknown): void {
    for (const client of this.clients) {
      try {
        client.send(channel, payload)
      } catch {
        // A broken client must not take down the broadcast loop.
      }
    }
  }

  sendTo(client: HubClient, channel: string, payload: unknown): void {
    try {
      client.send(channel, payload)
    } catch {
      // ignore
    }
  }

  listTabs(): RemoteTab[] {
    return [...this.tabs.values()].map((tab) => this.toRemoteTab(tab, false))
  }

  /** Snapshot for a new connection: running tabs include their current turn. */
  listTabsWithLive(): RemoteTab[] {
    return [...this.tabs.values()].map((tab) => this.toRemoteTab(tab, true))
  }

  snapshotTab(tabId: string): RemoteTab | null {
    const tab = this.tabs.get(tabId)
    return tab ? this.toRemoteTab(tab, true) : null
  }

  snapshot(defaults: AppDefaults, settings: SettingsSnapshot): {
    defaults: AppDefaults
    settings: SettingsSnapshot
    tabs: RemoteTab[]
    remote: RemoteStatus
  } {
    return {
      defaults,
      settings,
      tabs: this.listTabs(),
      remote: this.options.getRemoteStatus()
    }
  }

  createTab(input: DeskTabInput): RemoteTab {
    const existing = this.tabs.get(input.id)
    if (existing) {
      if (input.cwd) existing.cwd = input.cwd
      if (input.title) existing.title = input.title
      if (input.sessionId) existing.sessionId = input.sessionId
      this.broadcastTabs()
      return this.toRemoteTab(existing, false)
    }
    const tab: DeskTab = {
      id: input.id,
      cwd: input.cwd,
      title: input.title || DEFAULT_TITLE,
      sessionId: input.sessionId,
      started: this.options.hasSession(input.id),
      state: this.options.getSessionState(input.id) || defaultState(input.cwd),
      permissions: [],
      tasks: [],
      effort: 'default',
      commands: [],
      workElapsedMs: 0,
      liveEvents: [],
      liveBytes: 0,
      liveTruncated: false
    }
    this.tabs.set(tab.id, tab)
    this.broadcastTabs()
    return this.toRemoteTab(tab, false)
  }

  async closeTab(tabId: string): Promise<void> {
    const tab = this.tabs.get(tabId)
    if (!tab) return
    try {
      await this.options.invoke('session:stop', [tabId])
    } catch {
      // The session may already be stopped; the tab should still close.
    }
    this.tabs.delete(tabId)
    this.broadcastTabs()
  }

  renameTab(tabId: string, title: string): RemoteTab | null {
    const tab = this.tabs.get(tabId)
    if (!tab) return null
    const next = title.trim()
    if (!next || tab.title === next) return this.toRemoteTab(tab, false)
    tab.title = next
    this.broadcastTabs()
    return this.toRemoteTab(tab, false)
  }

  onSessionEvent(tabId: string, message: DesktopEvent): void {
    const existed = this.tabs.has(tabId)
    const tab = this.ensureTab(tabId)
    if (!existed) this.broadcastTabs()
    const size = Buffer.byteLength(JSON.stringify(message))
    if (tab.liveBytes + size <= MAX_LIVE_BYTES) {
      tab.liveEvents.push(message)
      tab.liveBytes += size
    } else {
      tab.liveTruncated = true
    }
    const task = taskFromEvent(message)
    if (task) {
      const existing = tab.tasks.find((item) => item.id === task.id)
      if (existing) Object.assign(existing, task)
      else tab.tasks.push(task)
    }
    if (message.type === 'result') {
      this.broadcast('sessions:changed', { cwd: tab.cwd })
    }
    this.broadcast('session:event', { tabId, message })
  }

  onSessionState(tabId: string, state: SessionState): void {
    const existed = this.tabs.has(tabId)
    const tab = this.ensureTab(tabId)
    if (!existed) this.broadcastTabs()
    const wasStarted = tab.started
    const wasRunning = tab.state.running
    tab.state = state
    tab.sessionId = state.sessionId || tab.sessionId
    tab.effort = state.effort || tab.effort
    tab.started = this.options.hasSession(tabId)
    if (!wasRunning && state.running) {
      tab.workStartedAt = Date.now()
    } else if (wasRunning && !state.running) {
      if (tab.workStartedAt) {
        tab.workElapsedMs += Math.max(0, Date.now() - tab.workStartedAt)
      }
      tab.workStartedAt = undefined
    }
    this.broadcast('session:state', { tabId, state })
    if (wasStarted !== tab.started) this.broadcastTabs()
  }

  onPermission(tabId: string, request: PermissionRequestPayload): void {
    const existed = this.tabs.has(tabId)
    const tab = this.ensureTab(tabId)
    if (!existed) this.broadcastTabs()
    if (!tab.permissions.some((item) => item.id === request.id)) {
      tab.permissions = [...tab.permissions, request]
    }
    this.broadcast('permission:request', { tabId, request })
  }

  onPermissionCancel(tabId: string, id: string): void {
    const tab = this.tabs.get(tabId)
    if (tab) {
      tab.permissions = tab.permissions.filter((item) => item.id !== id)
    }
    this.broadcast('permission:cancel', { tabId, id })
  }

  async sendMessage(
    tabId: string,
    payload: SendMessagePayload,
    source: 'electron' | 'remote' = 'electron'
  ): Promise<void> {
    let tab = this.tabs.get(tabId)
    if (!tab) {
      tab = this.ensureTab(tabId)
      this.broadcastTabs()
    }
    tab.liveEvents = []
    tab.liveBytes = 0
    tab.liveTruncated = false
    await this.options.sendMessage(tabId, payload)
    if (!tab.title || tab.title === DEFAULT_TITLE) {
      const text = String(payload.text || '').trim()
      if (text) {
        tab.title = text.length > 42 ? `${text.slice(0, 42)}…` : text
        this.broadcastTabs()
      }
    }
    this.broadcast('desk:user-message', {
      tabId,
      source,
      message: {
        uuid: payload.uuid || '',
        text: String(payload.text || ''),
        attachments: payload.attachments,
        ts: Date.now()
      }
    })
  }

  respondPermission(tabId: string, response: PermissionResponsePayload): void {
    const tab = this.tabs.get(tabId)
    if (tab && !tab.permissions.some((item) => item.id === response.id)) return
    this.options.respondPermission(tabId, response)
    if (tab && response.id) {
      tab.permissions = tab.permissions.filter((item) => item.id !== response.id)
      this.broadcast('permission:cancel', { tabId, id: response.id })
    }
  }

  async request(method: string, args: unknown[], client: HubClient): Promise<unknown> {
    if (client.kind === 'remote') this.assertRemotePaths(method, args)
    switch (method) {
      case 'tabs:list':
        return this.listTabs()
      case 'tabs:create':
        return this.createTab((args[0] || {}) as DeskTabInput)
      case 'tabs:close':
        await this.closeTab(String(args[0] || ''))
        return null
      case 'tabs:rename':
        return this.renameTab(String(args[0] || ''), String(args[1] || ''))
      case 'tabs:snapshot':
        return this.snapshotTab(String(args[0] || ''))
      case 'session:start': {
        const tabId = String(args[0] || '')
        const options = (args[1] || {}) as { cwd?: string; resume?: string }
        this.ensureTab(tabId, options.cwd || '', options.resume)
        // Tell other clients about the tab before the manager emits its first
        // state/events; otherwise a late-created desktop tab would drop them.
        this.broadcastTabs()
        const result = await this.options.invoke(method, args)
        const tab = this.ensureTab(tabId, options.cwd || '')
        tab.cwd = options.cwd || tab.cwd
        tab.started = true
        if (result && typeof result === 'object') {
          this.onSessionState(tabId, result as SessionState)
        }
        this.broadcastTabs()
        return result
      }
      case 'session:send': {
        const tabId = String(args[0] || '')
        const payload = (args[1] || {}) as SendMessagePayload
        await this.sendMessage(tabId, payload, client.kind === 'remote' ? 'remote' : 'electron')
        return null
      }
      case 'session:stop': {
        const tabId = String(args[0] || '')
        await this.options.invoke(method, args)
        const tab = this.tabs.get(tabId)
        if (tab) {
          tab.started = false
          tab.state = { ...tab.state, running: false, connecting: false, pendingTurns: 0 }
          this.broadcastTabs()
        }
        return null
      }
      case 'permission:respond': {
        const tabId = String(args[0] || '')
        const response = (args[1] || {}) as PermissionResponsePayload
        this.respondPermission(tabId, response)
        return null
      }
      case 'defaults:get': {
        const result = (await this.options.invoke(method, args)) as AppDefaults
        return {
          ...result,
          runtime: client.kind === 'remote' ? 'web' : 'electron'
        }
      }
      case 'settings:get':
        return this.options.invoke(method, args)
      case 'settings:saveApi':
      case 'settings:saveApiProfile':
      case 'settings:deleteApiProfile':
      case 'settings:applyApiProfile':
      case 'settings:savePreferences':
      case 'settings:savePermissionRules':
      case 'settings:saveCustomModel':
      case 'settings:deleteCustomModel':
      case 'settings:saveWebSearch':
      case 'sessions:rename':
      case 'sessions:delete':
      case 'sessions:tag':
      case 'sessions:fork':
      case 'sessions:copy':
        // The IPC handlers broadcast settings:changed / sessions:changed
        // themselves, so both desktop and remote callers share one path.
        return this.options.invoke(method, args)
      case 'claudeCli:download':
      case 'claudeCli:setPath': {
        const result = await this.options.invoke(method, args)
        this.broadcast('claude-cli:status', result)
        return result
      }
      default:
        if (isDesktopOnlyMethod(method)) {
          throw new Error('该操作只能在桌面端完成。')
        }
        return this.options.invoke(method, args)
    }
  }

  private assertRemotePaths(method: string, args: unknown[]): void {
    const allowed = this.options.isPathAllowed
    if (!allowed) return
    const cwdArgs: Record<string, number[]> = {
      'sessions:list': [0],
      'sessions:messages': [1],
      'sessions:rename': [2],
      'sessions:delete': [1],
      'sessions:tag': [2],
      'sessions:fork': [1],
      'sessions:copy': [1, 2],
      'files:search': [0],
      'files:searchContent': [0],
      'files:tree': [0],
      'files:read': [0],
      'files:write': [0],
      'git:status': [0],
      'git:diff': [0],
      'extensions:list': [0],
      'extensions:readMcp': [1],
      'extensions:saveMcp': [1],
      'extensions:readHooks': [1],
      'extensions:saveHooks': [1],
      'extensions:readFile': [1],
      'extensions:writeFile': [2],
      'extensions:createFile': [2],
      'extensions:deleteFile': [1],
      'extensions:marketplaces': [0],
      'extensions:marketplaceAdd': [1],
      'extensions:marketplaceUpdate': [1],
      'extensions:marketplaceRemove': [1],
      'extensions:pluginAction': [2],
      'extensions:togglePlugin': [2],
      'background:start': [0],
      'workspace:exists': [0],
      'workspace:relocate': [0, 1]
    }
    const check = (value: unknown): void => {
      if (typeof value !== 'string' || !value) return
      if (!allowed(value)) {
        throw new Error(`远程访问不允许访问该路径：${value}`)
      }
    }
    for (const index of cwdArgs[method] || []) check(args[index])
    if (method === 'session:start') {
      check((args[1] as { cwd?: string } | undefined)?.cwd)
    }
  }

  private ensureTab(tabId: string, cwd = '', sessionId?: string): DeskTab {
    const existing = this.tabs.get(tabId)
    if (existing) {
      if (cwd) existing.cwd = cwd
      if (sessionId) existing.sessionId = sessionId
      return existing
    }
    const tab: DeskTab = {
      id: tabId,
      cwd,
      title: DEFAULT_TITLE,
      sessionId,
      started: this.options.hasSession(tabId),
      state: this.options.getSessionState(tabId) || defaultState(cwd),
      permissions: [],
      tasks: [],
      effort: 'default',
      commands: [],
      workElapsedMs: 0,
      liveEvents: [],
      liveBytes: 0,
      liveTruncated: false
    }
    this.tabs.set(tabId, tab)
    return tab
  }

  private broadcastTabs(): void {
    this.broadcast('tabs:changed', { tabs: this.listTabs() })
  }

  private toRemoteTab(tab: DeskTab, includeLive: boolean): RemoteTab {
    const state = this.options.getSessionState(tab.id) || tab.state
    return {
      id: tab.id,
      cwd: tab.cwd,
      title: tab.title,
      sessionId: tab.sessionId,
      started: tab.started || this.options.hasSession(tab.id),
      state,
      permissions: tab.permissions.slice(),
      tasks: tab.tasks.slice(),
      effort: tab.effort,
      usage: undefined,
      commands: tab.commands.slice(),
      workElapsedMs: tab.workElapsedMs,
      workStartedAt: tab.workStartedAt,
      liveEvents:
        includeLive && (state.running || state.connecting || (state.pendingTurns || 0) > 0)
          ? tab.liveEvents.slice()
          : undefined,
      liveTruncated: includeLive ? tab.liveTruncated : undefined
    }
  }
}
