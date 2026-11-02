import {
  Blocks,
  ExternalLink,
  FolderPlus,
  Gauge,
  Info,
  KeyRound,
  Monitor,
  Moon,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Sun,
  Terminal,
  Trash2,
  X
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type {
  ApiAuthMode,
  ApiProfile,
  ApiProfileInput,
  ApiSettingsPatch,
  AppDefaults,
  AppPreferences,
  CustomModel,
  ModelOption,
  PermissionRules,
  SettingsSnapshot,
  TestApiResult
} from '../../../shared/types'
import {
  PROVIDER_PRESETS,
  findProviderPreset,
  providerDisplayName
} from '../../../shared/providers'
import type { TabView, ThemeMode } from '../types'
import type { Language } from '../i18n'
import { formatCost, formatTokens } from '../lib/format'
import { AboutPanel } from './AboutPanel'
import { BackgroundPanel } from './BackgroundPanel'
import { ExtensionsPanel } from './ExtensionsPanel'
import { AppMark } from './AppMark'
import { UsagePanel } from './UsagePanel'

export type SettingsTab =
  | 'general'
  | 'api'
  | 'permissions'
  | 'extensions'
  | 'background'
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
  onSaveCustomModel: (model: CustomModel) => Promise<CustomModel[]>
  onDeleteCustomModel: (id: string, providerId?: string) => Promise<CustomModel[]>
  onSaveApiProfile: (profile: ApiProfileInput) => Promise<ApiProfile[]>
  onDeleteApiProfile: (id: string) => Promise<ApiProfile[]>
  onApplyApiProfile: (id: string) => Promise<unknown>
  onOpenConsole: (providerId?: string) => void
  onOpenPath: (path: string) => void
}

const THEMES: Array<{ id: ThemeMode; label: string; icon: typeof Sun }> = [
  { id: 'light', label: '浅色', icon: Sun },
  { id: 'dark', label: '深色', icon: Moon },
  { id: 'system', label: '跟随系统', icon: Monitor }
]

const NAV: Array<{ id: SettingsTab; label: string; icon: typeof Settings }> = [
  { id: 'general', label: '常规', icon: Settings },
  { id: 'api', label: 'API', icon: KeyRound },
  { id: 'permissions', label: '权限', icon: Shield },
  { id: 'extensions', label: '扩展', icon: Blocks },
  { id: 'background', label: '后台', icon: Terminal },
  { id: 'usage', label: '用量', icon: Gauge },
  { id: 'about', label: '关于', icon: Info }
]

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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
  onSaveCustomModel,
  onDeleteCustomModel,
  onSaveApiProfile,
  onDeleteApiProfile,
  onApplyApiProfile,
  onOpenConsole,
  onOpenPath
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
      compactMode: false,
      recentWorkspaces: [],
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

  const provider = findProviderPreset(providerId)
  const savedProviderId =
    settings?.api.providerId || findProviderPreset(settings?.api.baseUrl)?.id || 'custom'
  const providerNeedsToken =
    providerId !== savedProviderId && Boolean(settings?.api.hasToken) && !token.trim()
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

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="settings-shell" role="dialog" aria-modal="true" aria-label="设置">
        <div className="settings-sidebar">
          <div className="settings-brand">
            <AppMark size={40} className="settings-mark" />
            <div>
              <h2>3PI Desk</h2>
              <p>AI 编程工作台 · v0.4.0</p>
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

        <div className="settings-content">
          <button type="button" className="dialog-close" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>

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
                  {(['coral', 'blue', 'green', 'purple'] as const).map((accent) => (
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
                    <small>关闭窗口后应用继续在托盘运行。</small>
                  </div>
                  <input
                    type="checkbox"
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
                    <small>Ctrl/Cmd + Shift + Space 显示窗口（Wayland 下可能不可用）。</small>
                  </div>
                  <input
                    type="checkbox"
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
                选择供应商，填写密钥与模型。配置写入 ~/.claude/settings.json，密钥只保存在本机。
              </p>
                <p className="settings-note">
                  只有 API 密钥也可以：填好密钥后点“测试并获取模型”，应用会读取模型列表或自动尝试常见模型。
                </p>
                {providerId === 'custom' && (
                  <p className="settings-note">
                    自定义供应商如果没有模型列表，需要填写供应商文档中的模型 ID。
                  </p>
                )}

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
                <span className="settings-label">配置档案</span>
                <div className="directory-list">
                  {(settings?.profiles || []).length === 0 && (
                    <span className="settings-empty">还没有保存的配置档案。</span>
                  )}
                  {(settings?.profiles || []).map((profile) => (
                    <div key={profile.id} className="directory-row">
                      <div className="profile-copy">
                        <strong>{profile.name}</strong>
                        <small>
                          {providerDisplayName(profile.providerId || profile.baseUrl)} ·{' '}
                          {profile.model} · {profile.baseUrl}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="mini-button"
                        onClick={() => void onApplyApiProfile(profile.id)}
                      >
                        应用
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
                  ))}
                </div>
                <div className="extension-actions">
                  <input
                    className="text-input"
                    value={profileName}
                    placeholder="配置名称，例如 我的供应商"
                    onChange={(event) => setProfileName(event.target.value)}
                  />
                  <button
                    type="button"
                    className="mini-button"
                    disabled={!profileName.trim()}
                    onClick={async () => {
                      await onSaveApiProfile({
                        name: profileName.trim(),
                        baseUrl,
                        model,
                        token: token || undefined,
                        providerId,
                        authMode
                      })
                      setProfileName('')
                      setMessage('配置档案已保存')
                    }}
                  >
                    <Save size={13} /> 保存当前为档案
                  </button>
                </div>
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
                    settings?.api.hasToken
                      ? `已保存：${settings.api.tokenMasked}（留空保持不变）`
                      : 'API Key / Token'
                  }
                  onChange={(event) => setToken(event.target.value)}
                />
                {settings?.api.hasToken && providerId !== settings.api.providerId && (
                  <p className="settings-note">
                    切换供应商后请填写新供应商的密钥。
                  </p>
                )}
                {(providerId === 'ollama' || isLocalUrl) && (
                  <p className="settings-note">
                    Ollama 等本地服务没有密钥时，可填写任意占位值。
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
                  不知道模型？先点“测试并获取模型”。
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
                <p className="settings-note">
                  点击“测试连接”尝试读取供应商模型列表；不支持列表的供应商会改用当前模型验证。
                </p>
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
                <p className="settings-note">
                  供应商列表里没有的模型可以手动添加；上下文窗口留空时由供应商或引擎决定。
                </p>
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
                <div className={`settings-message ${testResult.ok ? '' : 'is-error'}`}>
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
                    providerNeedsToken
                  }
                  title={
                    !model.trim() ? '请先选择或填写模型' : undefined
                  }
                  onClick={() => void saveApi()}
                >
                  <Save size={14} /> 保存 API 配置
                </button>
              </div>
              <p className="settings-note">
                修改后只影响新启动的会话；当前会话继续使用启动时的配置。
              </p>
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
  )
}
