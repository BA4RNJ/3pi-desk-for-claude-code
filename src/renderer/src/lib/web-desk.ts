import type {
  Attachment,
  AttachmentFailure,
  AttachmentPickResult,
  DeskApi,
  DeskTabInput,
  RemoteSettings,
  RemoteSettingsPatch,
  RemoteStatus,
  RemoteTab,
  SettingsSnapshot
} from '../../../shared/types'
import { REMOTE_PROTOCOL_VERSION } from '../../../shared/remote'
import { DESK_METHOD_CHANNELS } from '../../../shared/desk-channels'
import { fileToAttachment } from './files'

export type WebDeskStatus = 'connecting' | 'login' | 'ready' | 'disconnected' | 'error'

type Listener = (data: unknown) => void

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function toast(text: string): void {
  try {
    const element = document.createElement('div')
    element.textContent = text
    element.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:28px',
      'transform:translateX(-50%)',
      'max-width:86vw',
      'padding:10px 14px',
      'border-radius:12px',
      'background:rgba(20,20,20,.9)',
      'color:#fff',
      'font:14px/1.4 system-ui,sans-serif',
      'z-index:99999',
      'pointer-events:none',
      'white-space:pre-wrap'
    ].join(';')
    document.body.appendChild(element)
    setTimeout(() => element.remove(), 2600)
  } catch {
    // ignore
  }
}

function download(name: string, content: string, type = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name || 'download.txt'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Browser implementation of `window.desk`. It speaks the same request/event
 * protocol as the desktop preload, but over WebSocket. The React renderer is
 * shared between Electron and the browser; only this transport differs.
 */
export class WebDesk {
  readonly api: DeskApi
  private ws: WebSocket | null = null
  private status: WebDeskStatus = 'connecting'
  private token: string | null = null
  private pairingCode: string | null = null
  private deviceName = ''
  private pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: number }
  >()
  private listeners = new Map<string, Set<Listener>>()
  private statusListeners = new Set<(status: WebDeskStatus, error?: string) => void>()
  private readyWaiters: Array<{ resolve: () => void; reject: (error: Error) => void }> = []
  private ready = false
  private reconnectTimer: number | null = null
  private reconnectDelay = 500
  private lastError = ''
  private cachedDefaults: Record<string, unknown> | null = null
  private cachedSettings: SettingsSnapshot | null = null
  private cachedTabs: RemoteTab[] = []
  private cachedCli: unknown = null

  constructor() {
    try {
      this.token = localStorage.getItem('3pi-remote-token')
    } catch {
      this.token = null
    }
    try {
      const url = new URL(window.location.href)
      const pair = url.searchParams.get('pair')?.trim()
      if (pair) {
        this.pairingCode = pair
        url.searchParams.delete('pair')
        window.history.replaceState({}, '', url.pathname + url.search + url.hash)
      }
    } catch {
      // ignore
    }
    try {
      this.deviceName =
        localStorage.getItem('3pi-remote-device') ||
        `${navigator.platform || '浏览器'} ${navigator.userAgent.slice(0, 40)}`
      localStorage.setItem('3pi-remote-device', this.deviceName)
    } catch {
      this.deviceName = '浏览器'
    }
    this.api = this.createApi()
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.ws?.readyState !== WebSocket.OPEN) {
        this.reconnectDelay = 500
        this.connect()
      }
    })
  }

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }
    this.setStatus(this.pairingCode || this.token ? 'connecting' : 'login')
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
    let socket: WebSocket
    try {
      socket = new WebSocket(`${scheme}://${location.host}/ws`)
    } catch (error) {
      this.setStatus('error', error instanceof Error ? error.message : String(error))
      this.scheduleReconnect()
      return
    }
    this.ws = socket
    socket.addEventListener('open', () => {
      this.reconnectDelay = 500
      if (this.pairingCode) {
        const code = this.pairingCode
        this.pairingCode = null
        this.sendRaw({
          v: REMOTE_PROTOCOL_VERSION,
          type: 'pair',
          code,
          device: { name: this.deviceName }
        })
      } else if (this.token) {
        this.sendRaw({ v: REMOTE_PROTOCOL_VERSION, type: 'resume', token: this.token })
      } else {
        this.setStatus('login')
      }
    })
    socket.addEventListener('message', (event) => this.handleMessage(event.data))
    socket.addEventListener('close', () => {
      this.ws = null
      this.ready = false
      for (const waiter of this.readyWaiters.splice(0)) {
        waiter.reject(new Error('连接已断开。'))
      }
      for (const [, entry] of this.pending) {
        window.clearTimeout(entry.timer)
        entry.reject(new Error('连接已断开。'))
      }
      this.pending.clear()
      this.setStatus(this.token ? 'disconnected' : 'login')
      if (this.token) this.scheduleReconnect()
    })
    socket.addEventListener('error', () => {
      // close follows
    })
  }

  async login(username: string, password: string): Promise<void> {
    this.connect()
    await this.waitOpen()
    this.sendRaw({
      v: REMOTE_PROTOCOL_VERSION,
      type: 'login',
      username,
      password,
      device: { name: this.deviceName }
    })
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('登录超时。')), 20_000)
      const off = this.onStatus((status, error) => {
        if (status === 'ready') {
          window.clearTimeout(timer)
          off()
          resolve()
        } else if (status === 'error') {
          window.clearTimeout(timer)
          off()
          reject(new Error(error || '登录失败。'))
        }
      })
    })
  }

  logout(): void {
    this.token = null
    try {
      localStorage.removeItem('3pi-remote-token')
    } catch {
      // ignore
    }
    this.ready = false
    this.ws?.close()
    this.ws = null
    this.setStatus('login')
  }

  onStatus(callback: (status: WebDeskStatus, error?: string) => void): () => void {
    this.statusListeners.add(callback)
    callback(this.status, this.lastError || undefined)
    return () => this.statusListeners.delete(callback)
  }

  private createApi(): DeskApi {
    const api = new Proxy({} as DeskApi, {
      get: (_target, property) => {
        if (typeof property !== 'string' || property === 'then' || property === 'toJSON') {
          return undefined
        }
        const override = (this as unknown as Record<string, unknown>)[property]
        if (typeof override === 'function') {
          return (override as (...args: unknown[]) => unknown).bind(this)
        }
        if (property.startsWith('on')) {
          return (callback: Listener) => this.subscribe(property, callback)
        }
        const channel = DESK_METHOD_CHANNELS[property]
        return (...args: unknown[]) => this.call(channel || property, args)
      }
    })
    return api
  }

  private subscribe(event: string, callback: Listener): () => void {
    const channel = event
      .replace(/^on/, '')
      .replace(/^[A-Z]/, (value) => value.toLowerCase())
      .replace(/[A-Z]/g, (value) => `:${value.toLowerCase()}`)
    // The mapping above turns onTabsChanged -> tabs:changed, onEvent -> event,
    // etc. The explicit aliases below cover the names that do not follow it.
    const aliases: Record<string, string> = {
      event: 'session:event',
      state: 'session:state',
      permission: 'permission:request',
      permissionCancel: 'permission:cancel',
      claudeCliStatus: 'claude-cli:status',
      tabsChanged: 'tabs:changed',
      userMessage: 'desk:user-message',
      settingsChanged: 'settings:changed',
      sessionsChanged: 'sessions:changed',
      newTabRequest: 'app:new-tab',
      openSettingsRequest: 'app:open-settings'
    }
    const resolved = aliases[event.replace(/^on/, '').replace(/^[A-Z]/, (v) => v.toLowerCase())]
    const target = resolved || channel
    const set = this.listeners.get(target) || new Set<Listener>()
    set.add(callback)
    this.listeners.set(target, set)
    return () => set.delete(callback)
  }

  private emit(channel: string, data: unknown): void {
    for (const callback of this.listeners.get(channel) || []) {
      try {
        callback(data)
      } catch {
        // ignore
      }
    }
  }

  private async call(method: string, args: unknown[]): Promise<unknown> {
    await this.waitReady()
    const id = newId()
    return await new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('请求超时。'))
      }, 60_000)
      this.pending.set(id, { resolve, reject, timer })
      this.sendRaw({ v: REMOTE_PROTOCOL_VERSION, id, method, args })
    })
  }

  private waitReady(): Promise<void> {
    if (this.ready) return Promise.resolve()
    if (!this.token) return Promise.reject(new Error('请先登录远程访问。'))
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        const index = this.readyWaiters.findIndex((item) => item.resolve === resolve)
        if (index >= 0) this.readyWaiters.splice(index, 1)
        reject(new Error('无法连接桌面端。'))
      }, 15_000)
      this.readyWaiters.push({
        resolve: () => {
          window.clearTimeout(timer)
          resolve()
        },
        reject: (error) => {
          window.clearTimeout(timer)
          reject(error)
        }
      })
    })
  }

  private waitOpen(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const socket = this.ws
      if (!socket) {
        reject(new Error('无法连接桌面端。'))
        return
      }
      const timer = window.setTimeout(() => reject(new Error('连接超时。')), 15_000)
      socket.addEventListener(
        'open',
        () => {
          window.clearTimeout(timer)
          resolve()
        },
        { once: true }
      )
    })
  }

  private sendRaw(message: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify(message))
  }

  private handleMessage(raw: unknown): void {
    let message: Record<string, unknown>
    try {
      message = JSON.parse(String(raw)) as Record<string, unknown>
    } catch {
      return
    }
    if (message.type === 'ready') {
      const token = String(message.token || '')
      if (token) {
        this.token = token
        try {
          localStorage.setItem('3pi-remote-token', token)
        } catch {
          // ignore
        }
      }
      const snapshot = message.snapshot as {
        defaults?: Record<string, unknown>
        settings?: SettingsSnapshot
        tabs?: RemoteTab[]
        claudeCli?: unknown
      }
      if (snapshot?.defaults) this.cachedDefaults = snapshot.defaults
      if (snapshot?.settings) this.cachedSettings = snapshot.settings
      if (Array.isArray(snapshot?.tabs)) this.cachedTabs = snapshot.tabs
      if (snapshot?.claudeCli !== undefined) this.cachedCli = snapshot.claudeCli
      this.ready = true
      this.lastError = ''
      this.setStatus('ready')
      for (const waiter of this.readyWaiters.splice(0)) waiter.resolve()
      if (Array.isArray(snapshot?.tabs)) {
        this.emit('tabs:changed', { tabs: snapshot.tabs })
      }
      if (snapshot?.settings) this.emit('settings:changed', snapshot.settings)
      if (snapshot?.claudeCli) this.emit('claude-cli:status', snapshot.claudeCli)
      return
    }
    if (message.type === 'error') {
      const error = (message.error || {}) as { message?: string; code?: string }
      const text = error.message || '远程访问出错。'
      this.lastError = text
      if (error.code === 'unauthorized' && !this.ready) {
        this.token = null
        try {
          localStorage.removeItem('3pi-remote-token')
        } catch {
          // ignore
        }
      }
      this.setStatus('error', text)
      for (const waiter of this.readyWaiters.splice(0)) waiter.reject(new Error(text))
      return
    }
    if (typeof message.id === 'string') {
      const entry = this.pending.get(message.id)
      if (!entry) return
      this.pending.delete(message.id)
      window.clearTimeout(entry.timer)
      if (message.error) {
        entry.reject(
          new Error(
            ((message.error as { message?: string }).message || '请求失败。') as string
          )
        )
      } else {
        entry.resolve(message.result)
      }
      return
    }
    if (typeof message.event === 'string') {
      this.emit(message.event, message.data)
    }
  }

  private setStatus(status: WebDeskStatus, error?: string): void {
    this.status = status
    if (error !== undefined) this.lastError = error
    for (const callback of this.statusListeners) {
      try {
        callback(status, this.lastError || undefined)
      } catch {
        // ignore
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.7, 8000)
      this.connect()
    }, this.reconnectDelay)
  }

  // --- DeskApi methods that are implemented in the browser -----------------

  async getDefaults(): Promise<Record<string, unknown>> {
    if (this.cachedDefaults) return { ...this.cachedDefaults, runtime: 'web' }
    return (await this.call('defaults:get', [])) as Record<string, unknown>
  }

  async getSettings(): Promise<SettingsSnapshot> {
    if (this.cachedSettings) return this.cachedSettings
    return (await this.call('settings:get', [])) as SettingsSnapshot
  }

  async getClaudeCliStatus(refresh = false): Promise<unknown> {
    if (!refresh && this.cachedCli) return this.cachedCli
    return await this.call('claudeCli:status', [refresh])
  }

  async listTabs(): Promise<RemoteTab[]> {
    if (this.cachedTabs.length > 0) return this.cachedTabs
    return (await this.call('tabs:list', [])) as RemoteTab[]
  }

  async createTab(tab: DeskTabInput): Promise<RemoteTab> {
    return (await this.call('tabs:create', [tab])) as RemoteTab
  }

  async closeTab(tabId: string): Promise<void> {
    await this.call('tabs:close', [tabId])
  }

  async renameTab(tabId: string, title: string): Promise<RemoteTab | null> {
    return (await this.call('tabs:rename', [tabId, title])) as RemoteTab | null
  }

  async snapshotTab(tabId: string): Promise<RemoteTab | null> {
    return (await this.call('tabs:snapshot', [tabId])) as RemoteTab | null
  }

  async getRemoteSettings(): Promise<RemoteSettings> {
    return (await this.call('remote:get', [])) as RemoteSettings
  }

  async saveRemoteSettings(patch: RemoteSettingsPatch): Promise<RemoteSettings> {
    return (await this.call('remote:save', [patch])) as RemoteSettings
  }

  async getRemoteStatus(): Promise<RemoteStatus> {
    return (await this.call('remote:status', [])) as RemoteStatus
  }

  async startTunnel(
    mode: 'quick' | 'named',
    options?: { name?: string; configPath?: string; hostname?: string }
  ): Promise<RemoteStatus> {
    return (await this.call('remote:startTunnel', [mode, options])) as RemoteStatus
  }

  async stopTunnel(): Promise<RemoteStatus> {
    return (await this.call('remote:stopTunnel', [])) as RemoteStatus
  }

  async downloadCloudflared(): Promise<RemoteStatus> {
    return (await this.call('remote:downloadCloudflared', [])) as RemoteStatus
  }

  async getDiagnosticsText(): Promise<string> {
    return (await this.call('diagnostics:text', [])) as string
  }

  async pickFiles(): Promise<AttachmentPickResult> {
    return await new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = true
      input.style.display = 'none'
      input.addEventListener('change', async () => {
        const attachments: Attachment[] = []
        const errors: AttachmentFailure[] = []
        for (const file of Array.from(input.files || [])) {
          const result = await fileToAttachment(file)
          if (result.attachment) attachments.push(result.attachment)
          else errors.push({ name: file.name, reason: result.reason || 'unreadable' })
        }
        input.remove()
        resolve({ attachments, errors })
      })
      document.body.appendChild(input)
      input.click()
    })
  }

  async saveExport(defaultName: string, content: string): Promise<string | null> {
    download(defaultName, content, 'text/markdown;charset=utf-8')
    return defaultName
  }

  async pickDirectory(defaultPath?: string): Promise<string | null> {
    const value = window.prompt('输入项目目录的绝对路径', defaultPath || '')
    return value?.trim() || null
  }

  async exportBackup(name: string): Promise<string | null> {
    const content = (await this.call('backups:read', [name])) as string
    download(name, content, 'application/jsonl;charset=utf-8')
    return name
  }

  async exportDiagnostics(): Promise<string | null> {
    const content = await this.getDiagnosticsText()
    const name = `3pi-desk-diagnostics-${new Date().toISOString().slice(0, 10)}.txt`
    download(name, content)
    return name
  }

  async openPath(path: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(path)
      toast(`路径已复制：${path}`)
    } catch {
      toast(`路径：${path}`)
    }
  }

  async openBackupDir(): Promise<void> {
    toast('备份目录位于电脑端应用数据目录的 session-backups 文件夹。')
  }

  async openConsole(providerId?: string): Promise<void> {
    try {
      await this.call('open:console', [providerId])
      toast('已在电脑端打开服务商控制台。')
    } catch {
      toast('无法打开控制台。')
    }
  }

  async pickClaudeCli(): Promise<unknown> {
    const value = window.prompt('输入 Claude Code CLI 的绝对路径（留空取消）', '')
    if (!value?.trim()) return null
    return await this.call('claudeCli:setPath', [value.trim()])
  }

  onNewTabRequest(): () => void {
    return () => undefined
  }

  onOpenSettingsRequest(): () => void {
    return () => undefined
  }
}

export const webDesk = new WebDesk()

export function installWebDesk(): void {
  if (!window.desk) {
    window.desk = webDesk.api
  }
  webDesk.connect()
}
