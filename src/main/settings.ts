import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type {
  ApiAuthMode,
  ApiProfile,
  ApiProfileInput,
  ApiSettings,
  ApiSettingsPatch,
  AppPreferences,
  CustomModel,
  PermissionRules,
  PreferencesPatch,
  SettingsSnapshot,
  UsageHistoryDay,
  UsageHistorySnapshot,
  UsageTurnRecordInput,
  WebSearchPatch,
  WebSearchProvider,
  WebSearchSettings
} from '../shared/types'
import { PROVIDER_PRESETS, findProviderPreset } from '../shared/providers'
import type { WebSearchRuntimeConfig } from '../shared/web-search'
import type {
  RemoteSettings,
  RemoteSettingsPatch,
  RemoteTunnelSettings
} from '../shared/types'
import { hashPassword, type RemoteCredentials } from './remote-auth'

const DEFAULT_PROVIDER = PROVIDER_PRESETS[0]
const DEFAULT_BASE_URL = DEFAULT_PROVIDER.baseUrl
const DEFAULT_MODEL = DEFAULT_PROVIDER.defaultModel || 'deepseek-v4.1-flash'

const DEFAULT_PREFERENCES: AppPreferences = {
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

interface ClaudeSettings {
  env?: Record<string, string>
  [key: string]: unknown
}

interface StoredProfile {
  id: string
  name: string
  baseUrl: string
  model: string
  token: string
  providerId?: string
  authMode?: ApiAuthMode
}

interface StoredWebSearch {
  enabled: boolean
  provider: WebSearchProvider
  endpoint: string
  apiKey: string
  maxResults: number
}

export interface StoredRemoteSettings {
  enabled: boolean
  port: number
  bind: 'localhost' | 'lan'
  username: string
  /** Hex-encoded scrypt salt; empty until a password is configured. */
  passwordSalt: string
  /** Hex-encoded scrypt hash; empty until a password is configured. */
  passwordHash: string
  tunnel?: RemoteTunnelSettings
  /** Remote clients may only start sessions under these roots. */
  allowedRoots?: string[]
}

const DEFAULT_REMOTE_SETTINGS: StoredRemoteSettings = {
  enabled: false,
  port: 3789,
  bind: 'lan',
  username: 'ba4rnj',
  passwordSalt: '',
  passwordHash: '',
  allowedRoots: [homedir()]
}

interface AppSettingsFile {
  cwd?: string
  preferences?: Partial<AppPreferences>
  profiles?: StoredProfile[]
  providerId?: string
  activeProfileId?: string | null
  customModels?: CustomModel[]
  webSearch?: Partial<StoredWebSearch>
  /** Explicit path to a `claude` executable; overrides auto-detection. */
  claudeCliPath?: string | null
  /** LAN / tunnel web access configuration. */
  remote?: StoredRemoteSettings
  /** Daily local usage analytics history (last 30 days). */
  usageHistory?: UsageHistoryDay[]
}

const DEFAULT_WEB_SEARCH: StoredWebSearch = {
  enabled: true,
  provider: 'duckduckgo',
  endpoint: '',
  apiKey: '',
  maxResults: 6
}

function claudeDir(): string {
  return process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
}

export function claudeSettingsPath(): string {
  return join(claudeDir(), 'settings.json')
}

function appSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function readClaudeSettings(): ClaudeSettings {
  try {
    return JSON.parse(readFileSync(claudeSettingsPath(), 'utf8')) as ClaudeSettings
  } catch {
    return {}
  }
}

function writeClaudeSettings(settings: ClaudeSettings): void {
  mkdirSync(claudeDir(), { recursive: true })
  writeFileSync(claudeSettingsPath(), JSON.stringify(settings, null, 2) + '\n', {
    mode: 0o600
  })
}

export function readAppSettings(): AppSettingsFile {
  try {
    return JSON.parse(readFileSync(appSettingsPath(), 'utf8')) as AppSettingsFile
  } catch {
    return {}
  }
}

function writeAppSettings(patch: AppSettingsFile): void {
  const current = readAppSettings()
  const next = { ...current, ...patch }
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(appSettingsPath(), JSON.stringify(next, null, 2) + '\n', {
    mode: 0o600
  })
}

export function saveCwd(cwd: string): void {
  writeAppSettings({ cwd })
}

export function defaultCwd(): string {
  const saved = readAppSettings().cwd
  if (saved && existsSync(saved)) return saved
  return homedir()
}

export function getClaudeCliPath(): string | null {
  const value = readAppSettings().claudeCliPath
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function saveClaudeCliPath(path: string | null): void {
  writeAppSettings({ claudeCliPath: path && path.trim() ? path.trim() : null })
}

export function getPreferences(): AppPreferences {
  return {
    ...DEFAULT_PREFERENCES,
    ...(readAppSettings().preferences || {})
  }
}

export function savePreferences(patch: PreferencesPatch): AppPreferences {
  const preferences = { ...getPreferences(), ...patch }
  writeAppSettings({ preferences })
  return preferences
}

export function buildExtraArgs(preferences: AppPreferences): Record<string, string | null> {
  const args: Record<string, string | null> = {}
  if (preferences.ideIntegration) args.ide = null
  if (preferences.chromeIntegration) args.chrome = null
  return args
}

function storedWebSearch(): StoredWebSearch {
  return { ...DEFAULT_WEB_SEARCH, ...(readAppSettings().webSearch || {}) }
}

export function getWebSearchConfig(): WebSearchRuntimeConfig {
  const config = storedWebSearch()
  return {
    provider: config.provider,
    endpoint: config.endpoint,
    apiKey: config.apiKey,
    maxResults: config.maxResults,
    enabled: config.enabled
  }
}

export function getWebSearchSettings(): WebSearchSettings {
  const config = storedWebSearch()
  return {
    enabled: config.enabled,
    provider: config.provider,
    endpoint: config.endpoint,
    hasApiKey: Boolean(config.apiKey),
    apiKeyMasked: maskToken(config.apiKey),
    maxResults: config.maxResults
  }
}

export function saveWebSearchSettings(patch: WebSearchPatch): WebSearchSettings {
  const current = storedWebSearch()
  const provider =
    patch.provider === 'duckduckgo' ||
    patch.provider === 'bing' ||
    patch.provider === 'baidu' ||
    patch.provider === 'searxng' ||
    patch.provider === 'tavily' ||
    patch.provider === 'brave'
      ? patch.provider
      : current.provider
  const endpoint = patch.endpoint !== undefined ? patch.endpoint.trim() : current.endpoint
  let apiKey = current.apiKey
  if (patch.apiKey !== undefined) {
    apiKey = patch.apiKey === null || patch.apiKey.trim() === '' ? '' : patch.apiKey.trim()
  }
  const requestedMax = Number.isFinite(patch.maxResults)
    ? Number(patch.maxResults)
    : current.maxResults
  const maxResults = Math.min(10, Math.max(1, Math.round(requestedMax)))
  writeAppSettings({
    webSearch: {
      enabled: patch.enabled ?? current.enabled,
      provider,
      endpoint,
      apiKey,
      maxResults
    }
  })
  return getWebSearchSettings()
}

function inferProviderId(baseUrl?: string): string {
  return findProviderPreset(baseUrl)?.id || 'custom'
}

function inferAuthMode(
  providerId: string,
  env: Record<string, string>
): ApiAuthMode {
  if (env.ANTHROPIC_API_KEY && !env.ANTHROPIC_AUTH_TOKEN) return 'apiKey'
  if (env.ANTHROPIC_AUTH_TOKEN) return 'bearer'
  return providerId === 'anthropic' ? 'apiKey' : 'bearer'
}

export function getApiSettings(): ApiSettings {
  const settings = readClaudeSettings()
  const env = settings.env || {}
  const token = env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_API_KEY || ''
  const baseUrl = env.ANTHROPIC_BASE_URL || DEFAULT_BASE_URL
  const appSettings = readAppSettings()
  const providerId = appSettings.providerId || inferProviderId(baseUrl)
  const candidateProfileId = appSettings.activeProfileId || undefined
  const profileId =
    candidateProfileId &&
    storedProfiles().some((profile) => profile.id === candidateProfileId)
      ? candidateProfileId
      : undefined
  return {
    baseUrl,
    model: env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    tokenMasked: token ? `${token.slice(0, 8)}…${token.slice(-4)}` : '',
    hasToken: Boolean(token),
    providerId,
    authMode: inferAuthMode(providerId, env),
    profileId
  }
}

function normalizeRules(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((rule): rule is string => typeof rule === 'string')
    : []
}

export function getPermissionRules(): PermissionRules {
  const settings = readClaudeSettings()
  const permissions = (settings.permissions || {}) as Record<string, unknown>
  return {
    allow: normalizeRules(permissions.allow),
    ask: normalizeRules(permissions.ask),
    deny: normalizeRules(permissions.deny)
  }
}

export function savePermissionRules(rules: PermissionRules): PermissionRules {
  const settings = readClaudeSettings()
  settings.permissions = {
    ...(settings.permissions || {}),
    allow: rules.allow,
    ask: rules.ask,
    deny: rules.deny
  }
  writeClaudeSettings(settings)
  return getPermissionRules()
}

function maskToken(token: string): string {
  return token ? `${token.slice(0, 8)}…${token.slice(-4)}` : ''
}

function storedProfiles(): StoredProfile[] {
  return readAppSettings().profiles || []
}

export function getApiProfiles(): ApiProfile[] {
  return storedProfiles().map((profile) => {
    const providerId = profile.providerId || inferProviderId(profile.baseUrl)
    return {
      id: profile.id,
      name: profile.name,
      baseUrl: profile.baseUrl,
      model: profile.model,
      tokenMasked: maskToken(profile.token),
      hasToken: Boolean(profile.token),
      providerId,
      authMode:
        profile.authMode || (providerId === 'anthropic' ? 'apiKey' : 'bearer')
    }
  })
}

export function saveApiProfile(input: ApiProfileInput): ApiProfile[] {
  const profiles = storedProfiles()
  const existingIndex = input.id
    ? profiles.findIndex((profile) => profile.id === input.id)
    : -1
  if (existingIndex >= 0) {
    const existing = profiles[existingIndex]
    const baseUrl = input.baseUrl.trim() || existing.baseUrl
    const providerId = input.providerId || inferProviderId(baseUrl)
    profiles[existingIndex] = {
      ...existing,
      name: input.name.trim() || existing.name,
      baseUrl,
      model: input.model.trim() || existing.model,
      token: input.token?.trim() || existing.token,
      providerId,
      authMode:
        input.authMode ||
        existing.authMode ||
        (providerId === 'anthropic' ? 'apiKey' : 'bearer')
    }
  } else {
    const baseUrl = input.baseUrl.trim() || DEFAULT_BASE_URL
    const providerId = input.providerId || inferProviderId(baseUrl)
    profiles.push({
      id: `profile_${Date.now().toString(36)}`,
      name: input.name.trim() || 'Untitled profile',
      baseUrl,
      model: input.model.trim() || DEFAULT_MODEL,
      token: input.token?.trim() || '',
      providerId,
      authMode:
        input.authMode || (providerId === 'anthropic' ? 'apiKey' : 'bearer')
    })
  }
  writeAppSettings({ profiles })
  return getApiProfiles()
}

export function deleteApiProfile(id: string): ApiProfile[] {
  const activeProfileId = readAppSettings().activeProfileId
  writeAppSettings({
    profiles: storedProfiles().filter((profile) => profile.id !== id),
    ...(activeProfileId === id ? { activeProfileId: null } : {})
  })
  return getApiProfiles()
}

export function applyApiProfile(id: string): ApiSettings {
  const profile = storedProfiles().find((item) => item.id === id)
  if (!profile) throw new Error('Profile not found.')
  saveApiSettings({
    baseUrl: profile.baseUrl,
    model: profile.model,
    token: profile.token,
    providerId: profile.providerId,
    authMode: profile.authMode
  })
  writeAppSettings({ activeProfileId: id })
  return getApiSettings()
}

export function getCustomModels(): CustomModel[] {
  return readAppSettings().customModels || []
}

export function saveCustomModel(input: CustomModel): CustomModel[] {
  const id = input.id.trim()
  if (!id) return getCustomModels()
  const providerId = input.providerId || getApiSettings().providerId || 'custom'
  const contextWindow =
    input.contextWindow && input.contextWindow > 0 ? input.contextWindow : undefined
  const entry: CustomModel = {
    id,
    name: input.name?.trim() || id,
    contextWindow,
    providerId
  }
  const models = getCustomModels()
  const index = models.findIndex(
    (model) => model.id === entry.id && model.providerId === entry.providerId
  )
  if (index >= 0) models[index] = entry
  else models.push(entry)
  writeAppSettings({ customModels: models })
  return models
}

export function deleteCustomModel(id: string, providerId?: string): CustomModel[] {
  const models = getCustomModels().filter(
    (model) => !(model.id === id && (!providerId || model.providerId === providerId))
  )
  writeAppSettings({ customModels: models })
  return models
}

export function getSettingsSnapshot(): SettingsSnapshot {
  return {
    api: getApiSettings(),
    preferences: getPreferences(),
    permissionRules: getPermissionRules(),
    profiles: getApiProfiles(),
    customModels: getCustomModels(),
    webSearch: getWebSearchSettings()
  }
}

export function getStoredRemoteSettings(): StoredRemoteSettings {
  const stored = readAppSettings().remote
  const merged = { ...DEFAULT_REMOTE_SETTINGS, ...(stored || {}) }
  if (!merged.allowedRoots || merged.allowedRoots.length === 0) {
    merged.allowedRoots = [homedir()]
  }
  return merged
}

export function getRemoteCredentials(): RemoteCredentials | null {
  const remote = getStoredRemoteSettings()
  if (!remote.username || !remote.passwordSalt || !remote.passwordHash) return null
  return {
    username: remote.username,
    salt: remote.passwordSalt,
    hash: remote.passwordHash
  }
}

export function getRemoteSettings(): RemoteSettings {
  const remote = getStoredRemoteSettings()
  return {
    enabled: remote.enabled,
    port: remote.port,
    bind: remote.bind,
    username: remote.username,
    hasPassword: Boolean(remote.passwordSalt && remote.passwordHash),
    lanUrls: [],
    tunnel: remote.tunnel
      ? { ...remote.tunnel, running: false }
      : undefined,
    devices: []
  }
}

export function saveRemoteSettings(patch: RemoteSettingsPatch): RemoteSettings {
  const current = getStoredRemoteSettings()
  const next: StoredRemoteSettings = { ...current }
  if (patch.enabled !== undefined) next.enabled = patch.enabled
  if (patch.port !== undefined) {
    const port = Math.trunc(patch.port)
    if (Number.isFinite(port) && port >= 1024 && port <= 65535) next.port = port
  }
  if (patch.bind === 'localhost' || patch.bind === 'lan') next.bind = patch.bind
  if (patch.username !== undefined) {
    const username = patch.username.trim()
    if (username) next.username = username
  }
  if (patch.password) {
    const { salt, hash } = hashPassword(patch.password)
    next.passwordSalt = salt
    next.passwordHash = hash
  }
  if (patch.tunnel !== undefined) {
    next.tunnel = patch.tunnel || undefined
  }
  writeAppSettings({ remote: next })
  return getRemoteSettings()
}

export function setRemoteCredentials(username: string, password: string): RemoteSettings {
  const current = getStoredRemoteSettings()
  const { salt, hash } = hashPassword(password)
  writeAppSettings({
    remote: {
      ...current,
      username: username.trim() || current.username,
      passwordSalt: salt,
      passwordHash: hash
    }
  })
  return getRemoteSettings()
}

export function saveApiSettings(patch: ApiSettingsPatch): ApiSettings {
  const settings = readClaudeSettings()
  const env = { ...(settings.env || {}) }
  const baseUrl = patch.baseUrl.trim() || DEFAULT_BASE_URL
  const model = patch.model.trim() || DEFAULT_MODEL

  const providerId = patch.providerId || inferProviderId(baseUrl)
  const authMode =
    patch.authMode || (providerId === 'anthropic' ? 'apiKey' : 'bearer')
  env.ANTHROPIC_BASE_URL = baseUrl
  env.ANTHROPIC_MODEL = model
  env.ANTHROPIC_DEFAULT_OPUS_MODEL = model
  env.ANTHROPIC_DEFAULT_SONNET_MODEL = model
  env.ANTHROPIC_DEFAULT_HAIKU_MODEL = model
  const existingToken = env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_API_KEY || ''
  const token =
    patch.token !== undefined && patch.token.trim()
      ? patch.token.trim()
      : existingToken
  if (token) {
    if (authMode === 'apiKey') {
      env.ANTHROPIC_API_KEY = token
      delete env.ANTHROPIC_AUTH_TOKEN
    } else {
      env.ANTHROPIC_AUTH_TOKEN = token
      delete env.ANTHROPIC_API_KEY
    }
  }

  settings.env = env
  writeClaudeSettings(settings)
  // A manual API edit means the previous subscription profile is no longer
  // the source of truth.
  writeAppSettings({ providerId, activeProfileId: null })
  return getApiSettings()
}

export function getApiCredentials(): { baseUrl: string; token: string; model: string } {
  const settings = readClaudeSettings()
  const env = settings.env || {}
  return {
    baseUrl: env.ANTHROPIC_BASE_URL || DEFAULT_BASE_URL,
    token: env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_API_KEY || '',
    model: env.ANTHROPIC_MODEL || DEFAULT_MODEL
  }
}

function localDateKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getUsageHistory(): UsageHistorySnapshot {
  const days = readAppSettings().usageHistory || []
  return {
    days: [...days].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30)
  }
}

export function recordUsageTurn(record: UsageTurnRecordInput): UsageHistorySnapshot {
  const date = record.date?.trim() || localDateKey()
  const inputTokens = Math.max(0, Math.round(record.inputTokens || 0))
  const outputTokens = Math.max(0, Math.round(record.outputTokens || 0))
  const cacheReadTokens = Math.max(0, Math.round(record.cacheReadTokens || 0))
  const costUsd = Math.max(0, Number(record.costUsd) || 0)

  if (inputTokens === 0 && outputTokens === 0 && cacheReadTokens === 0 && costUsd === 0) {
    return getUsageHistory()
  }

  const days = [...(readAppSettings().usageHistory || [])]
  let day = days.find((item) => item.date === date)
  if (!day) {
    day = {
      date,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      costUsd: 0,
      turns: 0,
      byModel: {},
      byWorkspace: {}
    }
    days.push(day)
  }

  day.inputTokens += inputTokens
  day.outputTokens += outputTokens
  day.cacheReadTokens += cacheReadTokens
  day.costUsd += costUsd
  day.turns += 1

  const modelKey = record.model?.trim() || 'default'
  const prevModel = day.byModel[modelKey] || {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    costUsd: 0
  }
  day.byModel[modelKey] = {
    inputTokens: prevModel.inputTokens + inputTokens,
    outputTokens: prevModel.outputTokens + outputTokens,
    cacheReadTokens: prevModel.cacheReadTokens + cacheReadTokens,
    costUsd: prevModel.costUsd + costUsd
  }

  if (record.cwd?.trim()) {
    const cwdKey = record.cwd.trim()
    const prevWs = day.byWorkspace[cwdKey] || {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      costUsd: 0
    }
    day.byWorkspace[cwdKey] = {
      inputTokens: prevWs.inputTokens + inputTokens,
      outputTokens: prevWs.outputTokens + outputTokens,
      cacheReadTokens: prevWs.cacheReadTokens + cacheReadTokens,
      costUsd: prevWs.costUsd + costUsd
    }
  }

  const trimmed = days.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30)
  writeAppSettings({ usageHistory: trimmed })
  return { days: trimmed }
}

export function clearUsageHistory(): UsageHistorySnapshot {
  writeAppSettings({ usageHistory: [] })
  return { days: [] }
}

