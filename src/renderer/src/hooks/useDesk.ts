import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ApiSettings,
  ApiSettingsPatch,
  AppDefaults,
  AppPreferences,
  Attachment,
  ChatSettingsSnapshot,
  ClaudeCliStatus,
  CustomModel,
  DesktopEvent,
  EffortSetting,
  FileEntry,
  ModelOption,
  PermissionMode,
  PermissionRequestPayload,
  PreferencesPatch,
  RewindPreview,
  SessionInfo,
  SessionStartOptions,
  SessionState,
  SettingsSnapshot,
  TestApiResult
} from '../../../shared/types'
import { isNewerState, stateRevision } from '../../../shared/sessionState'
import type {
  TabRuntimeData,
  TabTask,
  TabView,
  ThemeMode,
  TokenUsage,
  UIMessage
} from '../types'
import {
  applyEvent,
  applyStreamEvent,
  bindRewind,
  historyToMessages,
  markToolStatus,
  newId,
  usageFromHistory
} from '../lib/messages'
import { truncate } from '../lib/format'
import { mergeUsage } from '../lib/usage'
import { messagesToMarkdown, safeFileName } from '../lib/export'
import { initialLanguage, setI18nLanguage, type Language } from '../i18n'

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

export const PERMISSION_OPTIONS: Array<{
  id: PermissionMode
  label: string
  description: string
  danger?: boolean
}> = [
  { id: 'default', label: '每次询问', description: '执行工具前请求确认' },
  { id: 'acceptEdits', label: '自动接受编辑', description: '文件修改无需确认' },
  { id: 'plan', label: '计划模式', description: '只分析，不执行修改' },
  {
    id: 'bypassPermissions',
    label: '跳过所有确认',
    description: '危险：所有工具直接执行',
    danger: true
  }
]

export const EFFORT_OPTIONS: Array<{ id: EffortSetting; label: string }> = [
  { id: 'default', label: '默认' },
  { id: 'low', label: '低' },
  { id: 'medium', label: '中' },
  { id: 'high', label: '高' },
  { id: 'xhigh', label: '极高' },
  { id: 'max', label: '最大' }
]

const FALLBACK_COMMANDS = [
  { name: 'compact', description: '压缩当前上下文', argumentHint: '[instructions]' },
  { name: 'clear', description: '清空当前会话上下文' },
  { name: 'status', description: '查看当前会话状态' },
  { name: 'context', description: '查看上下文占用明细' },
  { name: 'cost', description: '查看本次会话用量与费用' },
  { name: 'init', description: '为项目生成 CLAUDE.md' },
  { name: 'review', description: '审查当前改动或 PR' },
  { name: 'export', description: '导出当前对话' },
  { name: 'rewind', description: '回退文件或对话' },
  { name: 'model', description: '查看或切换模型' },
  { name: 'mcp', description: '查看 MCP 服务器状态' },
  { name: 'agents', description: '查看子代理' },
  { name: 'skills', description: '查看可用技能' },
  { name: 'hooks', description: '查看已配置 Hooks' },
  { name: 'doctor', description: '检查引擎安装状态' },
  { name: 'help', description: '查看帮助' }
]

const EMPTY_STATE: SessionState = {
  running: false,
  connecting: false,
  cwd: '',
  model: 'deepseek-v4.1-flash',
  permissionMode: 'default',
  effort: 'default'
}

function initialTheme(): ThemeMode {
  const saved = localStorage.getItem('claude-desk-theme')
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  return 'system'
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function fallbackModelsFor(providerId?: string): ModelOption[] {
  return providerId === 'opencode-go' ? FALLBACK_MODELS : []
}

function toView(tab: TabRuntimeData): TabView {
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
    commands: tab.commands.slice()
  }
}

function emptyTab(
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
    started: false,
    streamIds: new Map()
  }
}

function taskFromEvent(message: DesktopEvent): TabTask | null {
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

export function useDesk() {
  const [booted, setBooted] = useState(false)
  const [defaults, setDefaults] = useState<AppDefaults | null>(null)
  const [settings, setSettings] = useState<SettingsSnapshot | null>(null)
  const [models, setModels] = useState<ModelOption[]>(FALLBACK_MODELS)
  const [cwd, setCwd] = useState('')
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [tabs, setTabs] = useState<Record<string, TabView>>({})
  const [tabOrder, setTabOrder] = useState<string[]>([])
  const [activeTabId, setActiveTabIdState] = useState('')
  const [language, setLanguageState] = useState<Language>(initialLanguage)
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<SessionInfo | null>(null)
  const [claudeCli, setClaudeCli] = useState<ClaudeCliStatus | null>(null)

  const tabsRef = useRef(new Map<string, TabRuntimeData>())
  const tabOrderRef = useRef<string[]>([])
  const activeTabIdRef = useRef('')
  const sessionsRef = useRef<SessionInfo[]>([])
  const cwdRef = useRef('')
  const settingsRef = useRef<SettingsSnapshot | null>(null)
  const modelsRef = useRef<ModelOption[]>(FALLBACK_MODELS)
  const publishTimers = useRef(new Map<string, number>())
  const stateRevisions = useRef(new Map<string, number>())
  const startingTabs = useRef(new Set<string>())
  const chatSettingsQueue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    const root = document.documentElement
    const preferences = settings?.preferences
    if (preferences) {
      root.dataset.accent = preferences.accent || 'coral'
      root.dataset.compact = preferences.compactMode ? 'true' : 'false'
      root.style.setProperty('--ui-scale', String(preferences.fontScale || 1))
    }
  }, [settings?.preferences])

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      root.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    media.addEventListener('change', apply)
    localStorage.setItem('claude-desk-theme', theme)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  const applyState = useCallback((tab: TabRuntimeData, state: SessionState): boolean => {
    const previous = stateRevisions.current.get(tab.id)
    if (!isNewerState(previous, state)) return false
    const revision = stateRevision(state)
    if (revision !== undefined) stateRevisions.current.set(tab.id, revision)
    tab.state = state
    tab.sessionId = state.sessionId || tab.sessionId
    tab.effort = state.effort
    return true
  }, [])

  const publish = useCallback((tab: TabRuntimeData) => {
    setTabs((previous) => ({ ...previous, [tab.id]: toView(tab) }))
  }, [])

  const schedulePublish = useCallback(
    (tab: TabRuntimeData) => {
      if (publishTimers.current.has(tab.id)) return
      const timer = window.setTimeout(() => {
        publishTimers.current.delete(tab.id)
        publish(tab)
      }, 40)
      publishTimers.current.set(tab.id, timer)
    },
    [publish]
  )

  const refreshSessions = useCallback(
    async (directory?: string) => {
      const active = tabsRef.current.get(activeTabIdRef.current)
      const target = directory || active?.cwd || cwdRef.current
      if (!target) return
      try {
        const hidden = new Set(settingsRef.current?.preferences.hiddenSessions || [])
        const list = (await window.desk.listSessions(target)).filter(
          (session) => !hidden.has(session.sessionId)
        )
        sessionsRef.current = list
        setSessions(list)
        for (const tab of tabsRef.current.values()) {
          if (!tab.sessionId) continue
          const session = list.find((item) => item.sessionId === tab.sessionId)
          if (session) {
            tab.title = session.customTitle || session.summary || tab.title
          }
        }
        for (const tab of tabsRef.current.values()) publish(tab)
      } catch {
        // ignore listing errors
      }
    },
    [publish]
  )

  const activateTab = useCallback(
    (id: string) => {
      const tab = tabsRef.current.get(id)
      if (!tab) return
      activeTabIdRef.current = id
      setActiveTabIdState(id)
      cwdRef.current = tab.cwd
      setCwd(tab.cwd)
      void refreshSessions(tab.cwd)
    },
    [refreshSessions]
  )

  const rememberWorkspace = useCallback(
    async (path: string) => {
      const current = settingsRef.current
      if (!current || !path) return
      const list = current.preferences.recentWorkspaces || []
      if (list[0] === path) return
      const next = [path, ...list.filter((item) => item !== path)].slice(0, 12)
      if (next.length === list.length && next.every((item, index) => item === list[index])) {
        return
      }
      const preferences = await window.desk.savePreferences({ recentWorkspaces: next })
      const updated = { ...current, preferences }
      settingsRef.current = updated
      setSettings(updated)
    },
    []
  )

  const applyLastChatSettings = useCallback((tab: TabRuntimeData) => {
    const last = settingsRef.current?.preferences.lastChatSettings
    if (!last) return
    if (last.model) tab.state.model = last.model
    if (last.effort) {
      tab.effort = last.effort
      tab.state.effort = last.effort
    }
    if (last.permissionMode) tab.state.permissionMode = last.permissionMode
  }, [])

  const persistChatSettings = useCallback(
    async (tab: TabRuntimeData, patch: Partial<ChatSettingsSnapshot>) => {
      const run = async (): Promise<void> => {
        const current = settingsRef.current
        if (!current) return
        const now = Date.now()
        const lastChatSettings = {
          ...(current.preferences.lastChatSettings || {}),
          ...patch,
          updatedAt: now
        }
        let chatSettings = current.preferences.chatSettings || {}
        if (tab.sessionId) {
          chatSettings = {
            ...chatSettings,
            [tab.sessionId]: {
              ...(chatSettings[tab.sessionId] || {}),
              ...patch,
              updatedAt: now
            }
          }
          // Keep the preferences file bounded.
          chatSettings = Object.fromEntries(
            Object.entries(chatSettings)
              .sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0))
              .slice(0, 100)
          )
        }
        try {
          const preferences = await window.desk.savePreferences({
            chatSettings,
            lastChatSettings
          })
          const updated = { ...current, preferences }
          settingsRef.current = updated
          setSettings(updated)
        } catch {
          // Best effort: chat settings must not break the conversation.
        }
      }
      const next = chatSettingsQueue.current.then(run, run)
      chatSettingsQueue.current = next.catch(() => undefined)
      await next
    },
    []
  )

  const addTab = useCallback(
    (options?: {
      cwd?: string
      sessionId?: string
      title?: string
      activate?: boolean
    }): string => {
      const id = newId()
      const targetCwd = options?.cwd || cwdRef.current || defaults?.cwd || ''
      const model = settingsRef.current?.api.model || modelsRef.current[0]?.id || 'deepseek-v4.1-flash'
      const tab = emptyTab(id, targetCwd, model, options?.sessionId, options?.title)
      applyLastChatSettings(tab)
      tabsRef.current.set(id, tab)
      tabOrderRef.current = [...tabOrderRef.current, id]
      setTabOrder(tabOrderRef.current)
      publish(tab)
      if (options?.activate !== false) activateTab(id)
      void rememberWorkspace(targetCwd)
      return id
    },
    [activateTab, applyLastChatSettings, defaults?.cwd, publish, rememberWorkspace]
  )

  const closeTab = useCallback(
    (id: string) => {
      const tab = tabsRef.current.get(id)
      if (!tab) return
      void window.desk.stopSession(id).catch(() => undefined)
      tabsRef.current.delete(id)
      stateRevisions.current.delete(id)
      startingTabs.current.delete(id)
      const order = tabOrderRef.current.filter((item) => item !== id)
      tabOrderRef.current = order
      setTabOrder(order)
      setTabs((previous) => {
        const next = { ...previous }
        delete next[id]
        return next
      })
      if (activeTabIdRef.current === id) {
        const next = order[order.length - 1]
        if (next) activateTab(next)
        else addTab()
      }
    },
    [activateTab, addTab]
  )

  const pushNotice = useCallback(
    (tab: TabRuntimeData, text: string, tone: 'info' | 'error' = 'info') => {
      tab.messages.push({
        id: newId(),
        role: 'notice',
        text,
        tone,
        ts: Date.now()
      })
      schedulePublish(tab)
    },
    [schedulePublish]
  )

  const refreshCommands = useCallback(
    async (tab: TabRuntimeData) => {
      try {
        const commands = await window.desk.supportedCommands(tab.id)
        tab.commands = commands
        publish(tab)
      } catch {
        // commands are best-effort
      }
    },
    [publish]
  )

  const updateTitleFromMessages = useCallback((tab: TabRuntimeData) => {
    if (tab.title && tab.title !== '新对话') return
    const user = [...tab.messages].reverse().find(
      (message) => message.role === 'user' && message.text.trim()
    )
    if (user && user.role === 'user') {
      tab.title = truncate(user.text, 42)
    }
  }, [])

  useEffect(() => {
    const offState = window.desk.onState(({ tabId, state }) => {
      const tab = tabsRef.current.get(tabId)
      if (!tab) return
      if (!applyState(tab, state)) return
      if (tabId === activeTabIdRef.current) {
        cwdRef.current = state.cwd || tab.cwd
        setCwd(state.cwd || tab.cwd)
      }
      publish(tab)
    })

    const offEvent = window.desk.onEvent(({ tabId, message }) => {
      const tab = tabsRef.current.get(tabId)
      if (!tab) return

      if (message.type === 'stream_event') {
        const streamEvent = message.event || {}
        const rewindUuid =
          message.user_message_uuid ||
          (Array.isArray(message.user_message_uuids)
            ? message.user_message_uuids[message.user_message_uuids.length - 1]
            : undefined)
        if (rewindUuid) bindRewind(tab.messages, String(rewindUuid))
        const key = String(message.parent_tool_use_id || 'main')
        if (streamEvent.type === 'message_start' && streamEvent.message?.id) {
          tab.streamIds.set(key, String(streamEvent.message.id))
        }
        const messageId = tab.streamIds.get(key)
        if (
          applyStreamEvent(
            tab.messages,
            messageId,
            message.parent_tool_use_id,
            streamEvent
          )
        ) {
          schedulePublish(tab)
        }
        return
      }

      if (message.type === 'sdk_stderr') {
        console.warn('[claude stderr]', message.text)
        return
      }

      if (message.type === 'system' && message.subtype === 'init') {
        tab.state = {
          ...tab.state,
          connecting: false,
          sessionId: message.session_id,
          cwd: message.cwd || tab.state.cwd,
          model: message.model || tab.state.model,
          permissionMode: message.permissionMode || tab.state.permissionMode
        }
        tab.sessionId = message.session_id || tab.sessionId
        if (
          tab.sessionId &&
          !settingsRef.current?.preferences.chatSettings?.[tab.sessionId]
        ) {
          void persistChatSettings(tab, {
            model: tab.state.model,
            effort: tab.effort,
            permissionMode: tab.state.permissionMode
          })
        }
        publish(tab)
        void refreshCommands(tab)
        return
      }

      if (message.type === 'system' && message.subtype === 'commands_changed') {
        void refreshCommands(tab)
        return
      }

      if (message.type === 'system' && message.subtype === 'local_command_output') {
        const text = String(message.content || '')
        if (text.trim()) {
          tab.messages.push({
            id: newId(),
            role: 'notice',
            text,
            tone: 'info',
            ts: Date.now()
          })
          schedulePublish(tab)
        }
        return
      }

      const task = taskFromEvent(message)
      if (task) {
        const existing = tab.tasks.find((item) => item.id === task.id)
        if (existing) Object.assign(existing, task)
        else tab.tasks.push(task)
        schedulePublish(tab)
      }

      if (applyEvent(tab.messages, message)) schedulePublish(tab)

      if (message.type === 'result') {
        const delta = message.model_usage_since_last_result
        if (delta && typeof delta === 'object' && Object.keys(delta).length > 0) {
          tab.usage = mergeUsage(tab.usage, delta as Record<string, TokenUsage>)
          schedulePublish(tab)
        } else if (message.modelUsage && typeof message.modelUsage === 'object') {
          tab.usage = message.modelUsage as Record<string, TokenUsage>
          schedulePublish(tab)
        }
        updateTitleFromMessages(tab)
        if (
          !document.hasFocus() &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          const failed = message.subtype !== 'success'
          new Notification('3PI Desk', {
            body: `${tab.title}${failed ? ' failed' : ' completed'}`,
            silent: false
          })
        }
        window.setTimeout(() => void refreshSessions(tab.cwd), 800)
      }
    })

    const offPermission = window.desk.onPermission(({ tabId, request }) => {
      const tab = tabsRef.current.get(tabId)
      if (!tab) return
      tab.permissions = [...tab.permissions, request]
      if (markToolStatus(tab.messages, request.toolUseID, 'pending')) {
        schedulePublish(tab)
      } else {
        publish(tab)
      }
    })

    const offCancel = window.desk.onPermissionCancel(({ tabId, id }) => {
      const tab = tabsRef.current.get(tabId)
      if (!tab) return
      tab.permissions = tab.permissions.filter((item) => item.id !== id)
      publish(tab)
    })

    return () => {
      offState()
      offEvent()
      offPermission()
      offCancel()
      for (const timer of publishTimers.current.values()) window.clearTimeout(timer)
      publishTimers.current.clear()
    }
  }, [
    applyState,
    persistChatSettings,
    publish,
    refreshCommands,
    refreshSessions,
    schedulePublish,
    updateTitleFromMessages
  ])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission().catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    let disposed = false
    window.desk
      .getClaudeCliStatus()
      .then((status) => {
        if (!disposed) setClaudeCli(status)
      })
      .catch(() => undefined)
    const unsubscribe = window.desk.onClaudeCliStatus((status) => {
      if (!disposed) setClaudeCli(status)
    })
    return () => {
      disposed = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    let disposed = false
    Promise.all([
      window.desk.getDefaults(),
      window.desk.getSettings(),
      window.desk.getModels()
    ])
      .then(async ([defaultsValue, settingsValue, modelList]) => {
        if (disposed) return
        setDefaults(defaultsValue)
        cwdRef.current = defaultsValue.cwd
        setCwd(defaultsValue.cwd)
        const seededWorkspaces = [
          defaultsValue.cwd,
          defaultsValue.home,
          ...(settingsValue.preferences.recentWorkspaces || [])
        ]
          .filter((path, index, list) => Boolean(path) && list.indexOf(path) === index)
          .slice(0, 12)
        let effectiveSettings = settingsValue
        try {
          const preferences = await window.desk.savePreferences({
            recentWorkspaces: seededWorkspaces
          })
          effectiveSettings = { ...settingsValue, preferences }
        } catch {
          // keep existing settings
        }
        settingsRef.current = effectiveSettings
        setSettings(effectiveSettings)
        const nextModels =
          modelList.length > 0
            ? modelList
            : fallbackModelsFor(settingsValue.api.providerId)
        modelsRef.current = nextModels
        setModels(nextModels)
        const model = effectiveSettings.api.model || nextModels[0]?.id || 'deepseek-v4.1-flash'
        const id = newId()
        const tab = emptyTab(id, defaultsValue.cwd, model)
        applyLastChatSettings(tab)
        tabsRef.current.set(id, tab)
        tabOrderRef.current = [id]
        setTabOrder([id])
        publish(tab)
        activateTab(id)
        setBooted(true)
      })
      .catch((error) => {
        if (disposed) return
        const id = newId()
        const tab = emptyTab(id, cwdRef.current || '', 'deepseek-v4.1-flash')
        tabsRef.current.set(id, tab)
        tabOrderRef.current = [id]
        setTabOrder([id])
        publish(tab)
        activateTab(id)
        pushNotice(tab, `初始化失败：${errorText(error)}`, 'error')
        setBooted(true)
      })
    return () => {
      disposed = true
    }
  }, [activateTab, applyLastChatSettings, publish, pushNotice])

  const ensureSession = useCallback(async (tab: TabRuntimeData) => {
    if (tab.started) return
    const options: SessionStartOptions = {
      cwd: tab.cwd,
      model: tab.state.model,
      permissionMode: tab.state.permissionMode,
      effort: tab.effort,
      resume: tab.sessionId
    }
    const state = await window.desk.startSession(tab.id, options)
    tab.started = true
    tab.sessionId = state.sessionId || tab.sessionId
    applyState(tab, state)
    if (tab.sessionId && !settingsRef.current?.preferences.chatSettings?.[tab.sessionId]) {
      void persistChatSettings(tab, {
        model: tab.state.model,
        effort: tab.effort,
        permissionMode: tab.state.permissionMode
      })
    }
    publish(tab)
  }, [applyState, persistChatSettings, publish])

  const sendMessage = useCallback(
    async (text: string, attachments: Attachment[] = []) => {
      if (!booted) return
      const tab = tabsRef.current.get(activeTabIdRef.current)
      if (!tab) return
      if (tab.state.running || startingTabs.current.has(tab.id)) return
      const trimmed = text.trim()
      if (!trimmed && attachments.length === 0) return

      startingTabs.current.add(tab.id)
      try {
        await ensureSession(tab)
      } catch (error) {
        pushNotice(tab, `无法启动会话：${errorText(error)}`, 'error')
        return
      } finally {
        startingTabs.current.delete(tab.id)
      }

      const turnId = newId()
      // Show the stop control immediately; the authoritative state snapshot
      // follows from the main process.
      tab.state = { ...tab.state, running: true, error: undefined }
      tab.messages.push({
        id: turnId,
        role: 'user',
        text: trimmed,
        attachments: attachments.length > 0 ? attachments : undefined,
        rewindId: turnId,
        transcriptId: turnId,
        ts: Date.now()
      })
      updateTitleFromMessages(tab)
      schedulePublish(tab)

      try {
        await window.desk.sendMessage(tab.id, {
          text: trimmed,
          attachments,
          uuid: turnId
        })
      } catch (error) {
        tab.state = { ...tab.state, running: false }
        publish(tab)
        pushNotice(tab, `发送失败：${errorText(error)}`, 'error')
      }
    },
    [booted, ensureSession, publish, pushNotice, schedulePublish, updateTitleFromMessages]
  )

  const stop = useCallback(async () => {
    const tab = tabsRef.current.get(activeTabIdRef.current)
    if (!tab) return
    try {
      await window.desk.interrupt(tab.id)
    } catch (error) {
      pushNotice(tab, `停止失败：${errorText(error)}`, 'error')
    }
  }, [pushNotice])

  const newChat = useCallback(
    (nextCwd?: string) => {
      const active = tabsRef.current.get(activeTabIdRef.current)
      const target = nextCwd || active?.cwd || cwdRef.current
      if (nextCwd) {
        cwdRef.current = nextCwd
        setCwd(nextCwd)
        void window.desk.saveCwd(nextCwd)
      }
      addTab({ cwd: target })
    },
    [addTab]
  )

  const chooseFolder = useCallback(async () => {
    const active = tabsRef.current.get(activeTabIdRef.current)
    const directory = await window.desk.pickDirectory(active?.cwd || cwdRef.current)
    if (!directory) return
    newChat(directory)
  }, [newChat])

  const selectSession = useCallback(
    async (sessionId: string, cwdOverride?: string) => {
      const existing = [...tabsRef.current.values()].find(
        (tab) => tab.sessionId === sessionId
      )
      if (existing) {
        activateTab(existing.id)
        return
      }
      const info = sessionsRef.current.find((item) => item.sessionId === sessionId)
      const active = tabsRef.current.get(activeTabIdRef.current)
      const targetCwd = cwdOverride || info?.cwd || active?.cwd || cwdRef.current
      const id = addTab({
        cwd: targetCwd,
        sessionId,
        title: info?.customTitle || info?.summary || '载入中…'
      })
      const tab = tabsRef.current.get(id)
      if (!tab) return
      const saved =
        settingsRef.current?.preferences.chatSettings?.[sessionId] ||
        settingsRef.current?.preferences.lastChatSettings ||
        {}
      const savedModel = saved.model || tab.state.model
      const savedEffort = saved.effort || tab.effort
      const savedPermission = saved.permissionMode || tab.state.permissionMode
      tab.state = {
        ...tab.state,
        model: savedModel,
        effort: savedEffort,
        permissionMode: savedPermission
      }
      tab.effort = savedEffort
      tab.loadingHistory = true
      publish(tab)

      try {
        const raw = await window.desk.getSessionMessages(sessionId, tab.cwd)
        tab.messages = historyToMessages(raw)
        tab.usage = usageFromHistory(raw, tab.state.model)
        updateTitleFromMessages(tab)
        const state = await window.desk.startSession(tab.id, {
          cwd: tab.cwd,
          model: savedModel,
          permissionMode: savedPermission,
          effort: savedEffort,
          resume: sessionId
        })
        tab.started = true
        tab.sessionId = state.sessionId || sessionId
        applyState(tab, state)
        if (!settingsRef.current?.preferences.chatSettings?.[sessionId]) {
          void persistChatSettings(tab, {
            model: savedModel,
            effort: savedEffort,
            permissionMode: savedPermission
          })
        }
      } catch (error) {
        pushNotice(tab, `恢复会话失败：${errorText(error)}`, 'error')
      } finally {
        tab.loadingHistory = false
        publish(tab)
        void refreshSessions(tab.cwd)
      }
    },
    [
      activateTab,
      addTab,
      applyState,
      persistChatSettings,
      publish,
      pushNotice,
      refreshSessions,
      updateTitleFromMessages
    ]
  )

  const renameSession = useCallback(
    async (sessionId: string, title: string) => {
      const tab = tabsRef.current.get(activeTabIdRef.current)
      if (!tab) return
      try {
        await window.desk.renameSession(sessionId, title, tab.cwd)
        await refreshSessions(tab.cwd)
      } catch (error) {
        pushNotice(tab, `重命名失败：${errorText(error)}`, 'error')
      }
    },
    [pushNotice, refreshSessions]
  )

  const forkSession = useCallback(
    async (sessionId: string) => {
      const tab = tabsRef.current.get(activeTabIdRef.current)
      if (!tab) return
      try {
        const forkedId = await window.desk.forkSession(sessionId, tab.cwd)
        await refreshSessions(tab.cwd)
        await selectSession(forkedId)
      } catch (error) {
        pushNotice(tab, `创建分支失败：${errorText(error)}`, 'error')
      }
    },
    [pushNotice, refreshSessions, selectSession]
  )

  const respondPermission = useCallback(
    async (
      tabId: string,
      request: PermissionRequestPayload,
      decision: 'allow' | 'deny',
      always?: boolean,
      answers?: Record<string, string | string[]>
    ) => {
      const tab = tabsRef.current.get(tabId)
      if (!tab) return
      tab.permissions = tab.permissions.filter((item) => item.id !== request.id)
      if (decision === 'allow') {
        markToolStatus(tab.messages, request.toolUseID, 'running')
      } else {
        markToolStatus(tab.messages, request.toolUseID, 'error', '已拒绝')
      }
      publish(tab)
      try {
        await window.desk.respondPermission(tabId, {
          id: request.id,
          decision,
          always,
          message: decision === 'deny' ? '用户拒绝了此操作' : undefined,
          answers
        })
      } catch (error) {
        pushNotice(tab, `权限响应失败：${errorText(error)}`, 'error')
      }
    },
    [publish, pushNotice]
  )

  const pinSession = useCallback(
    async (sessionId: string) => {
      const current = settingsRef.current?.preferences.pinnedSessions || []
      const pinnedSessions = current.includes(sessionId)
        ? current.filter((id) => id !== sessionId)
        : [...current, sessionId]
      await savePreferences({ pinnedSessions })
    },
    []
  )

  const deleteSessionById = useCallback(
    async (session: SessionInfo) => {
      const cwd = session.cwd || tabsRef.current.get(activeTabIdRef.current)?.cwd || cwdRef.current
      try {
        await window.desk.deleteSession(session.sessionId, cwd)
        const open = [...tabsRef.current.values()].find(
          (tab) => tab.sessionId === session.sessionId
        )
        if (open) closeTab(open.id)
        await refreshSessions(cwd)
        const active = tabsRef.current.get(activeTabIdRef.current)
        if (active) pushNotice(active, '会话已删除，备份已保存')
      } catch (error) {
        const tab = tabsRef.current.get(activeTabIdRef.current)
        if (tab) pushNotice(tab, `删除会话失败：${errorText(error)}`, 'error')
      }
    },
    [closeTab, pushNotice, refreshSessions]
  )

  const tagSessionById = useCallback(
    async (session: SessionInfo, tag: string | null) => {
      const cwd = session.cwd || tabsRef.current.get(activeTabIdRef.current)?.cwd || cwdRef.current
      try {
        await window.desk.tagSession(session.sessionId, tag, cwd)
        await refreshSessions(cwd)
      } catch (error) {
        const tab = tabsRef.current.get(activeTabIdRef.current)
        if (tab) pushNotice(tab, `设置标签失败：${errorText(error)}`, 'error')
      }
    },
    [pushNotice, refreshSessions]
  )

  const exportTab = useCallback(async () => {
    const tab = tabsRef.current.get(activeTabIdRef.current)
    if (!tab) return
    const markdown = messagesToMarkdown(tab.messages, tab.title)
    const path = await window.desk.saveExport(
      `${safeFileName(tab.title)}.md`,
      markdown
    )
    if (path) pushNotice(tab, `已导出到 ${path}`)
  }, [pushNotice])

  const exportSessionById = useCallback(
    async (session: SessionInfo) => {
      const cwd = session.cwd || tabsRef.current.get(activeTabIdRef.current)?.cwd || cwdRef.current
      try {
        const raw = await window.desk.getSessionMessages(session.sessionId, cwd)
        const messages = historyToMessages(raw)
        const title = session.customTitle || session.summary || 'AI 会话'
        const path = await window.desk.saveExport(
          `${safeFileName(title)}.md`,
          messagesToMarkdown(messages, title)
        )
        if (path) {
          const tab = tabsRef.current.get(activeTabIdRef.current)
          if (tab) pushNotice(tab, `已导出到 ${path}`)
        }
      } catch (error) {
        const tab = tabsRef.current.get(activeTabIdRef.current)
        if (tab) pushNotice(tab, `导出失败：${errorText(error)}`, 'error')
      }
    },
    [pushNotice]
  )

  const forkAtMessage = useCallback(
    async (messageId: string) => {
      const tab = tabsRef.current.get(activeTabIdRef.current)
      if (!tab || !tab.sessionId) return
      const message = tab.messages.find((item) => item.id === messageId)
      if (!message?.transcriptId) {
        pushNotice(tab, '这条消息没有可用的会话位置', 'error')
        return
      }
      try {
        const forkedId = await window.desk.forkSession(
          tab.sessionId,
          tab.cwd,
          message.transcriptId
        )
        await selectSession(forkedId, tab.cwd)
      } catch (error) {
        pushNotice(tab, `创建分支失败：${errorText(error)}`, 'error')
      }
    },
    [pushNotice, selectSession]
  )

  const previousTranscript = useCallback(
    (tab: TabRuntimeData, messageId: string): string | undefined => {
      const index = tab.messages.findIndex((item) => item.id === messageId)
      if (index < 0) return undefined
      for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        if (tab.messages[cursor].transcriptId) {
          return tab.messages[cursor].transcriptId
        }
      }
      return undefined
    },
    []
  )

  const retractMessage = useCallback(
    async (messageId: string): Promise<{ text: string; attachments: Attachment[] } | null> => {
      const tab = tabsRef.current.get(activeTabIdRef.current)
      if (!tab) return null
      const index = tab.messages.findIndex(
        (item) => item.id === messageId && item.role === 'user'
      )
      if (index < 0) return null
      const message = tab.messages[index]
      if (message.role !== 'user') return null

      const previous = previousTranscript(tab, messageId)
      const oldSessionId = tab.sessionId
      let forkedId: string | undefined
      try {
        if (oldSessionId && previous) {
          forkedId = await window.desk.forkSession(oldSessionId, tab.cwd, previous)
        }
      } catch (error) {
        pushNotice(tab, `回退会话失败：${errorText(error)}`, 'error')
        return null
      }

      // Replace the current tab's session in place: no new tab, no visible
      // branch. The old transcript is preserved on disk and hidden from the
      // session lists.
      await window.desk.stopSession(tab.id).catch(() => undefined)
      let remaining = tab.messages.slice(0, index)
      if (forkedId) {
        try {
          // A fork copies transcript entries with new ids. Reload it so later
          // retracts can fork using ids that exist in the current session.
          const raw = await window.desk.getSessionMessages(forkedId, tab.cwd)
          if (raw.length > 0) remaining = historyToMessages(raw)
        } catch {
          // Keep the local slice if history cannot be loaded.
        }
      }
      tab.messages = remaining
      tab.tasks = []
      tab.streamIds.clear()
      tab.permissions = []
      tab.sessionId = forkedId
      tab.started = false
      tab.state = {
        ...tab.state,
        running: false,
        connecting: false,
        error: undefined,
        sessionId: forkedId
      }
      publish(tab)

      if (oldSessionId) {
        const current = settingsRef.current
        if (current) {
          const hidden = current.preferences.hiddenSessions || []
          if (!hidden.includes(oldSessionId)) {
            try {
              const preferences = await window.desk.savePreferences({
                hiddenSessions: [...hidden, oldSessionId]
              })
              const updated = { ...current, preferences }
              settingsRef.current = updated
              setSettings(updated)
            } catch {
              // Keeping the old transcript is best effort; it may remain listed.
            }
          }
        }
      }

      void refreshSessions(tab.cwd)
      return { text: message.text, attachments: message.attachments || [] }
    },
    [previousTranscript, publish, pushNotice, refreshSessions]
  )

  const beginEditMessage = useCallback(
    async (messageId: string) => retractMessage(messageId),
    [retractMessage]
  )

  const withdrawMessage = useCallback(
    async (messageId: string) => {
      const tab = tabsRef.current.get(activeTabIdRef.current)
      const result = await retractMessage(messageId)
      if (result && tab) pushNotice(tab, '消息已撤回', 'info')
    },
    [pushNotice, retractMessage]
  )

  const forkFrom = useCallback(
    async (tab: TabRuntimeData, beforeMessageId: string): Promise<void> => {
      const previous = previousTranscript(tab, beforeMessageId)
      if (tab.sessionId && previous) {
        const forkedId = await window.desk.forkSession(tab.sessionId, tab.cwd, previous)
        await selectSession(forkedId, tab.cwd)
      } else {
        newChat(tab.cwd)
      }
    },
    [newChat, previousTranscript, selectSession]
  )

  const regenerate = useCallback(
    async (assistantMessageId: string) => {
      const tab = tabsRef.current.get(activeTabIdRef.current)
      if (!tab) return
      const index = tab.messages.findIndex((item) => item.id === assistantMessageId)
      if (index < 0) return
      let userIndex = -1
      for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        if (tab.messages[cursor].role === 'user') {
          userIndex = cursor
          break
        }
      }
      if (userIndex < 0) return
      const user = tab.messages[userIndex]
      if (user.role !== 'user') return
      try {
        await forkFrom(tab, user.id)
        await sendMessage(user.text, user.attachments || [])
      } catch (error) {
        pushNotice(tab, `重新生成失败：${errorText(error)}`, 'error')
      }
    },
    [forkFrom, pushNotice, sendMessage]
  )

  const setModel = useCallback(
    async (model: string) => {
      const tab = tabsRef.current.get(activeTabIdRef.current)
      if (!tab) return
      const previous = tab.state.model
      tab.state = { ...tab.state, model }
      publish(tab)
      if (!tab.started) {
        void persistChatSettings(tab, { model })
        return
      }
      try {
        await window.desk.setModel(tab.id, model)
        void persistChatSettings(tab, { model })
      } catch (error) {
        tab.state = { ...tab.state, model: previous }
        publish(tab)
        pushNotice(tab, `切换模型失败：${errorText(error)}`, 'error')
      }
    },
    [persistChatSettings, publish, pushNotice]
  )

  const setPermissionMode = useCallback(
    async (mode: PermissionMode) => {
      const tab = tabsRef.current.get(activeTabIdRef.current)
      if (!tab) return
      const previous = tab.state.permissionMode
      tab.state = { ...tab.state, permissionMode: mode }
      publish(tab)
      if (!tab.started) {
        void persistChatSettings(tab, { permissionMode: mode })
        return
      }
      try {
        await window.desk.setPermissionMode(tab.id, mode)
        void persistChatSettings(tab, { permissionMode: mode })
      } catch (error) {
        tab.state = { ...tab.state, permissionMode: previous }
        publish(tab)
        pushNotice(tab, `切换权限模式失败：${errorText(error)}`, 'error')
      }
    },
    [persistChatSettings, publish, pushNotice]
  )

  const setEffort = useCallback(
    async (effort: EffortSetting) => {
      const tab = tabsRef.current.get(activeTabIdRef.current)
      if (!tab) return
      const previous = tab.effort
      tab.effort = effort
      tab.state = { ...tab.state, effort }
      publish(tab)
      if (!tab.started) {
        void persistChatSettings(tab, { effort })
        return
      }
      try {
        await window.desk.setEffort(tab.id, effort)
        void persistChatSettings(tab, { effort })
      } catch (error) {
        tab.effort = previous
        tab.state = { ...tab.state, effort: previous }
        publish(tab)
        pushNotice(tab, `切换思考强度失败：${errorText(error)}`, 'error')
      }
    },
    [persistChatSettings, publish, pushNotice]
  )

  const previewRewind = useCallback(
    async (messageId: string): Promise<RewindPreview> => {
      const tab = tabsRef.current.get(activeTabIdRef.current)
      if (!tab) throw new Error('没有活动会话')
      return window.desk.rewind(tab.id, messageId, true)
    },
    []
  )

  const applyRewind = useCallback(
    async (messageId: string): Promise<RewindPreview> => {
      const tab = tabsRef.current.get(activeTabIdRef.current)
      if (!tab) throw new Error('没有活动会话')
      const result = await window.desk.rewind(tab.id, messageId, false)
      const count = result.filesChanged?.length
      pushNotice(
        tab,
        result.canRewind
          ? count
            ? `已恢复 ${count} 个文件`
            : '文件已恢复'
          : `回滚失败：${result.error || '未知错误'}`,
        result.canRewind ? 'info' : 'error'
      )
      return result
    },
    [pushNotice]
  )

  const saveApi = useCallback(
    async (patch: ApiSettingsPatch): Promise<ApiSettings> => {
      const api = await window.desk.saveApiSettings(patch)
      const nextSettings = settingsRef.current
        ? { ...settingsRef.current, api }
        : {
            api,
            preferences: {
              ideIntegration: false,
              chromeIntegration: false,
              maxBudgetUsd: null,
              pinnedSessions: [],
              additionalDirectories: [],
              allowedTools: [],
              disallowedTools: [],
              closeToTray: false,
              globalShortcut: false,
              fontScale: 1,
              accent: 'coral' as const,
              compactMode: false,
              recentWorkspaces: [],
              chatSettings: {},
              lastChatSettings: {},
              hiddenSessions: []
            },
            permissionRules: { allow: [], ask: [], deny: [] },
            profiles: [],
            customModels: []
          }
      settingsRef.current = nextSettings
      setSettings(nextSettings)
      try {
        const list = await window.desk.getModels()
        modelsRef.current = list.length
          ? list
          : fallbackModelsFor(nextSettings.api.providerId)
        setModels(modelsRef.current)
      } catch {
        // keep existing models
      }
      const tab = tabsRef.current.get(activeTabIdRef.current)
      if (tab) pushNotice(tab, 'API 配置已保存，新会话生效')
      return api
    },
    [pushNotice]
  )

  const savePreferences = useCallback(
    async (patch: PreferencesPatch): Promise<AppPreferences> => {
      const preferences = await window.desk.savePreferences(patch)
      const nextSettings = settingsRef.current
        ? { ...settingsRef.current, preferences }
        : {
            api: { baseUrl: '', model: '', tokenMasked: '', hasToken: false },
            preferences,
            permissionRules: { allow: [], ask: [], deny: [] },
            profiles: [],
            customModels: []
          }
      settingsRef.current = nextSettings
      setSettings(nextSettings)
      return preferences
    },
    []
  )

  const saveApiProfile = useCallback(
    async (profile: import('../../../shared/types').ApiProfileInput) => {
      const profiles = await window.desk.saveApiProfile(profile)
      const current = settingsRef.current
      if (current) {
        const updated = { ...current, profiles }
        settingsRef.current = updated
        setSettings(updated)
      }
      return profiles
    },
    []
  )

  const deleteApiProfile = useCallback(async (id: string) => {
    const profiles = await window.desk.deleteApiProfile(id)
    const current = settingsRef.current
    if (current) {
      const updated = { ...current, profiles }
      settingsRef.current = updated
      setSettings(updated)
    }
    return profiles
  }, [])

  const applyApiProfile = useCallback(
    async (id: string) => {
      const api = await window.desk.applyApiProfile(id)
      const current = settingsRef.current
      if (current) {
        const updated = { ...current, api }
        settingsRef.current = updated
        setSettings(updated)
      }
      try {
        const list = await window.desk.getModels()
        modelsRef.current = list.length
          ? list
          : fallbackModelsFor(api.providerId || settingsRef.current?.api.providerId)
        setModels(modelsRef.current)
      } catch {
        // keep
      }
      const tab = tabsRef.current.get(activeTabIdRef.current)
      if (tab) pushNotice(tab, '已切换 API 配置，新会话生效')
      return api
    },
    [pushNotice]
  )

  const saveCustomModel = useCallback(async (model: CustomModel): Promise<CustomModel[]> => {
    const customModels = await window.desk.saveCustomModel(model)
    const current = settingsRef.current
    if (current) {
      const updated = { ...current, customModels }
      settingsRef.current = updated
      setSettings(updated)
    }
    try {
      const list = await window.desk.getModels()
      modelsRef.current = list.length
        ? list
        : fallbackModelsFor(settingsRef.current?.api.providerId)
      setModels(modelsRef.current)
    } catch {
      // keep existing models
    }
    return customModels
  }, [])

  const deleteCustomModel = useCallback(
    async (id: string, providerId?: string): Promise<CustomModel[]> => {
      const customModels = await window.desk.deleteCustomModel(id, providerId)
      const current = settingsRef.current
      if (current) {
        const updated = { ...current, customModels }
        settingsRef.current = updated
        setSettings(updated)
      }
      try {
        const list = await window.desk.getModels()
        modelsRef.current = list.length
          ? list
          : fallbackModelsFor(settingsRef.current?.api.providerId)
        setModels(modelsRef.current)
      } catch {
        // keep existing models
      }
      return customModels
    },
    []
  )

  const savePermissionRules = useCallback(
    async (rules: import('../../../shared/types').PermissionRules) => {
      const next = await window.desk.savePermissionRules(rules)
      const current = settingsRef.current
      if (current) {
        const updated = { ...current, permissionRules: next }
        settingsRef.current = updated
        setSettings(updated)
      }
      return next
    },
    []
  )

  const testApi = useCallback(
    (patch?: ApiSettingsPatch): Promise<TestApiResult> => window.desk.testApi(patch),
    []
  )

  const reloadModels = useCallback(async () => {
    const list = await window.desk.getModels()
    modelsRef.current = list.length
      ? list
      : fallbackModelsFor(settingsRef.current?.api.providerId)
    setModels(modelsRef.current)
    return modelsRef.current
  }, [])

  const searchFiles = useCallback(
    (query: string): Promise<FileEntry[]> => {
      const tab = tabsRef.current.get(activeTabIdRef.current)
      return window.desk.searchFiles(tab?.cwd || cwdRef.current, query)
    },
    []
  )

  const setTheme = useCallback((value: ThemeMode) => setThemeState(value), [])

  const removeRecentWorkspace = useCallback(async (path: string) => {
    const current = settingsRef.current
    if (!current) return
    const next = (current.preferences.recentWorkspaces || []).filter(
      (item) => item !== path
    )
    const preferences = await window.desk.savePreferences({ recentWorkspaces: next })
    const updated = { ...current, preferences }
    settingsRef.current = updated
    setSettings(updated)
  }, [])

  const openWorkspace = useCallback(
    (path: string) => {
      newChat(path)
    },
    [newChat]
  )

  const setLanguage = useCallback((value: Language) => {
    localStorage.setItem('3pi-language', value)
    document.documentElement.lang = value
    setLanguageState(value)
    setI18nLanguage(value)
  }, [])

  const currentPermission = tabOrder
    .flatMap((id) => {
      const tab = tabs[id]
      if (!tab) return []
      return tab.permissions.map((request) => ({
        tabId: id,
        tabTitle: tab.title,
        request
      }))
    })
    .at(0)

  const openConsole = useCallback(
    (providerId?: string) => window.desk.openConsole(providerId),
    []
  )
  const openPath = useCallback((path: string) => window.desk.openPath(path), [])
  const openBackupDir = useCallback(() => window.desk.openBackupDir(), [])

  const refreshClaudeCli = useCallback(async (): Promise<ClaudeCliStatus> => {
    const status = await window.desk.getClaudeCliStatus(true)
    setClaudeCli(status)
    return status
  }, [])

  const downloadClaudeCli = useCallback(async (): Promise<ClaudeCliStatus> => {
    const status = await window.desk.downloadClaudeCli()
    setClaudeCli(status)
    return status
  }, [])

  const setClaudeCliPath = useCallback(
    async (path: string | null): Promise<ClaudeCliStatus> => {
      const status = await window.desk.setClaudeCliPath(path)
      setClaudeCli(status)
      return status
    },
    []
  )

  const pickClaudeCli = useCallback(async (): Promise<ClaudeCliStatus | null> => {
    const status = await window.desk.pickClaudeCli()
    if (status) setClaudeCli(status)
    return status
  }, [])

  return {
    booted,
    defaults,
    settings,
    models,
    cwd,
    sessions,
    tabs,
    tabOrder,
    activeTabId,
    activeTab: tabs[activeTabId],
    currentPermission,
    theme,
    language,
    settingsOpen,
    renameTarget,
    setSettingsOpen,
    setRenameTarget,
    addTab,
    closeTab,
    activateTab,
    rememberWorkspace,
    removeRecentWorkspace,
    openWorkspace,
    newChat,
    chooseFolder,
    selectSession,
    sendMessage,
    stop,
    renameSession,
    forkSession,
    pinSession,
    deleteSessionById,
    tagSessionById,
    exportTab,
    exportSessionById,
    forkAtMessage,
    beginEditMessage,
    withdrawMessage,
    regenerate,
    respondPermission,
    setModel,
    setPermissionMode,
    setEffort,
    previewRewind,
    applyRewind,
    refreshSessions,
    saveApi,
    saveApiProfile,
    deleteApiProfile,
    applyApiProfile,
    savePreferences,
    savePermissionRules,
    saveCustomModel,
    deleteCustomModel,
    testApi,
    reloadModels,
    searchFiles,
    setTheme,
    setLanguage,
    openConsole,
    openPath,
    openBackupDir,
    claudeCli,
    refreshClaudeCli,
    downloadClaudeCli,
    setClaudeCliPath,
    pickClaudeCli
  }
}

export type DeskController = ReturnType<typeof useDesk>
