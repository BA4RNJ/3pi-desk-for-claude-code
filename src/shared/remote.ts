import type {
  AppDefaults,
  ClaudeCliStatus,
  RemoteSettings,
  RemoteStatus,
  RemoteTab,
  SettingsSnapshot
} from './types'

/** Version of the browser <-> desktop protocol. Bump on breaking changes. */
export const REMOTE_PROTOCOL_VERSION = 1

export interface RemoteSnapshot {
  protocol: number
  runtime: 'web'
  defaults: AppDefaults
  settings: SettingsSnapshot
  claudeCli: ClaudeCliStatus | null
  tabs: RemoteTab[]
  remote: RemoteStatus
}

export type RemoteClientMessage =
  | {
      v: typeof REMOTE_PROTOCOL_VERSION
      type: 'login'
      username: string
      password: string
      device?: { name?: string }
    }
  | {
      v: typeof REMOTE_PROTOCOL_VERSION
      type: 'resume'
      token: string
      device?: { name?: string }
    }
  | {
      v: typeof REMOTE_PROTOCOL_VERSION
      type: 'pair'
      code: string
      device?: { name?: string }
    }
  | {
      v: typeof REMOTE_PROTOCOL_VERSION
      id: string
      method: string
      args?: unknown[]
    }

export type RemoteServerMessage =
  | {
      v: typeof REMOTE_PROTOCOL_VERSION
      type: 'ready'
      protocol: number
      runtime: 'web'
      token: string
      snapshot: RemoteSnapshot
    }
  | {
      v: typeof REMOTE_PROTOCOL_VERSION
      type: 'error'
      error: { code: string; message: string }
    }
  | {
      v: typeof REMOTE_PROTOCOL_VERSION
      id: string
      result?: unknown
      error?: { code?: string; message: string }
    }
  | {
      v: typeof REMOTE_PROTOCOL_VERSION
      event: string
      data: unknown
    }

export interface RemoteServerStatus extends RemoteStatus {
  settings: RemoteSettings
}

/** Methods that need the desktop process (native dialogs / shell). */
export const DESKTOP_ONLY_METHODS = new Set<string>([
  'dialog:pickDirectory',
  'files:pick',
  'files:export',
  'backups:export',
  'diagnostics:export',
  'claudeCli:pick',
  'open:path',
  'open:backupDir',
  'remote:save',
  'remote:setCredentials',
  'remote:pairToken',
  'remote:startTunnel',
  'remote:stopTunnel'
])

export function isDesktopOnlyMethod(method: string): boolean {
  return DESKTOP_ONLY_METHODS.has(method)
}
