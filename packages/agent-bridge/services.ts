import { mergeUsage, summarizeUsage, modelPricingLabel } from '../../src/renderer/src/lib/usage'
import * as settings from '../../src/main/settings'
import * as models from '../../src/main/models'
import * as extensions from '../../src/main/extensions'
import * as background from '../../src/main/background'
import * as files from '../../src/main/files'
import { PERMISSION_OPTIONS, EFFORT_OPTIONS, FALLBACK_COMMANDS } from '../../src/shared/ui-options'
import { PROVIDER_PRESETS } from '../../src/shared/providers'
import { listSessions, getSessionMessages, renameSession, tagSession, forkSession, deleteSession } from '@anthropic-ai/claude-agent-sdk'
import { promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { app } from './native-platform'
import { versionInfo } from '../../src/main/version'

type Params = Record<string, any>
export async function service(method: string, p: Params): Promise<unknown> {
  switch (method) {
    case 'usage:update': { const usage = p.delta ? mergeUsage(p.base, p.delta) : p.total || p.base; return { usage, summary: summarizeUsage(usage, p.models || []) } }
    case 'model:pricing': return modelPricingLabel(p.pricing)
    case 'ui:options': return { permissions: PERMISSION_OPTIONS, efforts: EFFORT_OPTIONS, commands: FALLBACK_COMMANDS }
    case 'settings:get': return settings.getSettingsSnapshot()
    case 'settings:saveApi': return settings.saveApiSettings(p.patch)
    case 'settings:savePreferences': return settings.savePreferences(p.patch)
    case 'settings:savePermissionRules': return settings.savePermissionRules(p.rules)
    case 'settings:saveCustomModel': return settings.saveCustomModel(p.model)
    case 'settings:deleteCustomModel': return settings.deleteCustomModel(p.id, p.providerId)
    case 'settings:saveApiProfile': return settings.saveApiProfile(p.profile)
    case 'settings:deleteApiProfile': return settings.deleteApiProfile(p.id)
    case 'settings:applyApiProfile': return settings.applyApiProfile(p.id)
    case 'providers:list': return PROVIDER_PRESETS
    case 'models:list': return models.getModels()
    case 'models:test': return models.testApi(p.patch)
    case 'sessions:list': return listSessions({ dir: p.cwd, limit: 60, includeWorktrees: true })
    case 'sessions:all': return listSessions({ limit: 200, includeWorktrees: true })
    case 'sessions:messages': return getSessionMessages(p.sessionId, { dir: p.cwd })
    case 'sessions:delete': {
      if (typeof p.sessionId !== 'string' || !/^[a-f0-9-]{36}$/i.test(p.sessionId)) throw new Error('Invalid session ID')
      const root = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'projects')
      let source: string | undefined
      for (const entry of await fs.readdir(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const candidate = join(root, entry.name, `${p.sessionId}.jsonl`)
        try { if ((await fs.stat(candidate)).isFile()) { source = candidate; break } } catch {}
      }
      if (!source) throw new Error('Transcript not found; deletion cancelled to protect the conversation.')
      const backups = join(app.getPath('userData'), 'session-backups')
      await fs.mkdir(backups, { recursive: true })
      const backup = join(backups, `${new Date().toISOString().replace(/[:.]/g, '-')}-${p.sessionId}.jsonl`)
      await fs.copyFile(source, backup)
      await deleteSession(p.sessionId, { dir: p.cwd })
      return backup
    }
    case 'sessions:rename': return renameSession(p.sessionId, p.title, { dir: p.cwd })
    case 'sessions:tag': return tagSession(p.sessionId, p.tag, { dir: p.cwd })
    case 'sessions:fork': return forkSession(p.sessionId, { dir: p.cwd, upToMessageId: p.upToMessageId })
    case 'files:search': return files.searchFiles(p.cwd, p.query)
    case 'files:tree': return files.fileTree(p.cwd)
    case 'files:read': return files.readFileContent(p.cwd, p.path)
    case 'files:write': return files.writeFileContent(p.cwd, p.path, p.text)
    case 'files:attachments': return files.readAttachments(p.paths)
    case 'extensions:list': return extensions.listExtensions(p.cwd)
    case 'extensions:readMcp': return extensions.readMcpConfig(p.scope, p.cwd)
    case 'extensions:saveMcp': return extensions.saveMcpConfig(p.scope, p.cwd, p.text)
    case 'extensions:readHooks': return extensions.readHooksConfig(p.scope, p.cwd)
    case 'extensions:saveHooks': return extensions.saveHooksConfig(p.scope, p.cwd, p.text)
    case 'extensions:readFile': return extensions.readExtensionFile(p.path, p.cwd)
    case 'extensions:writeFile': return extensions.writeExtensionFile(p.path, p.text, p.cwd)
    case 'extensions:createFile': return extensions.createExtensionFile(p.kind, p.scope, p.cwd, p.name, p.text)
    case 'extensions:deleteFile': return extensions.deleteExtensionFile(p.path, p.cwd)
    case 'extensions:marketplaces': return extensions.pluginMarketplaces(p.cwd)
    case 'extensions:marketplaceAdd': return extensions.marketplaceAdd(p.source, p.cwd)
    case 'extensions:marketplaceUpdate': return extensions.marketplaceUpdate(p.name, p.cwd)
    case 'extensions:marketplaceRemove': return extensions.marketplaceRemove(p.name, p.cwd)
    case 'extensions:pluginAction': return extensions.pluginAction(p.action, p.name, p.cwd)
    case 'extensions:togglePlugin': return extensions.togglePlugin(p.name, p.enabled)
    case 'extensions:cancelPluginAction': return extensions.cancelPluginAction()
    case 'background:list': return background.listBackgroundSessions()
    case 'background:start': return background.startBackgroundSession(p.cwd, p.prompt, p.trust)
    case 'background:logs': return background.backgroundLogs(p.id)
    case 'background:stop': return background.backgroundStop(p.id)
    case 'background:remove': return background.backgroundRemove(p.id)
    case 'app:versionInfoLocal': return versionInfo(false)
    case 'app:versionInfo': return versionInfo()
    default: throw new Error(`Unsupported service: ${method}`)
  }
}
