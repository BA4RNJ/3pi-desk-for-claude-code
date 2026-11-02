export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'plan'
  | 'bypassPermissions'
  | 'auto'
  | 'dontAsk'

export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export type EffortSetting = 'default' | EffortLevel

export interface ContextUsage {
  used: number
  max: number
  percentage: number
  model?: string
}

export interface TurnStats {
  costUsd?: number
  durationMs?: number
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
}

export interface SessionState {
  running: boolean
  connecting: boolean
  cwd: string
  sessionId?: string
  model: string
  permissionMode: PermissionMode
  effort: EffortSetting
  stats?: TurnStats
  context?: ContextUsage
  error?: string
  /**
   * Monotonic revision of this snapshot. The renderer uses it to discard
   * snapshots that arrive after a newer one (IPC replies and events can be
   * delivered out of order), which previously cleared `running` mid-turn.
   */
  revision?: number
}

export interface SessionStartOptions {
  cwd: string
  model?: string
  permissionMode?: PermissionMode
  effort?: EffortSetting
  resume?: string
}

export interface AttachmentImage {
  kind: 'image'
  name: string
  mediaType: string
  data: string
}

export interface AttachmentText {
  kind: 'text'
  name: string
  text: string
}

export interface AttachmentDocument {
  kind: 'document'
  name: string
  mediaType: string
  data: string
}

export type Attachment = AttachmentImage | AttachmentText | AttachmentDocument

export type AttachmentFailureReason = 'unsupported' | 'too-large' | 'unreadable' | 'empty'

export interface AttachmentFailure {
  name: string
  reason: AttachmentFailureReason
}

export interface AttachmentPickResult {
  attachments: Attachment[]
  errors: AttachmentFailure[]
}

export interface SendMessagePayload {
  text: string
  attachments?: Attachment[]
  uuid?: string
}

export type PermissionRequestKind = 'permission' | 'question' | 'plan'

export interface PermissionRequestPayload {
  id: string
  kind: PermissionRequestKind
  toolName: string
  input: Record<string, unknown>
  toolUseID: string
  title?: string
  displayName?: string
  description?: string
  decisionReason?: string
  blockedPath?: string
  suggestions?: unknown[]
  allowAlways: boolean
  defaultToNo?: boolean
}

export interface PermissionResponsePayload {
  id: string
  decision: 'allow' | 'deny'
  always?: boolean
  message?: string
  answers?: Record<string, string | string[]>
}

export interface SlashCommandInfo {
  name: string
  description: string
  argumentHint?: string
  aliases?: string[]
  builtin?: boolean
}

export interface SessionInfo {
  sessionId: string
  summary: string
  lastModified: number
  firstPrompt?: string
  cwd?: string
  gitBranch?: string
  customTitle?: string
  tag?: string
  fileSize?: number
}

export interface SessionMessage {
  type: string
  uuid: string
  session_id: string
  message: unknown
  parent_tool_use_id?: string | null
}

export interface AppDefaults {
  cwd: string
  home: string
  platform: string
  /** True when the process runs inside WSL (with or without WSLg). */
  wsl: boolean
}

export type DesktopEvent = Record<string, any>

export interface TabEventPayload {
  tabId: string
  message: DesktopEvent
}

export interface TabStatePayload {
  tabId: string
  state: SessionState
}

export interface TabPermissionPayload {
  tabId: string
  request: PermissionRequestPayload
}

export interface TabPermissionCancelPayload {
  tabId: string
  id: string
}

export interface ModelPricing {
  inputPerMillion: number
  outputPerMillion: number
  cacheReadPerMillion?: number
  peakMultiplier?: number
  peakWindowsUtc?: Array<{ days: number[]; startHour: number; endHour: number }>
}

export interface ModelOption {
  id: string
  name: string
  description?: string
  contextWindow?: number
  maxOutput?: number
  effortLevels?: EffortLevel[]
  supportsImages?: boolean
  pricing?: ModelPricing
}

export type ApiAuthMode = 'bearer' | 'apiKey'

export interface ApiSettings {
  baseUrl: string
  model: string
  tokenMasked: string
  hasToken: boolean
  providerId?: string
  authMode?: ApiAuthMode
}

export interface ApiSettingsPatch {
  baseUrl: string
  model: string
  token?: string
  providerId?: string
  authMode?: ApiAuthMode
}

export interface CustomModel {
  id: string
  name?: string
  contextWindow?: number
  providerId?: string
}

export interface ChatSettingsSnapshot {
  model?: string
  effort?: EffortSetting
  permissionMode?: PermissionMode
  updatedAt?: number
}

export interface AppPreferences {
  ideIntegration: boolean
  chromeIntegration: boolean
  maxBudgetUsd: number | null
  pinnedSessions: string[]
  additionalDirectories: string[]
  allowedTools: string[]
  disallowedTools: string[]
  closeToTray: boolean
  globalShortcut: boolean
  fontScale: number
  accent: 'coral' | 'blue' | 'green' | 'purple'
  compactMode: boolean
  recentWorkspaces: string[]
  /** Per-conversation model/effort/permission, keyed by session id. */
  chatSettings: Record<string, ChatSettingsSnapshot>
  /** Last used settings, inherited by new chats. */
  lastChatSettings: ChatSettingsSnapshot
  /** Session ids hidden after an in-place retract (the transcript is kept). */
  hiddenSessions: string[]
}

export interface ApiProfile {
  id: string
  name: string
  baseUrl: string
  model: string
  tokenMasked: string
  hasToken: boolean
  providerId?: string
  authMode?: ApiAuthMode
}

export interface ApiProfileInput {
  id?: string
  name: string
  baseUrl: string
  model: string
  token?: string
  providerId?: string
  authMode?: ApiAuthMode
}

export interface SettingsSnapshot {
  api: ApiSettings
  preferences: AppPreferences
  permissionRules: PermissionRules
  profiles: ApiProfile[]
  customModels: CustomModel[]
}

export interface PreferencesPatch {
  ideIntegration?: boolean
  chromeIntegration?: boolean
  maxBudgetUsd?: number | null
  pinnedSessions?: string[]
  additionalDirectories?: string[]
  allowedTools?: string[]
  disallowedTools?: string[]
  closeToTray?: boolean
  globalShortcut?: boolean
  fontScale?: number
  accent?: 'coral' | 'blue' | 'green' | 'purple'
  compactMode?: boolean
  recentWorkspaces?: string[]
  chatSettings?: Record<string, ChatSettingsSnapshot>
  lastChatSettings?: ChatSettingsSnapshot
  hiddenSessions?: string[]
}

export interface ExtensionTextFile {
  path: string
  text: string
}

export type PluginAction = 'install' | 'update' | 'uninstall' | 'enable' | 'disable'

export interface VersionInfo {
  app: string
  electron: string
  node: string
  sdk: string
  claudeCode: string
  latestSdk?: string
}

export interface BackgroundSession {
  id?: string
  pid?: number
  cwd: string
  kind: string
  startedAt: number
  sessionId: string
  name: string
  status: string
  state?: string
}

export interface BackgroundStartResult {
  id?: string
  output: string
  sessions: BackgroundSession[]
}

export interface PermissionRules {
  allow: string[]
  ask: string[]
  deny: string[]
}

export interface TestApiResult {
  ok: boolean
  status?: number
  modelCount?: number
  models?: ModelOption[]
  via?: 'models' | 'messages'
  authMode?: ApiAuthMode
  discoveredModel?: string
  error?: string
}

export interface FileEntry {
  path: string
  relativePath: string
  name: string
}

export interface FileNode {
  name: string
  path: string
  relativePath: string
  type: 'file' | 'dir'
  size?: number
  children?: FileNode[]
}

export interface FileContent {
  kind: 'text' | 'image' | 'binary'
  path: string
  text?: string
  dataUrl?: string
  size: number
  mimeType?: string
}

export interface McpServerEntry {
  name: string
  scope: 'user' | 'project' | 'local' | 'other'
  config: Record<string, unknown>
  status?: string
  source?: string
  tools?: string[]
}

export interface PluginEntry {
  name: string
  version?: string
  enabled: boolean
  description?: string
  marketplace?: string
}

export interface MarketplaceEntry {
  name: string
  source?: string
  lastUpdated?: number
  installLocation?: string
}

export interface AvailablePlugin {
  pluginId: string
  name: string
  description?: string
  marketplaceName?: string
  installCount?: number
  installed: boolean
}

export interface PluginMarketplaceSnapshot {
  marketplaces: MarketplaceEntry[]
  available: AvailablePlugin[]
}

export interface SkillEntry {
  name: string
  description?: string
  path: string
  scope: 'user' | 'project' | 'plugin' | 'other'
}

export interface HookEntry {
  event: string
  matcher?: string
  command: string
  source: string
}

export interface AgentEntry {
  name: string
  description?: string
  model?: string
  scope: 'user' | 'project' | 'plugin' | 'builtin'
  path?: string
}

export interface ExtensionsSnapshot {
  mcp: McpServerEntry[]
  plugins: PluginEntry[]
  skills: SkillEntry[]
  hooks: HookEntry[]
  agents: AgentEntry[]
}

export interface McpConfigSnapshot {
  scope: 'user' | 'project' | 'local'
  path: string
  text: string
}

export interface RewindPreview {
  canRewind: boolean
  error?: string
  filesChanged?: string[]
  insertions?: number
  deletions?: number
  skippedLinks?: number
}

export interface DeskApi {
  startSession(tabId: string, options: SessionStartOptions): Promise<SessionState>
  stopSession(tabId: string): Promise<void>
  sendMessage(tabId: string, payload: SendMessagePayload): Promise<void>
  interrupt(tabId: string): Promise<void>
  setModel(tabId: string, model: string): Promise<void>
  setPermissionMode(tabId: string, mode: PermissionMode): Promise<void>
  setEffort(tabId: string, effort: EffortSetting): Promise<void>
  respondPermission(tabId: string, response: PermissionResponsePayload): Promise<void>
  supportedCommands(tabId: string): Promise<SlashCommandInfo[]>
  rewind(tabId: string, userMessageId: string, dryRun: boolean): Promise<RewindPreview>
  contextUsage(tabId: string): Promise<ContextUsage | null>
  mcpStatus(tabId: string): Promise<McpServerEntry[]>
  toggleMcp(tabId: string, name: string, enabled: boolean): Promise<void>
  listSessions(cwd: string): Promise<SessionInfo[]>
  listAllSessions(limit?: number): Promise<SessionInfo[]>
  getSessionMessages(sessionId: string, cwd: string): Promise<SessionMessage[]>
  renameSession(sessionId: string, title: string, cwd: string): Promise<void>
  deleteSession(sessionId: string, cwd: string): Promise<string>
  tagSession(sessionId: string, tag: string | null, cwd: string): Promise<void>
  forkSession(sessionId: string, cwd: string, upToMessageId?: string): Promise<string>
  saveExport(defaultName: string, content: string): Promise<string | null>
  pickDirectory(defaultPath?: string): Promise<string | null>
  pickFiles(): Promise<AttachmentPickResult>
  getDefaults(): Promise<AppDefaults>
  saveCwd(cwd: string): Promise<void>
  getSettings(): Promise<SettingsSnapshot>
  saveApiSettings(patch: ApiSettingsPatch): Promise<ApiSettings>
  saveApiProfile(profile: ApiProfileInput): Promise<ApiProfile[]>
  deleteApiProfile(id: string): Promise<ApiProfile[]>
  applyApiProfile(id: string): Promise<ApiSettings>
  savePreferences(patch: PreferencesPatch): Promise<AppPreferences>
  savePermissionRules(rules: PermissionRules): Promise<PermissionRules>
  saveCustomModel(model: CustomModel): Promise<CustomModel[]>
  deleteCustomModel(id: string, providerId?: string): Promise<CustomModel[]>
  listBackgroundSessions(): Promise<BackgroundSession[]>
  startBackgroundSession(
    cwd: string,
    prompt: string,
    trust: boolean
  ): Promise<BackgroundStartResult>
  backgroundLogs(id: string): Promise<string>
  backgroundStop(id: string): Promise<string>
  backgroundRemove(id: string): Promise<string>
  trustDirectory(cwd: string): Promise<void>
  versionInfo(): Promise<VersionInfo>
  getModels(): Promise<ModelOption[]>
  testApi(patch?: ApiSettingsPatch): Promise<TestApiResult>
  searchFiles(cwd: string, query: string): Promise<FileEntry[]>
  fileTree(cwd: string): Promise<FileNode[]>
  readFile(cwd: string, path: string): Promise<FileContent>
  writeFile(cwd: string, path: string, text: string): Promise<void>
  listExtensions(cwd: string, tabId?: string): Promise<ExtensionsSnapshot>
  readMcpConfig(scope: 'user' | 'project' | 'local', cwd: string): Promise<McpConfigSnapshot>
  saveMcpConfig(
    scope: 'user' | 'project' | 'local',
    cwd: string,
    text: string
  ): Promise<McpConfigSnapshot>
  togglePlugin(
    name: string,
    enabled: boolean,
    cwd: string,
    tabId?: string
  ): Promise<ExtensionsSnapshot>
  pluginAction(
    action: PluginAction,
    name: string,
    cwd: string,
    tabId?: string
  ): Promise<ExtensionsSnapshot>
  pluginMarketplaces(cwd: string): Promise<PluginMarketplaceSnapshot>
  marketplaceAdd(source: string, cwd: string): Promise<PluginMarketplaceSnapshot>
  marketplaceUpdate(name: string | undefined, cwd: string): Promise<PluginMarketplaceSnapshot>
  marketplaceRemove(name: string, cwd: string): Promise<PluginMarketplaceSnapshot>
  cancelPluginAction(): Promise<void>
  readExtensionFile(path: string, cwd: string): Promise<ExtensionTextFile>
  writeExtensionFile(path: string, text: string, cwd: string): Promise<void>
  createExtensionFile(
    kind: 'skill' | 'agent',
    scope: 'user' | 'project',
    cwd: string,
    name: string,
    text: string
  ): Promise<ExtensionTextFile>
  deleteExtensionFile(path: string, cwd: string): Promise<void>
  readHooksConfig(
    scope: 'user' | 'project',
    cwd: string
  ): Promise<ExtensionTextFile>
  saveHooksConfig(
    scope: 'user' | 'project',
    cwd: string,
    text: string
  ): Promise<ExtensionTextFile>
  openConsole(providerId?: string): Promise<void>
  openPath(path: string): Promise<void>
  openBackupDir(): Promise<void>
  onEvent(callback: (payload: TabEventPayload) => void): () => void
  onState(callback: (payload: TabStatePayload) => void): () => void
  onPermission(callback: (payload: TabPermissionPayload) => void): () => void
  onPermissionCancel(callback: (payload: TabPermissionCancelPayload) => void): () => void
  onNewTabRequest(callback: () => void): () => void
}
