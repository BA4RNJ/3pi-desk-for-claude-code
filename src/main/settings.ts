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
  SettingsSnapshot
} from '../shared/types'
import { PROVIDER_PRESETS, findProviderPreset } from '../shared/providers'

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
  compactMode: false,
  recentWorkspaces: [],
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

interface AppSettingsFile {
  cwd?: string
  preferences?: Partial<AppPreferences>
  profiles?: StoredProfile[]
  providerId?: string
  customModels?: CustomModel[]
  /** Explicit path to a `claude` executable; overrides auto-detection. */
  claudeCliPath?: string | null
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
  const providerId = readAppSettings().providerId || inferProviderId(baseUrl)
  return {
    baseUrl,
    model: env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    tokenMasked: token ? `${token.slice(0, 8)}…${token.slice(-4)}` : '',
    hasToken: Boolean(token),
    providerId,
    authMode: inferAuthMode(providerId, env)
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
  writeAppSettings({ profiles: storedProfiles().filter((profile) => profile.id !== id) })
  return getApiProfiles()
}

export function applyApiProfile(id: string): ApiSettings {
  const profile = storedProfiles().find((item) => item.id === id)
  if (!profile) throw new Error('Profile not found.')
  return saveApiSettings({
    baseUrl: profile.baseUrl,
    model: profile.model,
    token: profile.token,
    providerId: profile.providerId,
    authMode: profile.authMode
  })
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
    customModels: getCustomModels()
  }
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
  writeAppSettings({ providerId })
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
