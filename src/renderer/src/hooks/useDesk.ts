import { PERMISSION_OPTIONS, EFFORT_OPTIONS, FALLBACK_COMMANDS } from '../../../shared/ui-options'
export { PERMISSION_OPTIONS, EFFORT_OPTIONS } from '../../../shared/ui-options'
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
  SessionCopyMode,
  SessionInfo,
  SessionStartOptions,
  SessionState,
  SettingsSnapshot,
  TestApiResult,
  WebSearchPatch,
  WebSearchSettings,
  WebSearchTestResult
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
import { mergeUsage, summarizeUsage } from '../lib/usage'
import { messagesToMarkdown, safeFileName } from '../lib/export'
import { initialLanguage, setI18nLanguage, type Language } from '../i18n'
import { initialTheme, useAppearanceEffects } from './useDeskAppearance'
import {
  emptyTab,
  errorText,
  FALLBACK_MODELS,
  fallbackModelsFor,
  questionNoticeText,
  taskFromEvent,
  toView
} from './desk-helpers'
export { FALLBACK_MODELS } from './desk-helpers'

const SESSION_PAGE_SIZE = 60

const EMPTY_WEB_SEARCH: WebSearchSettings = {
  enabled: true,
  provider: 'duckduckgo',
  endpoint: '',
  hasApiKey: false,
  apiKeyMasked: '',
  maxResults: 6
}

export function useDesk() {
  const [booted, setBooted] = useState(false)
  const [bootError, setBootError] = useState('')
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
  const [sessionsHasMore, setSessionsHasMore] = useState(false)
  const [sessionsLoadingMore, setSessionsLoadingMore] = useState(false)
  /** Last tab that received a message from another client (phone/desktop). */
  const [remoteActivity, setRemoteActivity] = useState<
    { tabId: string; at: number } | null
  >(null)

  const tabsRef = useRef(new Map<string, TabRuntimeData>())
  const tabOrderRef = useRef<string[]>([])
  const activeTabIdRef = useRef('')
  const sessionsRef = useRef<SessionInfo[]>([])
  const sessionsOffset = useRef(0)
  const sessionsCwd = useRef('')
  const cwdRef = useRef('')
  const settingsRef = useRef<SettingsSnapshot | null>(null)
  const modelsRef = useRef<ModelOption[]>(FALLBACK_MODELS)
  const publishTimers = useRef(new Map<string, number>())
  const stateRevisions = useRef(new Map<string, number>())
  const startingTabs = useRef(new Set<string>())
  /** Tabs created locally but not yet confirmed by the shared registry. */
  const pendingTabRegistration = useRef(new Set<string>())
  const chatSettingsQueue = useRef<Promise<void>>(Promise.resolve())

  useAppearanceEffects(settings, theme)

  const applyState = useCallback((tab: TabRuntimeData, state: SessionState): boolean => {
    const previous = stateRevisions.current.get(tab.id)
    if (!isNewerState(previous, state)) return false
    const revision = stateRevision(state)
    if (revision !== undefined) stateRevisions.current.set(tab.id, revision)
    const wasRunning = tab.state.running
    tab.state = state
    if (tab.modelOverride) tab.state.model = tab.modelOverride
    tab.sessionId = state.sessionId || tab.sessionId
    tab.effort = state.effort
    if (!wasRunning && state.running) {
      tab.workStartedAt = Date.now()
    } else if (wasRunning && !state.running) {
      if (tab.workStartedAt) {
        tab.workElapsedMs += Math.max(0, Date.now() - tab.workStartedAt)
      }
      tab.workStartedAt = undefined
    }
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

  const loadTabHistory = useCallback(
    async (tab: TabRuntimeData): Promise<void> => {
      if (!tab.sessionId || tab.messages.length > 0 || tab.loadingHistory) return
      tab.loadingHistory = true
      publish(tab)
      try {
        const raw = await window.desk.getSessionMessages(tab.sessionId, tab.cwd)
        tab.messages = historyToMessages(raw)
        tab.usage = usageFromHistory(raw, tab.state.model)
        publish(tab)
      } catch {
        // History is best-effort; the live event stream still works.
      } finally {
        tab.loadingHistory = false
        publish(tab)
      }
    },
    [publish]
  )

  const replayLiveEvents = useCallback(
    (tab: TabRuntimeData, events: DesktopEvent[]): void => {
      for (const message of events) {
        if (message.type === 'stream_event') {
          const key = String(message.parent_tool_use_id || 'main')
          const streamEvent = message.event || {}
          if (streamEvent.type === 'message_start' && streamEvent.message?.id) {
            tab.streamIds.set(key, String(streamEvent.message.id))
          }
          applyStreamEvent(
            tab.messages,
            tab.streamIds.get(key),
            message.parent_tool_use_id,
            streamEvent
          )
        } else {
          applyEvent(tab.messages, message)
        }
      }
      publish(tab)
    },
    [publish]
  )

  const restoreTabs = useCallback(async (): Promise<void> => {
    let list: Awaited<ReturnType<typeof window.desk.listTabs>> = []
    try {
      list = await window.desk.listTabs()
    } catch {
      return
    }
    if (list.length === 0) return
    for (const remote of list) {
      if (tabsRef.current.has(remote.id)) continue
      const tab = emptyTab(
        remote.id,
        remote.cwd,
        remote.state?.model || settingsRef.current?.api.model || FALLBACK_MODELS[0].id,
        remote.sessionId,
        remote.title
      )
      tab.state = remote.state
      tab.permissions = remote.permissions
      tab.tasks = remote.tasks
      tab.effort = remote.effort
      tab.usage = remote.usage
      tab.commands = remote.commands
      tab.workElapsedMs = remote.workElapsedMs
      tab.workStartedAt = remote.workStartedAt
      tab.started = remote.started
      tabsRef.current.set(tab.id, tab)
      tabOrderRef.current = [...tabOrderRef.current, tab.id]
      publish(tab)
      if (remote.liveEvents?.length) replayLiveEvents(tab, remote.liveEvents)
    }
    setTabOrder([...tabOrderRef.current])
    let active = ''
    try {
      active = localStorage.getItem('3pi-active-tab') || ''
    } catch {
      active = ''
    }
    if (!active || !tabsRef.current.has(active)) {
      active = tabOrderRef.current[tabOrderRef.current.length - 1] || ''
    }
    if (active) {
      activeTabIdRef.current = active
      setActiveTabIdState(active)
      const tab = tabsRef.current.get(active)
      if (tab) {
        cwdRef.current = tab.cwd
        setCwd(tab.cwd)
        if (tab.sessionId) void loadTabHistory(tab)
      }
    }
  }, [loadTabHistory, publish, replayLiveEvents])

  const refreshSessions = useCallback(
    async (directory?: string) => {
      const active = tabsRef.current.get(activeTabIdRef.current)
      const target = directory || active?.cwd || cwdRef.current
      if (!target) return
      try {
        if (sessionsCwd.current !== target) {
          sessionsCwd.current = target
          sessionsOffset.current = 0
        }
        const hidden = new Set(settingsRef.current?.preferences.hiddenSessions || [])
        const limit = Math.max(SESSION_PAGE_SIZE, sessionsOffset.current)
        const raw = await window.desk.listSessions(target, 0, limit)
        const list = raw.filter((session) => !hidden.has(session.sessionId))
        sessionsOffset.current = raw.length
        sessionsRef.current = list
        setSessions(list)
        setSessionsHasMore(raw.length >= limit)
        setSessionsLoadingMore(false)
        for (const tab of tabsRef.current.values()) {
          if (!tab.sessionId) continue
          const session = list.find((item) => item.sessionId === tab.sessionId)
          if (session) {
            const nextTitle = session.customTitle || session.summary || tab.title
            if (nextTitle && nextTitle !== tab.title) {
              tab.title = nextTitle
              void window.desk.renameTab(tab.id, nextTitle).catch(() => undefined)
            }
          }
        }
        for (const tab of tabsRef.current.values()) publish(tab)
      } catch {
        // ignore listing errors
      }
    },
    [publish]
  )

  const loadMoreSessions = useCallback(async (directory?: string): Promise<void> => {
    const active = tabsRef.current.get(activeTabIdRef.current)
    const target = directory || active?.cwd || cwdRef.current
    if (!target || sessionsLoadingMore || !sessionsHasMore) return
    setSessionsLoadingMore(true)
    try {
      const hidden = new Set(settingsRef.current?.preferences.hiddenSessions || [])
      const raw = await window.desk.listSessions(
        target,
        sessionsOffset.current,
        SESSION_PAGE_SIZE
      )
      sessionsOffset.current += raw.length
      const list = raw.filter((session) => !hidden.has(session.sessionId))
      const seen = new Set(sessionsRef.current.map((session) => session.sessionId))
      const merged = [...sessionsRef.current, ...list.filter((item) => !seen.has(item.sessionId))]
      sessionsRef.current = merged
      setSessions(merged)
      setSessionsHasMore(raw.length >= SESSION_PAGE_SIZE)
    } catch {
      // ignore listing errors
    } finally {
      setSessionsLoadingMore(false)
    }
  }, [sessionsHasMore, sessionsLoadingMore])

  const activateTab = useCallback(
    (id: string) => {
      const tab = tabsRef.current.get(id)
      if (!tab) return
      activeTabIdRef.current = id
      setActiveTabIdState(id)
      cwdRef.current = tab.cwd
      setCwd(tab.cwd)
      try {
        localStorage.setItem('3pi-active-tab', id)
      } catch {
        // ignore
      }
      if (tab.sessionId && tab.messages.length === 0) void loadTabHistory(tab)
      void refreshSessions(tab.cwd)
    },
    [loadTabHistory, refreshSessions]
  )

  const rememberWorkspace = useCallback(
    async (path: string) => {
      const current = settingsRef.current
      if (!current || !path) return
      const list = current.preferences.recentWorkspaces || []
      if (list[0] === path) return
      const next = [path, ...list.filter((item) => item !== path)].slice(0, 200)
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
      pendingTabRegistration.current.add(id)
      void window.desk
        .createTab({
          id,
          cwd: targetCwd,
          title: tab.title,
          sessionId: options?.sessionId
        })
        .catch(() => undefined)
        .finally(() => {
          window.setTimeout(() => pendingTabRegistration.current.delete(id), 3000)
        })
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
      void window.desk.closeTab(id).catch(() => undefined)
      void window.desk.stopSession(id).catch(() => undefined)
      tabsRef.current.delete(id)
      stateRevisions.current.delete(id)
      startingTabs.current.delete(id)
      pendingTabRegistration.current.delete(id)
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
        if (next) {
          activateTab(next)
        } else {
          activeTabIdRef.current = ''
          setActiveTabIdState('')
          cwdRef.current = tab.cwd
          setCwd(tab.cwd)
          void refreshSessions(tab.cwd)
        }
      }
    },
    [activateTab, refreshSessions]
  )

  const pushNotice = useCallback(
    (
      tab: TabRuntimeData,
      text: string,
      tone: 'info' | 'error' | 'attention' = 'info'
    ) => {
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
        tab.rateMeter.handleStreamEvent(key, streamEvent)
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
          model: tab.modelOverride || message.model || tab.state.model,
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
        let turnOutputTokens: number | undefined
        let turnDeltaUsage: Record<string, TokenUsage> | undefined
        if (delta && typeof delta === 'object' && Object.keys(delta).length > 0) {
          const deltaUsage = delta as Record<string, TokenUsage>
          turnDeltaUsage = deltaUsage
          turnOutputTokens = Object.values(deltaUsage).reduce(
            (sum, item) => sum + (item.outputTokens || 0),
            0
          )
          tab.usage = mergeUsage(tab.usage, deltaUsage)
          schedulePublish(tab)
        } else if (message.modelUsage && typeof message.modelUsage === 'object') {
          const nextUsage = message.modelUsage as Record<string, TokenUsage>
          const prevInput = Object.values(tab.usage || {}).reduce(
            (sum, item) => sum + (item.inputTokens || 0),
            0
          )
          const previousOutput = Object.values(tab.usage || {}).reduce(
            (sum, item) => sum + (item.outputTokens || 0),
            0
          )
          const prevCache = Object.values(tab.usage || {}).reduce(
            (sum, item) => sum + (item.cacheReadInputTokens || 0),
            0
          )
          const nextInput = Object.values(nextUsage).reduce(
            (sum, item) => sum + (item.inputTokens || 0),
            0
          )
          const nextOutput = Object.values(nextUsage).reduce(
            (sum, item) => sum + (item.outputTokens || 0),
            0
          )
          const nextCache = Object.values(nextUsage).reduce(
            (sum, item) => sum + (item.cacheReadInputTokens || 0),
            0
          )
          turnOutputTokens = Math.max(0, nextOutput - previousOutput)
          turnDeltaUsage = {
            [tab.state.model || 'default']: {
              inputTokens: Math.max(0, nextInput - prevInput),
              outputTokens: turnOutputTokens,
              cacheReadInputTokens: Math.max(0, nextCache - prevCache),
              cacheCreationInputTokens: 0
            }
          }
          tab.usage = nextUsage
          schedulePublish(tab)
        }
        if (turnDeltaUsage) {
          const turnSummary = summarizeUsage(turnDeltaUsage, modelsRef.current)
          void window.desk
            .recordUsageTurn({
              cwd: tab.cwd,
              model: tab.state.model,
              inputTokens: turnSummary.inputTokens,
              outputTokens: turnSummary.outputTokens,
              cacheReadTokens: turnSummary.cacheReadTokens,
              costUsd: turnSummary.costUsd || Number(message.total_cost_usd) || 0
            })
            .catch(() => undefined)
        }
        tab.rateMeter.endTurn(turnOutputTokens)
        updateTitleFromMessages(tab)
        if (
          !document.hasFocus() &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          const failed = message.subtype !== 'success'
          new Notification('3PI Desk', {
            body: `${tab.title}${failed ? ' 任务失败' : ' 已完成'}`,
            silent: false
          })
        }
        window.setTimeout(() => void refreshSessions(tab.cwd), 800)
      }
    })

    const offPermission = window.desk.onPermission(({ tabId, request }) => {
      const tab = tabsRef.current.get(tabId)
      if (!tab) return
      if (!tab.permissions.some((item) => item.id === request.id)) {
        tab.permissions = [...tab.permissions, request]
        if (request.kind === 'question') {
          // Bind the prompt to its conversation and leave a durable in-chat
          // marker for it. The inline QuestionBar itself only renders in the
          // owning tab, so other conversations never show this request.
          tab.messages.push({
            id: newId(),
            role: 'notice',
            text: questionNoticeText(request),
            tone: 'attention',
            ts: Date.now()
          })
        }
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate([120, 60, 120])
          } catch {
            // ignore
          }
        }
        if (
          (!document.hasFocus() || tabId !== activeTabIdRef.current) &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          const promptLabel =
            request.kind === 'question'
              ? questionNoticeText(request)
              : `${tab.title} 需要你的权限确认：${request.displayName || request.toolName}`
          new Notification('3PI Desk', {
            body: promptLabel,
            silent: false
          })
        }
      }
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
    const offTabs = window.desk.onTabsChanged(({ tabs: list }) => {
      const seen = new Set(list.map((item) => item.id))
      for (const remote of list) {
        pendingTabRegistration.current.delete(remote.id)
        const existing = tabsRef.current.get(remote.id)
        if (existing) {
          existing.cwd = remote.cwd || existing.cwd
          existing.title = remote.title || existing.title
          existing.sessionId = remote.sessionId || existing.sessionId
          existing.state = remote.state || existing.state
          existing.permissions = remote.permissions || existing.permissions
          existing.tasks = remote.tasks || existing.tasks
          existing.effort = remote.effort || existing.effort
          existing.usage = remote.usage || existing.usage
          existing.commands = remote.commands || existing.commands
          existing.workElapsedMs = remote.workElapsedMs
          existing.workStartedAt = remote.workStartedAt
          existing.started = remote.started
          publish(existing)
          if (remote.state?.running && remote.liveEvents?.length) {
            replayLiveEvents(existing, remote.liveEvents)
          }
        } else {
          const tab = emptyTab(
            remote.id,
            remote.cwd,
            remote.state?.model || settingsRef.current?.api.model || FALLBACK_MODELS[0].id,
            remote.sessionId,
            remote.title
          )
          tab.state = remote.state
          tab.permissions = remote.permissions
          tab.tasks = remote.tasks
          tab.effort = remote.effort
          tab.usage = remote.usage
          tab.commands = remote.commands
          tab.workElapsedMs = remote.workElapsedMs
          tab.workStartedAt = remote.workStartedAt
          tab.started = remote.started
          tabsRef.current.set(tab.id, tab)
          tabOrderRef.current = [...tabOrderRef.current, tab.id]
          setTabOrder([...tabOrderRef.current])
          publish(tab)
          if (remote.liveEvents?.length) replayLiveEvents(tab, remote.liveEvents)
          if (remote.sessionId && remote.state?.running) {
            void window.desk
              .snapshotTab(remote.id)
              .then((snapshot) => {
                if (snapshot?.liveEvents?.length) {
                  replayLiveEvents(tab, snapshot.liveEvents)
                }
              })
              .catch(() => undefined)
          }
        }
      }
      for (const id of [...tabsRef.current.keys()]) {
        if (seen.has(id)) continue
        if (pendingTabRegistration.current.has(id)) continue
        const tab = tabsRef.current.get(id)
        tabsRef.current.delete(id)
        stateRevisions.current.delete(id)
        startingTabs.current.delete(id)
        tabOrderRef.current = tabOrderRef.current.filter((item) => item !== id)
        setTabs((previous) => {
          const next = { ...previous }
          delete next[id]
          return next
        })
        setTabOrder([...tabOrderRef.current])
        if (activeTabIdRef.current === id) {
          const next = tabOrderRef.current[tabOrderRef.current.length - 1]
          if (next) {
            const nextTab = tabsRef.current.get(next)
            if (nextTab) {
              activeTabIdRef.current = next
              setActiveTabIdState(next)
              cwdRef.current = nextTab.cwd
              setCwd(nextTab.cwd)
              if (nextTab.sessionId && nextTab.messages.length === 0) {
                void loadTabHistory(nextTab)
              }
            }
          } else {
            activeTabIdRef.current = ''
            setActiveTabIdState('')
            if (tab) {
              cwdRef.current = tab.cwd
              setCwd(tab.cwd)
            }
          }
        }
      }
    })

    const offUser = window.desk.onUserMessage(({ tabId, message, source }) => {
      const tab = tabsRef.current.get(tabId)
      if (!tab) return
      const duplicate = tab.messages.some(
        (item) =>
          item.role === 'user' &&
          ((item.transcriptId && item.transcriptId === message.uuid) ||
            (item.rewindId && item.rewindId === message.uuid))
      )
      if (duplicate) return
      tab.messages.push({
        id: message.uuid || newId(),
        role: 'user',
        text: message.text,
        attachments: message.attachments,
        rewindId: message.uuid,
        transcriptId: message.uuid,
        ts: message.ts || Date.now()
      })
      updateTitleFromMessages(tab)
      schedulePublish(tab)
      if (source === 'remote' && tabId !== activeTabIdRef.current) {
        setRemoteActivity({ tabId, at: Date.now() })
      }
    })

    const offSettings = window.desk.onSettingsChanged((next) => {
      settingsRef.current = next
      setSettings(next)
    })

    const offSessions = window.desk.onSessionsChanged(({ cwd }) => {
      void refreshSessions(cwd)
    })

    return () => {
      offTabs()
      offUser()
      offSettings()
      offSessions()
    }
  }, [
    loadTabHistory,
    publish,
    refreshSessions,
    replayLiveEvents,
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
    Promise.all([window.desk.getDefaults(), window.desk.getSettings()])
      .then(async ([defaultsValue, settingsValue]) => {
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
          .slice(0, 200)
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
        const nextModels = [...fallbackModelsFor(settingsValue.api.providerId)]
        if (
          settingsValue.api.model &&
          !nextModels.some((model) => model.id === settingsValue.api.model)
        ) {
          nextModels.push({
            id: settingsValue.api.model,
            name: settingsValue.api.model
          })
        }
        modelsRef.current = nextModels
        setModels(nextModels)
        setBootError('')
        setBooted(true)
        void restoreTabs()
        void refreshSessions(defaultsValue.cwd)
        // Model discovery can be slow or unreachable; never block the project
        // home on it. The fallback/synthetic model is enough to start a chat.
        void window.desk
          .getModels()
          .then((list) => {
            if (disposed || list.length === 0) return
            modelsRef.current = list
            setModels(list)
          })
          .catch(() => undefined)
      })
      .catch((error) => {
        if (disposed) return
        setBootError(`初始化失败：${errorText(error)}`)
        setBooted(true)
      })
    return () => {
      disposed = true
    }
  }, [refreshSessions, restoreTabs])

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
      if (startingTabs.current.has(tab.id)) return
      const trimmed = text.trim()
      if (!trimmed && attachments.length === 0) return

      // /help is a terminal-only command in headless mode, so answer it
      // locally with the command list the composer already knows about.
      if (trimmed === '/help' && attachments.length === 0) {
        tab.messages.push({
          id: newId(),
          role: 'notice',
          text: '斜杠命令',
          tone: 'info',
          help: tab.commands.length > 0 ? tab.commands : FALLBACK_COMMANDS,
          ts: Date.now()
        })
        schedulePublish(tab)
        return
      }

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
      // A new turn gets a fresh live-rate meter; the previous turn's number
      // must not look like it describes the new generation.
      tab.rateMeter.reset()
      // Show the stop control immediately; the authoritative state snapshot
      // follows from the main process. Sending while a turn is running just
      // queues another turn in the SDK's streaming input.
      if (!tab.state.running) tab.workStartedAt = Date.now()
      tab.state = {
        ...tab.state,
        running: true,
        pendingTurns: (tab.state.pendingTurns || 0) + 1,
        error: undefined
      }
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
        const pendingTurns = Math.max(0, (tab.state.pendingTurns || 1) - 1)
        const stillRunning = tab.state.running && pendingTurns > 0
        if (!stillRunning && tab.workStartedAt) {
          tab.workElapsedMs += Math.max(0, Date.now() - tab.workStartedAt)
          tab.workStartedAt = undefined
        }
        tab.state = {
          ...tab.state,
          pendingTurns,
          running: stillRunning
        }
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

  const openProject = useCallback(
    async (path: string): Promise<void> => {
      if (!path) return
      cwdRef.current = path
      setCwd(path)
      void window.desk.saveCwd(path)
      sessionsRef.current = []
      sessionsOffset.current = 0
      sessionsCwd.current = path
      setSessions([])
      await rememberWorkspace(path).catch(() => undefined)
      await refreshSessions(path)
    },
    [refreshSessions, rememberWorkspace]
  )

  const relocateWorkspace = useCallback(
    async (oldPath: string, newPath: string) => {
      const busy = [...tabsRef.current.values()].some(
        (tab) =>
          tab.cwd === oldPath &&
          (tab.state.running || tab.state.connecting || startingTabs.current.has(tab.id))
      )
      if (busy) {
        throw new Error('该项目还有运行中的任务，请先停止后再重新定位。')
      }
      const result = await window.desk.relocateWorkspace(oldPath, newPath)
      const current = settingsRef.current
      if (current) {
        const updated = { ...current, preferences: result.preferences }
        settingsRef.current = updated
        setSettings(updated)
      }
      // Tabs bound to the old path cannot start new turns; the chats are
      // available from the relocated project.
      for (const tab of [...tabsRef.current.values()]) {
        if (tab.cwd === oldPath) closeTab(tab.id)
      }
      return result
    },
    [closeTab]
  )

  const pickProject = useCallback(async (): Promise<string | null> => {
    const directory = await window.desk.pickDirectory(cwdRef.current)
    if (!directory) return null
    await openProject(directory)
    return directory
  }, [openProject])

  const selectSession = useCallback(
    async (sessionId: string, cwdOverride?: string) => {
      const info = sessionsRef.current.find((item) => item.sessionId === sessionId)
      const active = tabsRef.current.get(activeTabIdRef.current)
      const targetCwd = cwdOverride || info?.cwd || active?.cwd || cwdRef.current
      const existing = [...tabsRef.current.values()].find(
        (tab) => tab.sessionId === sessionId
      )
      if (existing) {
        if (!cwdOverride || existing.cwd === targetCwd) {
          activateTab(existing.id)
          return
        }
        // The same chat is open under a stale (renamed/moved) workspace;
        // reopen it from the workspace the caller asked for.
        closeTab(existing.id)
      }
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
      closeTab,
      persistChatSettings,
      publish,
      pushNotice,
      refreshSessions,
      updateTitleFromMessages
    ]
  )

  const renameSession = useCallback(
    async (sessionId: string, title: string, cwdOverride?: string) => {
      const active = tabsRef.current.get(activeTabIdRef.current)
      const info = sessionsRef.current.find((item) => item.sessionId === sessionId)
      const cwd = cwdOverride || info?.cwd || active?.cwd || cwdRef.current
      if (!cwd) return
      try {
        await window.desk.renameSession(sessionId, title, cwd)
        await refreshSessions(cwd)
        if (active) pushNotice(active, '会话已重命名')
      } catch (error) {
        if (active) pushNotice(active, `重命名失败：${errorText(error)}`, 'error')
      }
    },
    [pushNotice, refreshSessions]
  )

  const forkSession = useCallback(
    async (sessionId: string, cwdOverride?: string) => {
      const active = tabsRef.current.get(activeTabIdRef.current)
      const info = sessionsRef.current.find((item) => item.sessionId === sessionId)
      const cwd = cwdOverride || info?.cwd || active?.cwd || cwdRef.current
      if (!cwd) return
      try {
        const forkedId = await window.desk.forkSession(sessionId, cwd)
        await refreshSessions(cwd)
        await selectSession(forkedId, cwd)
      } catch (error) {
        if (active) pushNotice(active, `创建分支失败：${errorText(error)}`, 'error')
      }
    },
    [pushNotice, refreshSessions, selectSession]
  )

  const copySession = useCallback(
    async (
      session: SessionInfo,
      targetCwd: string,
      mode: SessionCopyMode
    ): Promise<string> => {
      const sourceCwd =
        session.cwd ||
        tabsRef.current.get(activeTabIdRef.current)?.cwd ||
        cwdRef.current
      const newId = await window.desk.copySession(
        session.sessionId,
        sourceCwd,
        targetCwd,
        mode
      )
      const title = session.customTitle || session.summary
      if (title) {
        await window.desk
          .renameSession(newId, title, targetCwd)
          .catch(() => undefined)
      }
      if (mode === 'move') {
        const current = settingsRef.current
        const hidden = current?.preferences.hiddenSessions || []
        if (current && !hidden.includes(session.sessionId)) {
          const preferences = await window.desk.savePreferences({
            hiddenSessions: [...hidden, session.sessionId]
          })
          const updated = { ...current, preferences }
          settingsRef.current = updated
          setSettings(updated)
        }
      }
      await rememberWorkspace(targetCwd).catch(() => undefined)
      await refreshSessions(targetCwd)
      await selectSession(newId, targetCwd)
      if (mode === 'move') {
        const oldTab = [...tabsRef.current.values()].find(
          (tab) => tab.sessionId === session.sessionId
        )
        if (oldTab) closeTab(oldTab.id)
      }
      return newId
    },
    [closeTab, refreshSessions, rememberWorkspace, selectSession]
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
      const previousTitle = tab.title
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
      if (forkedId && previousTitle && previousTitle !== '新对话') {
        // A fork normally gets a "(fork)" summary. Keep the original title so
        // edit/withdraw feels like the same conversation continues.
        try {
          await window.desk.renameSession(forkedId, previousTitle, tab.cwd)
        } catch {
          // Best effort; the tab keeps the local title below.
        }
      }
      if (tab.workStartedAt) {
        tab.workElapsedMs += Math.max(0, Date.now() - tab.workStartedAt)
        tab.workStartedAt = undefined
      }
      tab.messages = remaining
      tab.tasks = []
      tab.streamIds.clear()
      tab.rateMeter.reset()
      tab.permissions = []
      tab.sessionId = forkedId
      tab.started = false
      tab.title = previousTitle || tab.title
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
      tab.modelOverride = undefined
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
              palette: 'claude' as const,
              compactMode: false,
              recentWorkspaces: [],
              projectFolders: [],
              workspaceFolderMap: {},
              chatSettings: {},
              lastChatSettings: {},
              hiddenSessions: []
            },
            permissionRules: { allow: [], ask: [], deny: [] },
            profiles: [],
            customModels: [],
            webSearch: EMPTY_WEB_SEARCH
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
            customModels: [],
            webSearch: EMPTY_WEB_SEARCH
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
      const api =
        current.api.profileId === id
          ? { ...current.api, profileId: undefined }
          : current.api
      const updated = { ...current, api, profiles }
      settingsRef.current = updated
      setSettings(updated)
    }
    return profiles
  }, [])

  const applyApiProfile = useCallback(
    async (id: string, restartActive = true) => {
      const active = tabsRef.current.get(activeTabIdRef.current)
      if (restartActive && active?.state.running) {
        if (active) pushNotice(active, '请先停止当前任务再切换订阅', 'error')
        throw new Error('Stop the current task before switching subscriptions.')
      }
      const current = settingsRef.current
      const profileName = current?.profiles.find((profile) => profile.id === id)?.name
      const api = await window.desk.applyApiProfile(id)
      if (current) {
        const updated = { ...current, api }
        settingsRef.current = updated
        setSettings(updated)
      }
      const nextModels = [...fallbackModelsFor(api.providerId)]
      if (api.model && !nextModels.some((model) => model.id === api.model)) {
        nextModels.push({ id: api.model, name: api.model })
      }
      modelsRef.current = nextModels
      setModels(nextModels)
      // Model discovery can be slow; never make the subscription switch wait.
      const switchTarget = api.profileId
      void window.desk
        .getModels()
        .then((list) => {
          if (list.length === 0) return
          if (settingsRef.current?.api.profileId !== switchTarget) return
          modelsRef.current = list
          setModels(list)
        })
        .catch(() => undefined)
      if (!restartActive) return api

      const tab = tabsRef.current.get(activeTabIdRef.current)
      if (!tab) return api
      const nextModel = api.model || tab.state.model
      const wasStarted = tab.started
      await window.desk.stopSession(tab.id).catch(() => undefined)
      tab.started = false
      tab.modelOverride = nextModel
      tab.state = { ...tab.state, model: nextModel, sessionId: tab.sessionId }
      publish(tab)
      void persistChatSettings(tab, { model: nextModel })
      if (wasStarted) {
        try {
          const state = await window.desk.startSession(tab.id, {
            cwd: tab.cwd,
            model: nextModel,
            permissionMode: tab.state.permissionMode,
            effort: tab.effort,
            resume: tab.sessionId
          })
          tab.started = true
          tab.sessionId = state.sessionId || tab.sessionId
          applyState(tab, state)
          publish(tab)
          pushNotice(tab, `已切换到订阅${profileName ? `「${profileName}」` : ''}`)
        } catch (error) {
          pushNotice(tab, `切换订阅后重启会话失败：${errorText(error)}`, 'error')
        }
      } else {
        pushNotice(
          tab,
          `已切换到订阅${profileName ? `「${profileName}」` : ''}，新消息将使用新账号`
        )
      }
      return api
    },
    [applyState, persistChatSettings, publish, pushNotice]
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

  const saveWebSearch = useCallback(
    async (patch: WebSearchPatch): Promise<WebSearchSettings> => {
      const webSearch = await window.desk.saveWebSearchSettings(patch)
      const current = settingsRef.current
      if (current) {
        const updated = { ...current, webSearch }
        settingsRef.current = updated
        setSettings(updated)
      }
      return webSearch
    },
    []
  )

  const testWebSearch = useCallback(
    (patch?: WebSearchPatch): Promise<WebSearchTestResult> =>
      window.desk.testWebSearch(patch),
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
    const nextMap = { ...(current.preferences.workspaceFolderMap || {}) }
    delete nextMap[path]
    const preferences = await window.desk.savePreferences({
      recentWorkspaces: next,
      workspaceFolderMap: nextMap
    })
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

  const stopTask = useCallback(
    async (taskId: string): Promise<void> => {
      const tab = tabsRef.current.get(activeTabIdRef.current)
      if (!tab) return
      try {
        await window.desk.stopTask(tab.id, taskId)
        const task = tab.tasks.find((item) => item.id === taskId)
        if (task) {
          task.status = 'stopped'
          task.updatedAt = Date.now()
          publish(tab)
        }
      } catch (error) {
        pushNotice(tab, `停止任务失败：${errorText(error)}`, 'error')
      }
    },
    [publish, pushNotice]
  )

  return {
    booted,
    bootError,
    defaults,
    settings,
    models,
    cwd,
    sessions,
    sessionsHasMore,
    sessionsLoadingMore,
    loadMoreSessions,
    tabs,
    tabOrder,
    activeTabId,
    remoteActivity,
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
    openProject,
    relocateWorkspace,
    pickProject,
    selectSession,
    sendMessage,
    stop,
    stopTask,
    renameSession,
    forkSession,
    copySession,
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
    saveWebSearch,
    testWebSearch,
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
