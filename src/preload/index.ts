import { contextBridge, ipcRenderer } from 'electron'
import type {
  ApiProfile,
  ApiProfileInput,
  ApiSettings,
  ApiSettingsPatch,
  AppDefaults,
  BackgroundSession,
  BackgroundStartResult,
  AttachmentPickResult,
  CustomModel,
  DeskApi,
  ClaudeCliStatus,
  EffortSetting,
  ExtensionsSnapshot,
  ExtensionTextFile,
  McpConfigSnapshot,
  PluginAction,
  PluginMarketplaceSnapshot,
  McpServerEntry,
  ModelOption,
  PermissionMode,
  PermissionResponsePayload,
  PermissionRules,
  PreferencesPatch,
  RewindPreview,
  SendMessagePayload,
  SessionInfo,
  SessionMessage,
  SessionStartOptions,
  SessionState,
  SettingsSnapshot,
  SlashCommandInfo,
  TabEventPayload,
  TabPermissionCancelPayload,
  TabPermissionPayload,
  TabStatePayload,
  TestApiResult,
  VersionInfo,
  ContextUsage,
  FileEntry,
  FileContent,
  FileNode
} from '../shared/types'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: DeskApi = {
  startSession: (tabId: string, options: SessionStartOptions): Promise<SessionState> =>
    ipcRenderer.invoke('session:start', tabId, options),
  stopSession: (tabId: string): Promise<void> => ipcRenderer.invoke('session:stop', tabId),
  sendMessage: (tabId: string, payload: SendMessagePayload): Promise<void> =>
    ipcRenderer.invoke('session:send', tabId, payload),
  interrupt: (tabId: string): Promise<void> => ipcRenderer.invoke('session:interrupt', tabId),
  setModel: (tabId: string, model: string): Promise<void> =>
    ipcRenderer.invoke('session:setModel', tabId, model),
  setPermissionMode: (tabId: string, mode: PermissionMode): Promise<void> =>
    ipcRenderer.invoke('session:setPermissionMode', tabId, mode),
  setEffort: (tabId: string, effort: EffortSetting): Promise<void> =>
    ipcRenderer.invoke('session:setEffort', tabId, effort),
  supportedCommands: (tabId: string): Promise<SlashCommandInfo[]> =>
    ipcRenderer.invoke('session:commands', tabId),
  respondPermission: (
    tabId: string,
    response: PermissionResponsePayload
  ): Promise<void> => ipcRenderer.invoke('permission:respond', tabId, response),
  rewind: (tabId: string, userMessageId: string, dryRun: boolean): Promise<RewindPreview> =>
    ipcRenderer.invoke('session:rewind', tabId, userMessageId, dryRun),
  contextUsage: (tabId: string): Promise<ContextUsage | null> =>
    ipcRenderer.invoke('session:contextUsage', tabId),
  mcpStatus: (tabId: string): Promise<McpServerEntry[]> =>
    ipcRenderer.invoke('session:mcpStatus', tabId),
  toggleMcp: (tabId: string, name: string, enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('session:toggleMcp', tabId, name, enabled),
  listSessions: (cwd: string): Promise<SessionInfo[]> =>
    ipcRenderer.invoke('sessions:list', cwd),
  listAllSessions: (limit = 200): Promise<SessionInfo[]> =>
    ipcRenderer.invoke('sessions:all', limit),
  getSessionMessages: (sessionId: string, cwd: string): Promise<SessionMessage[]> =>
    ipcRenderer.invoke('sessions:messages', sessionId, cwd),
  renameSession: (sessionId: string, title: string, cwd: string): Promise<void> =>
    ipcRenderer.invoke('sessions:rename', sessionId, title, cwd),
  deleteSession: (sessionId: string, cwd: string): Promise<string> =>
    ipcRenderer.invoke('sessions:delete', sessionId, cwd),
  tagSession: (sessionId: string, tag: string | null, cwd: string): Promise<void> =>
    ipcRenderer.invoke('sessions:tag', sessionId, tag, cwd),
  forkSession: (
    sessionId: string,
    cwd: string,
    upToMessageId?: string
  ): Promise<string> => ipcRenderer.invoke('sessions:fork', sessionId, cwd, upToMessageId),
  saveExport: (defaultName: string, content: string): Promise<string | null> =>
    ipcRenderer.invoke('files:export', defaultName, content),
  pickDirectory: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:pickDirectory', defaultPath),
  pickFiles: (): Promise<AttachmentPickResult> => ipcRenderer.invoke('files:pick'),
  getDefaults: (): Promise<AppDefaults> => ipcRenderer.invoke('defaults:get'),
  saveCwd: (cwd: string): Promise<void> => ipcRenderer.invoke('cwd:save', cwd),
  getSettings: (): Promise<SettingsSnapshot> => ipcRenderer.invoke('settings:get'),
  saveApiSettings: (patch: ApiSettingsPatch): Promise<SettingsSnapshot['api']> =>
    ipcRenderer.invoke('settings:saveApi', patch),
  saveApiProfile: (profile: ApiProfileInput): Promise<ApiProfile[]> =>
    ipcRenderer.invoke('settings:saveApiProfile', profile),
  deleteApiProfile: (id: string): Promise<ApiProfile[]> =>
    ipcRenderer.invoke('settings:deleteApiProfile', id),
  applyApiProfile: (id: string): Promise<ApiSettings> =>
    ipcRenderer.invoke('settings:applyApiProfile', id),
  savePreferences: (patch: PreferencesPatch): Promise<SettingsSnapshot['preferences']> =>
    ipcRenderer.invoke('settings:savePreferences', patch),
  savePermissionRules: (rules: PermissionRules): Promise<PermissionRules> =>
    ipcRenderer.invoke('settings:savePermissionRules', rules),
  saveCustomModel: (model: CustomModel): Promise<CustomModel[]> =>
    ipcRenderer.invoke('settings:saveCustomModel', model),
  deleteCustomModel: (id: string, providerId?: string): Promise<CustomModel[]> =>
    ipcRenderer.invoke('settings:deleteCustomModel', id, providerId),
  listBackgroundSessions: (): Promise<BackgroundSession[]> =>
    ipcRenderer.invoke('background:list'),
  startBackgroundSession: (
    cwd: string,
    prompt: string,
    trust: boolean
  ): Promise<BackgroundStartResult> =>
    ipcRenderer.invoke('background:start', cwd, prompt, trust),
  backgroundLogs: (id: string): Promise<string> =>
    ipcRenderer.invoke('background:logs', id),
  backgroundStop: (id: string): Promise<string> =>
    ipcRenderer.invoke('background:stop', id),
  backgroundRemove: (id: string): Promise<string> =>
    ipcRenderer.invoke('background:remove', id),
  trustDirectory: (cwd: string): Promise<void> =>
    ipcRenderer.invoke('background:trust', cwd),
  versionInfo: (): Promise<VersionInfo> =>
    ipcRenderer.invoke('app:versionInfo'),
  getModels: (): Promise<ModelOption[]> => ipcRenderer.invoke('models:list'),
  testApi: (patch?: ApiSettingsPatch): Promise<TestApiResult> =>
    ipcRenderer.invoke('models:test', patch),
  searchFiles: (cwd: string, query: string): Promise<FileEntry[]> =>
    ipcRenderer.invoke('files:search', cwd, query),
  fileTree: (cwd: string): Promise<FileNode[]> =>
    ipcRenderer.invoke('files:tree', cwd),
  readFile: (cwd: string, path: string): Promise<FileContent> =>
    ipcRenderer.invoke('files:read', cwd, path),
  writeFile: (cwd: string, path: string, text: string): Promise<void> =>
    ipcRenderer.invoke('files:write', cwd, path, text),
  listExtensions: (cwd: string, tabId?: string): Promise<ExtensionsSnapshot> =>
    ipcRenderer.invoke('extensions:list', cwd, tabId),
  readMcpConfig: (
    scope: 'user' | 'project' | 'local',
    cwd: string
  ): Promise<McpConfigSnapshot> => ipcRenderer.invoke('extensions:readMcp', scope, cwd),
  saveMcpConfig: (
    scope: 'user' | 'project' | 'local',
    cwd: string,
    text: string
  ): Promise<McpConfigSnapshot> =>
    ipcRenderer.invoke('extensions:saveMcp', scope, cwd, text),
  togglePlugin: (
    name: string,
    enabled: boolean,
    cwd: string,
    tabId?: string
  ): Promise<ExtensionsSnapshot> =>
    ipcRenderer.invoke('extensions:togglePlugin', name, enabled, cwd, tabId),
  pluginAction: (
    action: PluginAction,
    name: string,
    cwd: string,
    tabId?: string
  ): Promise<ExtensionsSnapshot> =>
    ipcRenderer.invoke('extensions:pluginAction', action, name, cwd, tabId),
  pluginMarketplaces: (cwd: string): Promise<PluginMarketplaceSnapshot> =>
    ipcRenderer.invoke('extensions:marketplaces', cwd),
  cancelPluginAction: (): Promise<void> =>
    ipcRenderer.invoke('extensions:cancelPluginAction'),
  marketplaceAdd: (source: string, cwd: string): Promise<PluginMarketplaceSnapshot> =>
    ipcRenderer.invoke('extensions:marketplaceAdd', source, cwd),
  marketplaceUpdate: (
    name: string | undefined,
    cwd: string
  ): Promise<PluginMarketplaceSnapshot> =>
    ipcRenderer.invoke('extensions:marketplaceUpdate', name, cwd),
  marketplaceRemove: (name: string, cwd: string): Promise<PluginMarketplaceSnapshot> =>
    ipcRenderer.invoke('extensions:marketplaceRemove', name, cwd),
  readExtensionFile: (path: string, cwd: string): Promise<ExtensionTextFile> =>
    ipcRenderer.invoke('extensions:readFile', path, cwd),
  writeExtensionFile: (path: string, text: string, cwd: string): Promise<void> =>
    ipcRenderer.invoke('extensions:writeFile', path, text, cwd),
  createExtensionFile: (
    kind: 'skill' | 'agent',
    scope: 'user' | 'project',
    cwd: string,
    name: string,
    text: string
  ): Promise<ExtensionTextFile> =>
    ipcRenderer.invoke('extensions:createFile', kind, scope, cwd, name, text),
  deleteExtensionFile: (path: string, cwd: string): Promise<void> =>
    ipcRenderer.invoke('extensions:deleteFile', path, cwd),
  readHooksConfig: (
    scope: 'user' | 'project',
    cwd: string
  ): Promise<ExtensionTextFile> =>
    ipcRenderer.invoke('extensions:readHooks', scope, cwd),
  saveHooksConfig: (
    scope: 'user' | 'project',
    cwd: string,
    text: string
  ): Promise<ExtensionTextFile> =>
    ipcRenderer.invoke('extensions:saveHooks', scope, cwd, text),
  openConsole: (providerId?: string): Promise<void> =>
    ipcRenderer.invoke('open:console', providerId),
  openPath: (path: string): Promise<void> => ipcRenderer.invoke('open:path', path),
  openBackupDir: (): Promise<void> => ipcRenderer.invoke('open:backupDir'),
  getClaudeCliStatus: (refresh = false): Promise<ClaudeCliStatus> =>
    ipcRenderer.invoke('claudeCli:status', refresh),
  downloadClaudeCli: (): Promise<ClaudeCliStatus> =>
    ipcRenderer.invoke('claudeCli:download'),
  setClaudeCliPath: (path: string | null): Promise<ClaudeCliStatus> =>
    ipcRenderer.invoke('claudeCli:setPath', path),
  pickClaudeCli: (): Promise<ClaudeCliStatus | null> =>
    ipcRenderer.invoke('claudeCli:pick'),
  onClaudeCliStatus: (callback: (payload: ClaudeCliStatus) => void) =>
    subscribe('claude-cli:status', callback),
  onEvent: (callback: (payload: TabEventPayload) => void) =>
    subscribe('session:event', callback),
  onState: (callback: (payload: TabStatePayload) => void) =>
    subscribe('session:state', callback),
  onPermission: (callback: (payload: TabPermissionPayload) => void) =>
    subscribe('permission:request', callback),
  onPermissionCancel: (callback: (payload: TabPermissionCancelPayload) => void) =>
    subscribe('permission:cancel', callback),
  onNewTabRequest: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('app:new-tab', listener)
    return () => ipcRenderer.removeListener('app:new-tab', listener)
  },
  onOpenSettingsRequest: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('app:open-settings', listener)
    return () => ipcRenderer.removeListener('app:open-settings', listener)
  }
}

contextBridge.exposeInMainWorld('desk', api)
