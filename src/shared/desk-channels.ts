/**
 * DeskApi method name -> IPC channel. The Electron preload and the browser
 * WebSocket adapter must call the exact same main-process handlers; keeping
 * the mapping in one shared module prevents the browser client from sending
 * camelCase method names that the main process does not know.
 */
export const DESK_METHOD_CHANNELS: Record<string, string> = {
  // Session / turn
  startSession: 'session:start',
  stopSession: 'session:stop',
  sendMessage: 'session:send',
  interrupt: 'session:interrupt',
  setModel: 'session:setModel',
  setPermissionMode: 'session:setPermissionMode',
  setEffort: 'session:setEffort',
  supportedCommands: 'session:commands',
  respondPermission: 'permission:respond',
  rewind: 'session:rewind',
  contextUsage: 'session:contextUsage',
  mcpStatus: 'session:mcpStatus',
  toggleMcp: 'session:toggleMcp',
  reconnectMcp: 'session:reconnectMcp',
  loginMcp: 'session:loginMcp',
  cancelMcpLogin: 'session:cancelMcpLogin',
  stopTask: 'session:stopTask',

  // Session history
  listSessions: 'sessions:list',
  listAllSessions: 'sessions:all',
  getSessionMessages: 'sessions:messages',
  renameSession: 'sessions:rename',
  deleteSession: 'sessions:delete',
  tagSession: 'sessions:tag',
  forkSession: 'sessions:fork',
  copySession: 'sessions:copy',

  // Files / export / workspace
  saveExport: 'files:export',
  pickDirectory: 'dialog:pickDirectory',
  workspaceExists: 'workspace:exists',
  relocateWorkspace: 'workspace:relocate',
  pickFiles: 'files:pick',
  saveCwd: 'cwd:save',
  searchFiles: 'files:search',
  searchContent: 'files:searchContent',
  fileTree: 'files:tree',
  readFile: 'files:read',
  writeFile: 'files:write',
  listBackups: 'backups:list',
  readBackup: 'backups:read',
  exportBackup: 'backups:export',
  exportDiagnostics: 'diagnostics:export',
  gitStatus: 'git:status',
  gitDiff: 'git:diff',

  // Settings / models / usage
  getSettings: 'settings:get',
  getUsageHistory: 'usage:history',
  recordUsageTurn: 'usage:recordTurn',
  clearUsageHistory: 'usage:clearHistory',
  createRemotePairingToken: 'remote:pairToken',
  saveApiSettings: 'settings:saveApi',
  saveApiProfile: 'settings:saveApiProfile',
  deleteApiProfile: 'settings:deleteApiProfile',
  applyApiProfile: 'settings:applyApiProfile',
  savePreferences: 'settings:savePreferences',
  savePermissionRules: 'settings:savePermissionRules',
  saveCustomModel: 'settings:saveCustomModel',
  deleteCustomModel: 'settings:deleteCustomModel',
  getWebSearchSettings: 'settings:webSearch',
  saveWebSearchSettings: 'settings:saveWebSearch',
  testWebSearch: 'settings:testWebSearch',
  getModels: 'models:list',
  testApi: 'models:test',
  versionInfo: 'app:versionInfo',

  // Background
  listBackgroundSessions: 'background:list',
  startBackgroundSession: 'background:start',
  backgroundLogs: 'background:logs',
  backgroundStop: 'background:stop',
  backgroundRemove: 'background:remove',
  trustDirectory: 'background:trust',

  // Claude CLI
  downloadClaudeCli: 'claudeCli:download',
  setClaudeCliPath: 'claudeCli:setPath',
  pickClaudeCli: 'claudeCli:pick',

  // Extensions
  listExtensions: 'extensions:list',
  readMcpConfig: 'extensions:readMcp',
  saveMcpConfig: 'extensions:saveMcp',
  togglePlugin: 'extensions:togglePlugin',
  pluginAction: 'extensions:pluginAction',
  pluginMarketplaces: 'extensions:marketplaces',
  cancelPluginAction: 'extensions:cancelPluginAction',
  marketplaceAdd: 'extensions:marketplaceAdd',
  marketplaceUpdate: 'extensions:marketplaceUpdate',
  marketplaceRemove: 'extensions:marketplaceRemove',
  readExtensionFile: 'extensions:readFile',
  writeExtensionFile: 'extensions:writeFile',
  createExtensionFile: 'extensions:createFile',
  deleteExtensionFile: 'extensions:deleteFile',
  readHooksConfig: 'extensions:readHooks',
  saveHooksConfig: 'extensions:saveHooks',

  // Shell
  openConsole: 'open:console',
  openPath: 'open:path',
  openBackupDir: 'open:backupDir'
}
