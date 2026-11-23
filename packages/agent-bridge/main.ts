import {
  getApiSettings,
  getPreferences,
  getWebSearchConfig,
  buildExtraArgs,
  saveCwd
} from '../../src/main/settings'
import {
  findModelContextWindow,
  getCachedModelContextWindow
} from '../../src/main/models'
import { SessionManager, type StartOptions } from '../../src/main/session'
import { cancelPluginAction } from '../../src/main/extensions'
import { service } from './services'
import { serve } from './protocol.mjs'

class NativeSessionManager extends SessionManager {
  override async start(options: StartOptions) {
    const preferences = getPreferences()
    saveCwd(options.cwd)
    const contextWindow = getCachedModelContextWindow(options.model)
    if (contextWindow === undefined) {
      void findModelContextWindow(options.model).catch(() => undefined)
    }
    return super.start({ ...options, extraArgs: buildExtraArgs(preferences), maxBudgetUsd: preferences.maxBudgetUsd ?? undefined, additionalDirectories: preferences.additionalDirectories, allowedTools: preferences.allowedTools, disallowedTools: preferences.disallowedTools, contextWindow, apiProviderId: getApiSettings().providerId, webSearch: getWebSearchConfig() })
  }
  override async setModel(model: string) { return super.setModel(model, await findModelContextWindow(model)) }
}
const shutdown = serve({ service, onShutdown: cancelPluginAction, input: process.stdin, output: process.stdout, createSession: (callbacks: ConstructorParameters<typeof SessionManager>[0]) => new NativeSessionManager(callbacks) })
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void shutdown().finally(() => process.exit(0)) })
}
