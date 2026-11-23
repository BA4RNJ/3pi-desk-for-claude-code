import {
  Blocks,
  Download,
  ExternalLink,
  FolderOpen,
  FolderPlus,
  Gauge,
  Globe,
  Info,
  KeyRound,
  Monitor,
  Moon,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Shield,
  Sun,
  Terminal,
  Trash2,
  X
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  ApiAuthMode,
  ApiProfile,
  ApiProfileInput,
  ApiSettingsPatch,
  AppDefaults,
  AppPreferences,
  ClaudeCliStatus,
  CustomModel,
  ModelOption,
  PermissionRules,
  SettingsSnapshot,
  TestApiResult,
  ThemePalette,
  WebSearchPatch,
  WebSearchSettings,
  WebSearchTestResult
} from '../../../shared/types'
import {
  PROVIDER_PRESETS,
  findProviderPreset,
  providerDisplayName
} from '../../../shared/providers'
import { isWebSearchConfigured } from '../../../shared/web-search'
import type { TabView, ThemeMode } from '../types'
import type { Language } from '../i18n'
import { formatCost, formatTokens } from '../lib/format'
import { AboutPanel } from './AboutPanel'
import { BackgroundPanel } from './BackgroundPanel'
import { ExtensionsPanel } from './ExtensionsPanel'
import { AppMark } from './AppMark'
import { RemotePanel } from './RemotePanel'
import { UsagePanel } from './UsagePanel'

export type SettingsTab =
  | 'general'
  | 'api'
  | 'permissions'
  | 'extensions'
  | 'background'
  | 'remote'
  | 'usage'
  | 'about'

interface SettingsDialogProps {
  initialTab?: SettingsTab
  theme: ThemeMode
  language: Language
  settings: SettingsSnapshot | null
  models: ModelOption[]
  defaults: AppDefaults | null
  activeTab?: TabView
  onThemeChange: (theme: ThemeMode) => void
  onLanguageChange: (language: Language) => void
  onClose: () => void
  onSaveApi: (patch: ApiSettingsPatch) => Promise<void>
  onSavePreferences: (patch: Partial<AppPreferences>) => Promise<void>
  onTestApi: (patch?: ApiSettingsPatch) => Promise<TestApiResult>
  onSavePermissionRules: (rules: PermissionRules) => Promise<PermissionRules>
  webSearch?: WebSearchSettings
  onSaveWebSearch: (patch: WebSearchPatch) => Promise<WebSearchSettings>
  onTestWebSearch: (patch?: WebSearchPatch) => Promise<WebSearchTestResult>
  onSaveCustomModel: (model: CustomModel) => Promise<CustomModel[]>
  onDeleteCustomModel: (id: string, providerId?: string) => Promise<CustomModel[]>
  onSaveApiProfile: (profile: ApiProfileInput) => Promise<ApiProfile[]>
  onDeleteApiProfile: (id: string) => Promise<ApiProfile[]>
  onApplyApiProfile: (id: string, restartActive?: boolean) => Promise<unknown>
  onOpenConsole: (providerId?: string) => void
  onOpenPath: (path: string) => void
  claudeCli: ClaudeCliStatus | null
  onRefreshClaudeCli: () => Promise<ClaudeCliStatus>
  onDownloadClaudeCli: () => Promise<ClaudeCliStatus>
  onPickClaudeCli: () => Promise<ClaudeCliStatus | null>
  onClearClaudeCliPath: () => Promise<ClaudeCliStatus>
}

const THEMES: Array<{ id: ThemeMode; label: string; icon: typeof Sun }> = [
  { id: 'light', label: '浅色', icon: Sun },
  { id: 'dark', label: '深色', icon: Moon },
  { id: 'system', label: '跟随系统', icon: Monitor }
]

const WEB_SEARCH_PROVIDERS: Array<{
  id: WebSearchSettings['provider']
  label: string
  hint: string
}> = [
  { id: 'duckduckgo', label: 'DuckDuckGo', hint: '无需密钥，适合直接开始；可能受频率限制。' },
  { id: 'bing', label: 'Bing', hint: '无需密钥；在 DuckDuckGo 受限的网络中可用。' },
  { id: 'baidu', label: 'Baidu', hint: '无需密钥；适合中文网络和中文结果。' },
  { id: 'searxng', label: 'SearXNG', hint: '填写自建或可用的 SearXNG 地址，需开启 JSON 输出。' },
  { id: 'tavily', label: 'Tavily', hint: '需要 Tavily API Key，结果质量稳定。' },
  { id: 'brave', label: 'Brave Search', hint: '需要 Brave Search API Key。' }
]

const PALETTES: Array<{ id: ThemePalette; label: string; hint: string }> = [
  { id: 'claude', label: '卡其暖色', hint: 'Claude Code 风格' },
  { id: 'mono', label: '黑白', hint: '中性灰阶' },
  { id: 'blue', label: '蓝白', hint: '冷色工作台' },
  { id: 'green', label: '绿白', hint: '柔和护眼' }
]

const PRESET_ACCENTS = ['coral', 'blue', 'green', 'purple'] as const

const ACCENT_HEX: Record<string, string> = {
  coral: '#d97757',
  blue: '#5b7fc7',
  green: '#4f8a63',
  purple: '#7d6bb0'
}

const PALETTE_ACCENTS: Record<ThemePalette, string> = {
  claude: 'coral',
  mono: '#4a4a4a',
  blue: 'blue',
  green: 'green'
}

const NAV: Array<{ id: SettingsTab; label: string; icon: typeof Settings }> = [
  { id: 'general', label: '常规', icon: Settings },
  { id: 'api', label: 'API', icon: KeyRound },
  { id: 'permissions', label: '权限', icon: Shield },
  { id: 'extensions', label: '扩展', icon: Blocks },
  { id: 'background', label: '后台', icon: Terminal },
  { id: 'remote', label: '远程访问', icon: Globe },
  { id: 'usage', label: '用量', icon: Gauge },
  { id: 'about', label: '关于', icon: Info }
]

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const CLI_SOURCE_LABELS: Record<ClaudeCliStatus['source'], string> = {
  env: '环境变量',
  setting: '手动指定',
  bundled: '应用内置',
  cached: '已下载',
  system: '系统安装',
  missing: '未找到'
}

function formatBytes(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value) || value <= 0) return '—'
  return `${Math.round(value / (1024 * 1024))} MB`
}

export function SettingsDialog({
  initialTab = 'general',
  theme,
  language,
  settings,
  models,
  defaults,
  activeTab,
  onThemeChange,
  onLanguageChange,
  onClose,
  onSaveApi,
  onSavePreferences,
  onTestApi,
  onSavePermissionRules,
  webSearch,
  onSaveWebSearch,
  onTestWebSearch,
  onSaveCustomModel,
  onDeleteCustomModel,
  onSaveApiProfile,
  onDeleteApiProfile,
  onApplyApiProfile,
  onOpenConsole,
  onOpenPath,
  claudeCli,
  onRefreshClaudeCli,
  onDownloadClaudeCli,
  onPickClaudeCli,
  onClearClaudeCliPath
}: SettingsDialogProps) {
  const [tab, setTab] = useState<SettingsTab>(initialTab)
  const [preferences, setPreferences] = useState<AppPreferences>(
    settings?.preferences || {
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
      accent: 'coral',
      palette: 'claude',
      compactMode: false,
      recentWorkspaces: [],
      projectFolders: [],
      workspaceFolderMap: {},
      chatSettings: {},
      lastChatSettings: {},
      hiddenSessions: []
    }
  )
  const [providerId, setProviderId] = useState(
    settings?.api.providerId ||
      findProviderPreset(settings?.api.baseUrl)?.id ||
      'custom'
  )
  const [baseUrl, setBaseUrl] = useState(settings?.api.baseUrl || '')
  const [model, setModel] = useState(settings?.api.model || '')
  const [token, setToken] = useState('')
  const [authMode, setAuthMode] = useState<ApiAuthMode>(
    settings?.api.authMode ||
      (settings?.api.providerId === 'anthropic' ? 'apiKey' : 'bearer')
  )
  const [customModels, setCustomModels] = useState<CustomModel[]>(
    settings?.customModels || []
  )
  const [customModelId, setCustomModelId] = useState('')
  const [customModelName, setCustomModelName] = useState('')
  const [customModelContext, setCustomModelContext] = useState('')
  const [customBusy, setCustomBusy] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [savingApi, setSavingApi] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState('')
  const [testResult, setTestResult] = useState<TestApiResult | null>(null)
  const [rules, setRules] = useState<PermissionRules>(
    settings?.permissionRules || { allow: [], ask: [], deny: [] }
  )
  const [allowText, setAllowText] = useState('')
  const [askText, setAskText] = useState('')
  const [denyText, setDenyText] = useState('')
  const [profileName, setProfileName] = useState('')
  const [apiFormOpen, setApiFormOpen] = useState(false)
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
  const [cliBusy, setCliBusy] = useState(false)
  const [cliError, setCliError] = useState('')
  const [webSearchDraft, setWebSearchDraft] = useState<WebSearchSettings>(
    webSearch || {
      enabled: true,
      provider: 'duckduckgo',
      endpoint: '',
      hasApiKey: false,
      apiKeyMasked: '',
      maxResults: 6
    }
  )
  const [webSearchKey, setWebSearchKey] = useState('')
  const [webSearchBusy, setWebSearchBusy] = useState(false)
  const [webSearchResult, setWebSearchResult] = useState<WebSearchTestResult | null>(null)

  useEffect(() => {
    if (settings) {
      setPreferences(settings.preferences)
      setProviderId(
        settings.api.providerId ||
          findProviderPreset(settings.api.baseUrl)?.id ||
          'custom'
      )
      setBaseUrl(settings.api.baseUrl)
      setModel(settings.api.model)
      setAuthMode(
        settings.api.authMode ||
          (settings.api.providerId === 'anthropic' ? 'apiKey' : 'bearer')
      )
      setCustomModels(settings.customModels)
      setRules(settings.permissionRules)
      setAllowText(settings.permissionRules.allow.join('\n'))
      setAskText(settings.permissionRules.ask.join('\n'))
      setDenyText(settings.permissionRules.deny.join('\n'))
    }
  }, [settings])

  useEffect(() => {
    if (webSearch) setWebSearchDraft(webSearch)
  }, [webSearch])

  const provider = findProviderPreset(providerId)
  const cliProgress = claudeCli?.progress
  const cliPercent =
    cliProgress?.total && cliProgress.total > 0
      ? Math.min(100, Math.round((cliProgress.received / cliProgress.total) * 100))
      : null
  const savedProviderId =
    settings?.api.providerId || findProviderPreset(settings?.api.baseUrl)?.id || 'custom'
  const formNeedsToken =
    !editingProfileId &&
    !token.trim() &&
    providerId !== 'ollama' &&
    !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(baseUrl.trim())
  const webSearchUsable =
    !webSearchDraft.enabled ||
    isWebSearchConfigured({
      provider: webSearchDraft.provider,
      endpoint: webSearchDraft.endpoint,
      apiKey: webSearchKey || (webSearchDraft.hasApiKey ? 'saved' : ''),
      maxResults: webSearchDraft.maxResults,
      enabled: webSearchDraft.enabled
    })
  const isLocalUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(
    baseUrl.trim()
  )
  const providerModels = useMemo(
    () =>
      customModels.filter(
        (entry) => !entry.providerId || entry.providerId === providerId
      ),
    [customModels, providerId]
  )
  const visibleModels = useMemo(() => {
    const base =
      testResult?.models && testResult.models.length > 0
        ? testResult.models
        : providerId === savedProviderId
          ? models
          : []
    const map = new Map<string, ModelOption>()
    for (const entry of base) map.set(entry.id, entry)
    for (const entry of providerModels) {
      const existing = map.get(entry.id)
      map.set(entry.id, {
        id: entry.id,
        name: entry.name || existing?.name || entry.id,
        description: existing?.description,
        contextWindow: entry.contextWindow ?? existing?.contextWindow,
        maxOutput: existing?.maxOutput,
        effortLevels: existing?.effortLevels,
        supportsImages: existing?.supportsImages,
        pricing: existing?.pricing
      })
    }
    return [...map.values()]
  }, [models, providerId, providerModels, savedProviderId, testResult])

  const selectProvider = (preset: (typeof PROVIDER_PRESETS)[number]): void => {
    const changed = preset.id !== providerId
    setProviderId(preset.id)
    if (preset.baseUrl) setBaseUrl(preset.baseUrl)
    setAuthMode(preset.authMode || 'bearer')
    if (changed) setToken('')
    if (preset.defaultModel) setModel(preset.defaultModel)
    else if (changed) setModel('')
    setTestResult(null)
    setMessage('')
  }

  const addCustomModel = async (): Promise<void> => {
    const id = customModelId.trim()
    if (!id || customBusy) return
    setCustomBusy(true)
    setMessage('')
    try {
      const contextWindow = Number(customModelContext)
      const list = await onSaveCustomModel({
        id,
        name: customModelName.trim() || undefined,
        contextWindow: contextWindow > 0 ? contextWindow : undefined,
        providerId
      })
      setCustomModels(list)
      setCustomModelId('')
      setCustomModelName('')
      setCustomModelContext('')
      setMessage('模型已添加')
    } catch (addError) {
      setMessage(errorText(addError))
    } finally {
      setCustomBusy(false)
    }
  }

  const removeCustomModel = async (entry: CustomModel): Promise<void> => {
    if (customBusy) return
    setCustomBusy(true)
    setMessage('')
    const previous = customModels
    setCustomModels(
      previous.filter(
        (model) => !(model.id === entry.id && model.providerId === entry.providerId)
      )
    )
    try {
      const list = await onDeleteCustomModel(entry.id, entry.providerId)
      setCustomModels(list)
      setMessage('模型已移除')
    } catch (removeError) {
      setCustomModels(previous)
      setMessage(errorText(removeError))
    } finally {
      setCustomBusy(false)
    }
  }

  const runCli = async (action: () => Promise<unknown>): Promise<void> => {
    setCliBusy(true)
    setCliError('')
    try {
      await action()
    } catch (cliActionError) {
      setCliError(errorText(cliActionError))
    } finally {
      setCliBusy(false)
    }
  }

  const savePrefs = async (): Promise<void> => {
    setSavingPrefs(true)
    setMessage('')
    try {
      // Send only the fields this dialog edits. Sending the whole preferences
      // object would overwrite recent workspaces, pinned sessions, and
      // per-conversation settings that may have changed while it was open.
      await onSavePreferences({
        ideIntegration: preferences.ideIntegration,
        chromeIntegration: preferences.chromeIntegration,
        maxBudgetUsd: preferences.maxBudgetUsd,
        closeToTray: preferences.closeToTray,
        globalShortcut: preferences.globalShortcut,
        fontScale: preferences.fontScale,
        accent: preferences.accent,
        palette: preferences.palette,
        compactMode: preferences.compactMode,
        additionalDirectories: preferences.additionalDirectories,
        allowedTools: preferences.allowedTools,
        disallowedTools: preferences.disallowedTools
      })
      setMessage('偏好已保存，集成开关对新会话生效')
    } catch (saveError) {
      setMessage(errorText(saveError))
    } finally {
      setSavingPrefs(false)
    }
  }

  const saveWebSearch = async (): Promise<void> => {
    setWebSearchBusy(true)
    setMessage('')
    setWebSearchResult(null)
    try {
      const next = await onSaveWebSearch({
        enabled: webSearchDraft.enabled,
        provider: webSearchDraft.provider,
        endpoint: webSearchDraft.endpoint,
        maxResults: webSearchDraft.maxResults,
        apiKey: webSearchKey.trim() ? webSearchKey.trim() : undefined
      })
      setWebSearchDraft(next)
      setWebSearchKey('')
      setMessage('联网搜索设置已保存，新会话生效')
    } catch (saveError) {
      setMessage(errorText(saveError))
    } finally {
      setWebSearchBusy(false)
    }
  }

  const clearWebSearchKey = async (): Promise<void> => {
    setWebSearchBusy(true)
    setMessage('')
    try {
      const next = await onSaveWebSearch({ apiKey: null })
      setWebSearchDraft(next)
      setWebSearchKey('')
      setMessage('已清除搜索 API Key')
    } catch (saveError) {
      setMessage(errorText(saveError))
    } finally {
      setWebSearchBusy(false)
    }
  }

  const testWebSearch = async (): Promise<void> => {
    setWebSearchBusy(true)
    setMessage('')
    setWebSearchResult(null)
    try {
      const result = await onTestWebSearch({
        enabled: webSearchDraft.enabled,
        provider: webSearchDraft.provider,
        endpoint: webSearchDraft.endpoint,
        maxResults: webSearchDraft.maxResults,
        apiKey: webSearchKey.trim() ? webSearchKey.trim() : undefined
      })
      setWebSearchResult(result)
    } catch (testError) {
      setWebSearchResult({
        ok: false,
        provider: webSearchDraft.provider,
        error: errorText(testError)
      })
    } finally {
      setWebSearchBusy(false)
    }
  }

  const savePermissions = async (): Promise<void> => {
    setSavingPrefs(true)
    setMessage('')
    try {
      await onSavePreferences({
        additionalDirectories: preferences.additionalDirectories,
        allowedTools: preferences.allowedTools,
        disallowedTools: preferences.disallowedTools
      })
      const next = await onSavePermissionRules({
        allow: allowText.split('\n').map((line) => line.trim()).filter(Boolean),
        ask: askText.split('\n').map((line) => line.trim()).filter(Boolean),
        deny: denyText.split('\n').map((line) => line.trim()).filter(Boolean)
      })
      setRules(next)
      setMessage('权限设置已保存，新会话生效')
    } catch (saveError) {
      setMessage(errorText(saveError))
    } finally {
      setSavingPrefs(false)
    }
  }

  const addDirectory = async (): Promise<void> => {
    const directory = await window.desk.pickDirectory(activeTab?.cwd || defaults?.cwd)
    if (!directory) return
    if (preferences.additionalDirectories.includes(directory)) return
    setPreferences((value) => ({
      ...value,
      additionalDirectories: [...value.additionalDirectories, directory]
    }))
  }

  const saveApi = async (): Promise<void> => {
    setSavingApi(true)
    setMessage('')
    setTestResult(null)
    try {
      await onSaveApi({
        baseUrl,
        model,
        token: token || undefined,
        providerId,
        authMode
      })
      setToken('')
      setTestResult(null)
      setMessage('API 配置已保存，新会话生效')
    } catch (saveError) {
      setMessage(errorText(saveError))
    } finally {
      setSavingApi(false)
    }
  }

  const test = async (): Promise<void> => {
    setTesting(true)
    setMessage('')
    setTestResult(null)
    try {
      const result = await onTestApi({
        baseUrl,
        model,
        token: token || undefined,
        providerId,
        authMode
      })
      setTestResult(result)
      if (result.ok && result.authMode) setAuthMode(result.authMode)
      if (result.ok && result.discoveredModel) {
        setModel(result.discoveredModel)
        setMessage(`已自动选择模型 ${result.discoveredModel}`)
      }
    } catch (testError) {
      setTestResult({ ok: false, error: errorText(testError) })
    } finally {
      setTesting(false)
    }
  }

  const effectiveActiveProfileId =
    settings?.api.profileId ||
    settings?.profiles.find(
      (profile) =>
        profile.baseUrl === settings.api.baseUrl &&
        profile.model === settings.api.model
    )?.id
  const activeProfile =
    settings?.profiles.find((profile) => profile.id === effectiveActiveProfileId) || null
  const editingProfile = editingProfileId
    ? settings?.profiles.find((profile) => profile.id === editingProfileId) || null
    : null
  const openNewApiForm = (): void => {
    const api = settings?.api
    const nextProviderId =
      api?.providerId || findProviderPreset(api?.baseUrl)?.id || 'custom'
    setEditingProfileId(null)
    setProfileName('')
    setProviderId(nextProviderId)
    setBaseUrl(api?.baseUrl || '')
    setModel(api?.model || '')
    setAuthMode(api?.authMode || (nextProviderId === 'anthropic' ? 'apiKey' : 'bearer'))
    setToken('')
    setTestResult(null)
    setMessage('')
    setApiFormOpen(true)
  }

  const openEditApiProfile = (profile: ApiProfile): void => {
    const nextProviderId =
      profile.providerId || findProviderPreset(profile.baseUrl)?.id || 'custom'
    setEditingProfileId(profile.id)
    setProfileName(profile.name)
    setProviderId(nextProviderId)
    setBaseUrl(profile.baseUrl)
    setModel(profile.model)
    setAuthMode(
      profile.authMode || (nextProviderId === 'anthropic' ? 'apiKey' : 'bearer')
    )
    setToken('')
    setTestResult(null)
    setMessage('')
    setApiFormOpen(true)
  }

  const cancelApiForm = (): void => {
    setApiFormOpen(false)
    setEditingProfileId(null)
    setProfileName('')
    setToken('')
    setTestResult(null)
    setMessage('')
  }

  const saveApiForm = async (): Promise<void> => {
    if (savingApi) return
    if (!baseUrl.trim() || !model.trim() || formNeedsToken) return
    setSavingApi(true)
    setMessage('')
    try {
      const before = new Set((settings?.profiles || []).map((profile) => profile.id))
      const name =
        profileName.trim() ||
        `${providerDisplayName(providerId)} ${model.trim() || '订阅'}`
      const next = await onSaveApiProfile({
        id: editingProfileId || undefined,
        name,
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        token: token.trim() || undefined,
        providerId,
        authMode
      })
      const target =
        editingProfileId || next.find((profile) => !before.has(profile.id))?.id
      if (!target) throw new Error('配置保存失败')
      await onApplyApiProfile(target, !activeTab?.state.running)
      setApiFormOpen(false)
      setEditingProfileId(null)
      setProfileName('')
      setToken('')
      setTestResult(null)
      setMessage('配置已保存并设为当前；新会话生效')
    } catch (error) {
      setMessage(errorText(error))
    } finally {
      setSavingApi(false)
    }
  }

  const canSave =
    tab === 'general' ||
    tab === 'permissions' ||
    (tab === 'api' && apiFormOpen)
  const saving = tab === 'api' ? savingApi : savingPrefs

  const saveCurrent = async (): Promise<void> => {
    if (tab === 'general') {
      await savePrefs()
      await saveWebSearch()
    } else if (tab === 'api') {
      await saveApiForm()
    } else if (tab === 'permissions') {
      await savePermissions()
    }
  }
  const saveCurrentRef = useRef(saveCurrent)
  saveCurrentRef.current = saveCurrent

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (canSave) void saveCurrentRef.current()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [canSave, onClose])

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="settings-shell" role="dialog" aria-modal="true" aria-label="设置">
        <div className="settings-sidebar">
          <div className="settings-brand">
            <AppMark size={40} className="settings-mark" />
            <div>
              <h2>3PI Desk</h2>
              <p>AI 编程工作台 · v{defaults?.appVersion || '—'}</p>
            </div>
          </div>
          <nav className="settings-nav">
            {NAV.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  className={tab === item.id ? 'is-active' : ''}
                  onClick={() => {
                    setTab(item.id)
                    setMessage('')
                  }}
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              )
            })}
          </nav>
          <div className="settings-version">
            <span>{providerDisplayName(providerId)}</span>
            <strong>{model || '未选择模型'}</strong>
          </div>
        </div>

        <div className="settings-content-wrap">
          <div className="settings-topbar">
            {canSave && (
              <button
                type="button"
                className="button primary settings-save-top"
                disabled={saving}
                onClick={() => void saveCurrent()}
              >
                <Save size={14} /> 保存
              </button>
            )}
            <button
              type="button"
              className="icon-button settings-close"
              onClick={onClose}
              aria-label="关闭"
              title="关闭设置（Esc）"
            >
              <X size={16} />
            </button>
          </div>

          <div className="settings-content">
          {tab === 'general' && (
            <div className="settings-page">
              <h3>常规</h3>
              <p className="settings-page-sub">外观、集成与会话预算。</p>

              <div className="settings-group">
                <span className="settings-label">外观</span>
                <div className="segmented">
                  {THEMES.map((option) => {
                    const Icon = option.icon
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`segment ${theme === option.id ? 'is-active' : ''}`}
                        onClick={() => onThemeChange(option.id)}
                      >
                        <Icon size={15} />
                        <span>{option.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="settings-group">
                <span className="settings-label">配色风格</span>
                <div className="palette-grid">
                  {PALETTES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`palette-option palette-${option.id} ${
                        (preferences.palette || 'claude') === option.id ? 'is-active' : ''
                      }`}
                      onClick={() =>
                        setPreferences((value) => ({
                          ...value,
                          palette: option.id,
                          accent: PALETTE_ACCENTS[option.id]
                        }))
                      }
                    >
                      <span className="palette-preview" />
                      <strong>{option.label}</strong>
                      <small>{option.hint}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-group">
                <span className="settings-label">语言</span>
                <div className="segmented">
                  <button
                    type="button"
                    className={`segment ${language === 'en' ? 'is-active' : ''}`}
                    onClick={() => onLanguageChange('en')}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    className={`segment ${language === 'zh' ? 'is-active' : ''}`}
                    onClick={() => onLanguageChange('zh')}
                  >
                    中文
                  </button>
                </div>
              </div>

              <div className="settings-group">
                <span className="settings-label">Claude Code CLI</span>
                <div className="settings-rows">
                  <div className="settings-row">
                    <span>状态</span>
                    <strong>
                      {claudeCli ? CLI_SOURCE_LABELS[claudeCli.source] : '检测中…'}
                    </strong>
                  </div>
                  <div className="settings-row">
                    <span>路径</span>
                    <strong title={claudeCli?.path}>{claudeCli?.path || '—'}</strong>
                  </div>
                  <div className="settings-row">
                    <span>版本</span>
                    <strong>{claudeCli?.version || '—'}</strong>
                  </div>
                </div>
                <p className="settings-note">应用不再内置 CLI：优先使用本机已安装的 claude，其次使用已下载的版本。没有找到时可以下载官方 CLI（约 146 MB），或手动选择可执行文件。</p>
                {claudeCli?.downloading && (
                  <div className="cli-progress">
                    <div className="cli-progress-track">
                      <div
                        className="cli-progress-value"
                        style={{ width: cliPercent != null ? `${cliPercent}%` : '35%' }}
                      />
                    </div>
                    <span className="cli-progress-text">
                      {cliProgress?.phase === 'extract'
                        ? '正在解压…'
                        : `正在下载… ${formatBytes(cliProgress?.received)}${
                            cliProgress?.total
                              ? ` / ${formatBytes(cliProgress.total)}`
                              : ''
                          }`}
                    </span>
                  </div>
                )}
                {cliError && <p className="settings-note cli-error">{cliError}</p>}
                {!cliError && claudeCli?.error && (
                  <p className="settings-note cli-error">{claudeCli.error}</p>
                )}
                <div className="cli-settings-actions">
                  <button
                    type="button"
                    className="button"
                    disabled={cliBusy || claudeCli?.downloading}
                    onClick={() => void runCli(onRefreshClaudeCli)}
                  >
                    <RefreshCw size={14} /> 重新检测
                  </button>
                  {claudeCli?.source === 'missing' && (
                    <button
                      type="button"
                      className="button primary"
                      disabled={cliBusy || claudeCli.downloading}
                      onClick={() => void runCli(onDownloadClaudeCli)}
                    >
                      <Download size={14} /> 下载 CLI
                    </button>
                  )}
                  <button
                    type="button"
                    className="button"
                    disabled={cliBusy || claudeCli?.downloading}
                    onClick={() => void runCli(onPickClaudeCli)}
                  >
                    <FolderOpen size={14} /> 选择已有安装
                  </button>
                  {claudeCli?.source === 'setting' && (
                    <button
                      type="button"
                      className="button"
                      disabled={cliBusy || claudeCli.downloading}
                      onClick={() => void runCli(onClearClaudeCliPath)}
                    >
                      恢复自动检测
                    </button>
                  )}
                </div>
              </div>

              <div className="settings-group">
                <span className="settings-label">字号</span>
                <div className="segmented">
                  {[
                    { value: 0.9, label: '小' },
                    { value: 1, label: '标准' },
                    { value: 1.1, label: '大' },
                    { value: 1.2, label: '特大' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`segment ${preferences.fontScale === option.value ? 'is-active' : ''}`}
                      onClick={() =>
                        setPreferences((value) => ({
                          ...value,
                          fontScale: option.value
                        }))
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-group">
                <span className="settings-label">强调色</span>
                <div className="accent-row">
                  {PRESET_ACCENTS.map((accent) => (
                    <button
                      key={accent}
                      type="button"
                      className={`accent-swatch accent-${accent} ${
                        preferences.accent === accent ? 'is-active' : ''
                      }`}
                      onClick={() =>
                        setPreferences((value) => ({ ...value, accent }))
                      }
                      aria-label={accent}
                    />
                  ))}
                  <label className="accent-custom" title="自定义强调色">
                    <input
                      type="color"
                      value={
                        /^#[0-9a-f]{6}$/i.test(preferences.accent)
                          ? preferences.accent
                          : ACCENT_HEX[preferences.accent] || '#d97757'
                      }
                      onChange={(event) =>
                        setPreferences((value) => ({
                          ...value,
                          accent: event.target.value
                        }))
                      }
                    />
                    <span>自定义</span>
                  </label>
                </div>
              </div>

              <div className="settings-group">
                <label className="toggle-row">
                  <div>
                    <strong>紧凑模式</strong>
                    <small>减少间距，一屏显示更多内容。</small>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.compactMode}
                    onChange={(event) =>
                      setPreferences((value) => ({
                        ...value,
                        compactMode: event.target.checked
                      }))
                    }
                  />
                </label>
              </div>

              <div className="settings-group">
                <span className="settings-label">集成（新会话生效）</span>
                <label className="toggle-row">
                  <div>
                    <strong>连接 IDE</strong>
                    <small>向引擎传入 --ide，需要已安装对应 IDE 扩展。</small>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.ideIntegration}
                    onChange={(event) =>
                      setPreferences((value) => ({
                        ...value,
                        ideIntegration: event.target.checked
                      }))
                    }
                  />
                </label>
                <label className="toggle-row">
                  <div>
                    <strong>Chrome 集成</strong>
                    <small>向引擎传入 --chrome，需要对应的 Chrome 扩展。</small>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.chromeIntegration}
                    onChange={(event) =>
                      setPreferences((value) => ({
                        ...value,
                        chromeIntegration: event.target.checked
                      }))
                    }
                  />
                </label>
                <label className="toggle-row">
                  <div>
                    <strong>关闭窗口时最小化到托盘</strong>
                    <small>
                      {defaults?.wsl
                        ? 'WSL 不提供系统托盘；在 WSL 中关闭窗口会直接退出。'
                        : '关闭窗口后应用继续在托盘运行。'}
                    </small>
                  </div>
                  <input
                    type="checkbox"
                    disabled={defaults?.wsl}
                    checked={preferences.closeToTray}
                    onChange={(event) =>
                      setPreferences((value) => ({
                        ...value,
                        closeToTray: event.target.checked
                      }))
                    }
                  />
                </label>
                <label className="toggle-row">
                  <div>
                    <strong>全局快捷键</strong>
                    <small>
                      {defaults?.wsl
                        ? 'WSL 不支持跨 Windows 的全局快捷键。'
                        : 'Ctrl/Cmd + Shift + Space 显示窗口（Wayland 下可能不可用）。'}
                    </small>
                  </div>
                  <input
                    type="checkbox"
                    disabled={defaults?.wsl}
                    checked={preferences.globalShortcut}
                    onChange={(event) =>
                      setPreferences((value) => ({
                        ...value,
                        globalShortcut: event.target.checked
                      }))
                    }
                  />
                </label>
              </div>

              <div className="settings-group">
                <span className="settings-label">联网搜索（新会话生效）</span>
                <label className="toggle-row">
                  <div>
                    <strong>启用内置联网搜索</strong>
                    <small>
                      通过应用内置的 MCP 工具搜索网页；第三方 Anthropic 兼容接口也能使用。
                    </small>
                  </div>
                  <input
                    type="checkbox"
                    checked={webSearchDraft.enabled}
                    onChange={(event) => {
                      setWebSearchDraft((value) => ({
                        ...value,
                        enabled: event.target.checked
                      }))
                      setWebSearchResult(null)
                    }}
                  />
                </label>
                <div className="settings-row">
                  <span>搜索服务</span>
                  <select
                    className="text-input web-search-select"
                    value={webSearchDraft.provider}
                    onChange={(event) => {
                      setWebSearchDraft((value) => ({
                        ...value,
                        provider: event.target.value as WebSearchSettings['provider']
                      }))
                      setWebSearchResult(null)
                    }}
                  >
                    {WEB_SEARCH_PROVIDERS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="settings-note">
                  {WEB_SEARCH_PROVIDERS.find((item) => item.id === webSearchDraft.provider)?.hint}
                </p>
                {!webSearchUsable && (
                  <p className="settings-note settings-note-warn">
                    当前配置不完整，新会话不会启用内置搜索；请填写实例地址或 API Key。
                  </p>
                )}
                {(webSearchDraft.provider === 'searxng' ||
                  webSearchDraft.provider === 'tavily' ||
                  webSearchDraft.provider === 'brave') && (
                  <div className="settings-row">
                    <span>{webSearchDraft.provider === 'searxng' ? '实例地址' : '接口地址（可选）'}</span>
                    <input
                      className="text-input"
                      value={webSearchDraft.endpoint}
                      placeholder={
                        webSearchDraft.provider === 'searxng'
                          ? 'https://searx.example.com'
                          : '留空使用官方地址'
                      }
                      spellCheck={false}
                      onChange={(event) =>
                        setWebSearchDraft((value) => ({
                          ...value,
                          endpoint: event.target.value
                        }))
                      }
                    />
                  </div>
                )}
                {(webSearchDraft.provider === 'tavily' ||
                  webSearchDraft.provider === 'brave' ||
                  webSearchDraft.provider === 'searxng') && (
                  <div className="settings-row">
                    <span>API Key</span>
                    <input
                      className="text-input"
                      type="password"
                      value={webSearchKey}
                      placeholder={
                        webSearchDraft.hasApiKey
                          ? `已保存：${webSearchDraft.apiKeyMasked}`
                          : '可选，部分实例需要'
                      }
                      spellCheck={false}
                      onChange={(event) => setWebSearchKey(event.target.value)}
                    />
                  </div>
                )}
                <div className="settings-row">
                  <span>每次结果数</span>
                  <input
                    className="text-input web-search-count"
                    type="number"
                    min={1}
                    max={10}
                    value={webSearchDraft.maxResults}
                    onChange={(event) =>
                      setWebSearchDraft((value) => ({
                        ...value,
                        maxResults: Math.min(10, Math.max(1, Number(event.target.value) || 6))
                      }))
                    }
                  />
                </div>
                {webSearchDraft.hasApiKey && (
                  <button
                    type="button"
                    className="mini-button"
                    disabled={webSearchBusy}
                    onClick={() => void clearWebSearchKey()}
                  >
                    清除已保存的 Key
                  </button>
                )}
                <div className="settings-inline-actions">
                  <button
                    type="button"
                    className="button ghost"
                    disabled={webSearchBusy}
                    onClick={() => void testWebSearch()}
                  >
                    <Search size={14} /> {webSearchBusy ? '测试中…' : '测试搜索'}
                  </button>
                  <button
                    type="button"
                    className="button primary"
                    disabled={webSearchBusy}
                    onClick={() => void saveWebSearch()}
                  >
                    <Save size={14} /> 保存搜索设置
                  </button>
                </div>
                {webSearchResult && (
                  <div className={webSearchResult.ok ? 'settings-message' : 'settings-error'}>
                    {webSearchResult.ok ? (
                      <>
                        <span>{`连接成功，返回 ${webSearchResult.count || 0} 条结果`}</span>
                        {webSearchResult.results?.[0] && (
                          <span> — {webSearchResult.results[0].title}</span>
                        )}
                      </>
                    ) : (
                      webSearchResult.error || '搜索测试失败'
                    )}
                  </div>
                )}
              </div>

              <div className="settings-group">
                <span className="settings-label">会话预算上限</span>
                <div className="inline-field">
                  <span>$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="留空表示不限制"
                    value={preferences.maxBudgetUsd ?? ''}
                    onChange={(event) =>
                      setPreferences((value) => ({
                        ...value,
                        maxBudgetUsd: event.target.value
                          ? Number(event.target.value)
                          : null
                      }))
                    }
                  />
                </div>
                <p className="settings-note">
                  传给引擎的 maxBudgetUsd。当前已设：
                  {preferences.maxBudgetUsd
                    ? formatCost(preferences.maxBudgetUsd)
                    : '不限制'}。
                </p>
              </div>

              <div className="settings-group">
                <span className="settings-label">后台与云端</span>
                <div className="settings-rows">
                  <div className="settings-row">
                    <span>后台任务</span>
                    <strong>在顶部「任务」菜单查看</strong>
                  </div>
                  <div className="settings-row">
                    <span>云端会话</span>
                    <strong>需要 Anthropic 账号；第三方供应商通常不可用</strong>
                  </div>
                </div>
              </div>

              <div className="settings-group">
                <span className="settings-label">当前工作目录</span>
                <div className="settings-rows">
                  <div className="settings-row">
                    <span>目录</span>
                    <strong title={activeTab?.cwd}>{activeTab?.cwd || defaults?.cwd || '—'}</strong>
                  </div>
                  <div className="settings-row">
                    <span>模型</span>
                    <strong>{activeTab?.state.model || settings?.api.model || '—'}</strong>
                  </div>
                </div>
              </div>

              {message && <div className="settings-message">{message}</div>}
              <div className="settings-actions">
                <button
                  type="button"
                  className="button primary"
                  disabled={savingPrefs}
                  onClick={() => void savePrefs()}
                >
                  <Save size={14} /> 保存偏好
                </button>
              </div>
            </div>
          )}

          {tab === 'api' && (
            <div className="settings-page">
              <h3>API 配置</h3>
              <p className="settings-page-sub">
                管理订阅和 API 配置。默认显示列表，点击“添加新配置”再展开编辑表单。
              </p>

              {!apiFormOpen ? (
                <>
                  <div className="api-current-card">
                    <div className="api-current-copy">
                      <span className="settings-label">当前配置</span>
                      <strong>
                        {providerDisplayName(
                          settings?.api.providerId || settings?.api.baseUrl
                        )}
                      </strong>
                      <small>
                        {settings?.api.model || '未选择模型'} ·{' '}
                        {settings?.api.baseUrl || '—'}
                      </small>
                      <small>
                        {settings?.api.hasToken
                          ? `Token ${settings.api.tokenMasked}`
                          : '未配置 Token'}
                      </small>
                    </div>
                    <div className="api-current-actions">
                      <button
                        type="button"
                        className="button primary"
                        onClick={openNewApiForm}
                      >
                        <Plus size={14} /> 添加新配置
                      </button>
                      <button
                        type="button"
                        className="button ghost"
                        onClick={() =>
                          activeProfile
                            ? openEditApiProfile(activeProfile)
                            : openNewApiForm()
                        }
                      >
                        编辑当前配置
                      </button>
                    </div>
                  </div>

                  <div className="settings-group">
                    <span className="settings-label">已保存的配置</span>
                    <div className="directory-list">
                      {(settings?.profiles || []).length === 0 && (
                        <span className="settings-empty">
                          还没有保存的配置。点击“添加新配置”开始。
                        </span>
                      )}
                      {[...(settings?.profiles || [])].reverse().map((profile) => {
                        const active = profile.id === effectiveActiveProfileId
                        return (
                          <div key={profile.id} className="directory-row">
                            <div className="profile-copy">
                              <strong>
                                <span data-i18n-skip>{profile.name}</span>
                                {active && (
                                  <span className="profile-active">当前</span>
                                )}
                              </strong>
                              <small>
                                {providerDisplayName(
                                  profile.providerId || profile.baseUrl
                                )}{' '}
                                · {profile.model} · {profile.baseUrl}
                              </small>
                              <small>
                                {profile.hasToken
                                  ? `Token ${profile.tokenMasked}`
                                  : '未配置 Token'}
                              </small>
                            </div>
                            <button
                              type="button"
                              className="mini-button"
                              disabled={active}
                              onClick={async () => {
                                try {
                                  await onApplyApiProfile(profile.id)
                                  setMessage(`已切换到配置「${profile.name}」`)
                                } catch (error) {
                                  setMessage(errorText(error))
                                }
                              }}
                            >
                              {active ? '当前' : '切换'}
                            </button>
                            <button
                              type="button"
                              className="mini-button"
                              onClick={() => openEditApiProfile(profile)}
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              className="icon-button"
                              aria-label="删除配置"
                              onClick={() => void onDeleteApiProfile(profile.id)}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  {message && <div className="settings-message">{message}</div>}
                </>
              ) : (
                <>
                  <div className="api-form-head">
                    <div>
                      <h4>{editingProfileId ? '编辑配置' : '添加新配置'}</h4>
                      <p className="settings-page-sub">
                        {editingProfileId
                          ? 'Token 留空表示保留原 Token。'
                          : '填写供应商和 Token，保存后会设为当前配置。'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="button ghost"
                      onClick={cancelApiForm}
                    >
                      取消
                    </button>
                  </div>

                  <div className="settings-group">
                    <span className="settings-label">配置名称</span>
                    <input
                      className="text-input"
                      value={profileName}
                      placeholder="例如 Claude-Pro、公司账号"
                      onChange={(event) => setProfileName(event.target.value)}
                    />
                  </div>

                  <div className="settings-group">
                    <span className="settings-label">供应商</span>
                    <div className="provider-grid">
                      {PROVIDER_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className={`provider-card ${providerId === preset.id ? 'is-active' : ''}`}
                          onClick={() => selectProvider(preset)}
                          title={preset.baseUrl || preset.description}
                        >
                          <strong>{preset.name}</strong>
                          <small>{preset.description}</small>
                        </button>
                      ))}
                    </div>
                    <p className="settings-note">
                      需要兼容 Anthropic Messages API；自定义供应商请填写其 Anthropic 兼容地址。
                    </p>
                  </div>

                  <div className="settings-group">
                    <span className="settings-label">Base URL</span>
                    <input
                      className="text-input"
                      value={baseUrl}
                      spellCheck={false}
                      placeholder="https://api.example.com 或 Anthropic 兼容端点"
                      onChange={(event) => {
                        const next = event.target.value
                        setBaseUrl(next)
                        const preset = findProviderPreset(next)
                        setProviderId(preset?.id || 'custom')
                        if (preset) setAuthMode(preset.authMode || 'bearer')
                        setTestResult(null)
                      }}
                    />
                  </div>

                  <div className="settings-group">
                    <span className="settings-label">认证方式</span>
                    <div className="segmented">
                      <button
                        type="button"
                        className={`segment ${authMode === 'bearer' ? 'is-active' : ''}`}
                        onClick={() => setAuthMode('bearer')}
                      >
                        Bearer
                      </button>
                      <button
                        type="button"
                        className={`segment ${authMode === 'apiKey' ? 'is-active' : ''}`}
                        onClick={() => setAuthMode('apiKey')}
                      >
                        x-api-key
                      </button>
                    </div>
                    <p className="settings-note">
                      Bearer 使用 Authorization 头；x-api-key 使用 X-Api-Key 头。
                    </p>
                  </div>

                  <div className="settings-group">
                    <span className="settings-label">API Token</span>
                    <input
                      className="text-input"
                      type="password"
                      value={token}
                      spellCheck={false}
                      placeholder={
                        editingProfile?.hasToken
                          ? `已保存：${editingProfile.tokenMasked}（留空保持不变）`
                          : 'API Key / Token'
                      }
                      onChange={(event) => setToken(event.target.value)}
                    />
                    {(providerId === 'ollama' || isLocalUrl) && (
                      <p className="settings-note">
                        Ollama 等本地服务没有密钥时，可填写任意占位值。
                      </p>
                    )}
                    {formNeedsToken && (
                      <p className="settings-note settings-note-warn">
                        新配置需要填写该供应商的 Token。
                      </p>
                    )}
                  </div>

                  <div className="settings-group">
                    <span className="settings-label">默认模型</span>
                    <input
                      className="text-input"
                      value={model}
                      spellCheck={false}
                      list="model-options"
                      onChange={(event) => setModel(event.target.value)}
                    />
                    <datalist id="model-options">
                      {visibleModels.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </datalist>
                    <p className="settings-note">
                      不知道模型？先点“测试并获取模型”，或直接填写供应商文档中的模型 ID。
                    </p>
                  </div>

                  <div className="settings-group">
                    <span className="settings-label">模型列表</span>
                    <div className="settings-rows model-list">
                      {visibleModels.length === 0 && (
                        <span className="settings-empty">还没有可用模型。</span>
                      )}
                      {visibleModels.slice(0, 40).map((option) => (
                        <button
                          type="button"
                          className={`settings-row model-row ${
                            model === option.id ? 'is-active' : ''
                          }`}
                          key={option.id}
                          title="选择此模型"
                          onClick={() => setModel(option.id)}
                        >
                          <span>{option.name}</span>
                          <strong>
                            {option.id}
                            {option.contextWindow
                              ? ` · ${formatTokens(option.contextWindow)}`
                              : ''}
                          </strong>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="settings-group">
                    <span className="settings-label">自定义模型</span>
                    <div className="model-form">
                      <input
                        className="text-input"
                        value={customModelId}
                        placeholder="模型 ID（必填）"
                        onChange={(event) => setCustomModelId(event.target.value)}
                      />
                      <input
                        className="text-input"
                        value={customModelName}
                        placeholder="显示名称（可选）"
                        onChange={(event) => setCustomModelName(event.target.value)}
                      />
                      <input
                        className="text-input"
                        type="number"
                        min={1}
                        value={customModelContext}
                        placeholder="上下文窗口（可选）"
                        onChange={(event) => setCustomModelContext(event.target.value)}
                      />
                      <button
                        type="button"
                        className="mini-button"
                        disabled={!customModelId.trim() || customBusy}
                        onClick={() => void addCustomModel()}
                      >
                        <Plus size={13} /> 添加模型
                      </button>
                    </div>
                    {providerModels.length > 0 && (
                      <div className="directory-list">
                        {providerModels.map((entry) => (
                          <div
                            className="directory-row"
                            key={`${entry.providerId || ''}-${entry.id}`}
                          >
                            <div className="profile-copy">
                              <strong>{entry.name || entry.id}</strong>
                              <small>
                                {entry.id}
                                {entry.contextWindow
                                  ? ` · ${formatTokens(entry.contextWindow)}`
                                  : ''}
                              </small>
                            </div>
                            <button
                              type="button"
                              className="icon-button"
                              aria-label="删除模型"
                              disabled={customBusy}
                              onClick={() => void removeCustomModel(entry)}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="settings-inline-actions">
                    <button
                      type="button"
                      className="button ghost"
                      onClick={() => selectProvider(PROVIDER_PRESETS[0])}
                    >
                      恢复默认供应商
                    </button>
                    {provider?.consoleUrl && (
                      <button
                        type="button"
                        className="button ghost"
                        onClick={() => onOpenConsole(provider.id)}
                      >
                        <ExternalLink size={14} /> {provider.name} 控制台
                      </button>
                    )}
                  </div>

                  {testResult && (
                    <div
                      className={`settings-message ${testResult.ok ? '' : 'is-error'}`}
                    >
                      {testResult.ok ? (
                        testResult.discoveredModel ? (
                          <>连接成功，已自动检测到模型 {testResult.discoveredModel}</>
                        ) : testResult.via === 'messages' ? (
                          '连接成功（供应商未提供模型列表，已用当前模型验证）'
                        ) : (
                          <>连接成功，可用模型 {testResult.modelCount ?? 0}</>
                        )
                      ) : (
                        `连接失败：${testResult.error || '未知错误'}`
                      )}
                    </div>
                  )}
                  {message && <div className="settings-message">{message}</div>}

                  <div className="settings-actions">
                    <button
                      type="button"
                      className="button ghost"
                      disabled={testing}
                      onClick={() => void test()}
                    >
                      <RefreshCw size={14} className={testing ? 'spin-icon' : ''} />
                      {testing ? '测试中…' : '测试并获取模型'}
                    </button>
                    <button
                      type="button"
                      className="button primary"
                      disabled={
                        savingApi ||
                        !baseUrl.trim() ||
                        !model.trim() ||
                        formNeedsToken
                      }
                      title={!model.trim() ? '请先选择或填写模型' : undefined}
                      onClick={() => void saveApiForm()}
                    >
                      <Save size={14} /> 保存配置
                    </button>
                  </div>
                  <p className="settings-note">
                    保存后会设为当前配置；空闲会话会立即切换并保留上下文，运行中的会话继续原进程，新会话生效。
                  </p>
                </>
              )}
            </div>
          )}

          {tab === 'permissions' && (
            <div className="settings-page">
              <h3>权限</h3>
              <p className="settings-page-sub">
                管理附加目录、工具白名单/黑名单，以及引擎的 allow / ask / deny 规则。
              </p>

              <div className="settings-group">
                <span className="settings-label">附加目录（--add-dir）</span>
                <div className="directory-list">
                  {preferences.additionalDirectories.length === 0 && (
                    <span className="settings-empty">还没有附加目录。</span>
                  )}
                  {preferences.additionalDirectories.map((directory) => (
                    <div key={directory} className="directory-row">
                      <code>{directory}</code>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="移除目录"
                        onClick={() =>
                          setPreferences((value) => ({
                            ...value,
                            additionalDirectories: value.additionalDirectories.filter(
                              (item) => item !== directory
                            )
                          }))
                        }
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="mini-button" onClick={() => void addDirectory()}>
                    <FolderPlus size={13} /> 添加目录
                  </button>
                </div>
              </div>

              <div className="settings-group">
                <span className="settings-label">工具白名单（allowedTools，新会话生效）</span>
                <textarea
                  className="config-editor permission-editor"
                  value={preferences.allowedTools.join('\n')}
                  placeholder={'例如：Read\nBash(git status)'}
                  onChange={(event) =>
                    setPreferences((value) => ({
                      ...value,
                      allowedTools: event.target.value.split('\n')
                    }))
                  }
                />
                <p className="settings-note">裸工具名会跳过该工具的确认；带参数的规则更安全。</p>
              </div>

              <div className="settings-group">
                <span className="settings-label">工具黑名单（disallowedTools，新会话生效）</span>
                <textarea
                  className="config-editor permission-editor"
                  value={preferences.disallowedTools.join('\n')}
                  placeholder={'例如：Bash(rm *)'}
                  onChange={(event) =>
                    setPreferences((value) => ({
                      ...value,
                      disallowedTools: event.target.value.split('\n')
                    }))
                  }
                />
              </div>

              <div className="settings-group">
                <span className="settings-label">allow 规则（每行一条）</span>
                <textarea
                  className="config-editor permission-editor"
                  value={allowText}
                  placeholder={'例如：Read\nBash(git *)'}
                  onChange={(event) => setAllowText(event.target.value)}
                />
              </div>
              <div className="settings-group">
                <span className="settings-label">ask 规则（每行一条）</span>
                <textarea
                  className="config-editor permission-editor"
                  value={askText}
                  onChange={(event) => setAskText(event.target.value)}
                />
              </div>
              <div className="settings-group">
                <span className="settings-label">deny 规则（每行一条）</span>
                <textarea
                  className="config-editor permission-editor"
                  value={denyText}
                  placeholder={'例如：Bash(rm -rf *)'}
                  onChange={(event) => setDenyText(event.target.value)}
                />
              </div>

              {message && <div className="settings-message">{message}</div>}
              <div className="settings-actions">
                <button
                  type="button"
                  className="button primary"
                  disabled={savingPrefs}
                  onClick={() => void savePermissions()}
                >
                  <Save size={14} /> 保存权限设置
                </button>
              </div>
              <p className="settings-note">规则写入 ~/.claude/settings.json 的 permissions 字段。</p>
            </div>
          )}

          {tab === 'extensions' && (
            <div className="settings-page settings-page-wide">
              <h3>扩展管理</h3>
              <p className="settings-page-sub">
                管理 MCP、插件、技能、Hooks 与 Agents。这里修改的是引擎的本地配置。
              </p>
              <ExtensionsPanel
                cwd={activeTab?.cwd || defaults?.cwd || ''}
                home={defaults?.home}
                tabId={activeTab?.id}
                onOpenPath={onOpenPath}
              />
            </div>
          )}

          {tab === 'background' && (
            <div className="settings-page">
              <h3>后台会话</h3>
              <p className="settings-page-sub">
                用本地引擎在后台运行会话，不占用当前标签。
              </p>
              <BackgroundPanel defaultCwd={activeTab?.cwd || defaults?.cwd || ''} />
            </div>
          )}

          {tab === 'remote' && <RemotePanel defaults={defaults} />}

          {tab === 'about' && (
            <div className="settings-page">
              <h3>关于与更新</h3>
              <p className="settings-page-sub">版本信息与更新检查。</p>
              <AboutPanel />
            </div>
          )}

          {tab === 'usage' && (
            <div className="settings-page">
              <h3>用量与限额</h3>
              <p className="settings-page-sub">
                {activeTab ? `标签：${activeTab.title}` : '当前没有活动会话'}
              </p>
              <UsagePanel
                tab={activeTab}
                models={models}
                preferences={preferences}
                providerId={settings?.api.providerId || providerId}
                onOpenConsole={onOpenConsole}
              />
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
