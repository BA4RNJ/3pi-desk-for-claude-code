// Small platform adapter for business services originally hosted by Electron.
// Native dialogs are handled by Swift, never emulated here.
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Match Electron's `app.getPath('userData')` defaults on every platform. */
function defaultUserDataDir(): string {
  if (process.platform === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'claude-desk')
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'claude-desk')
  }
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'claude-desk')
}

export const app = {
  getPath(name: string): string {
    if (name === 'userData') return process.env.DESK_NATIVE_DATA_DIR || defaultUserDataDir()
    if (name === 'home') return homedir()
    throw new Error(`Unsupported native path: ${name}`)
  },
  getAppPath: () => process.cwd(),
  getVersion: () => process.env.DESK_NATIVE_VERSION || '0.4.3'
}
export const dialog = { showOpenDialog: async () => { throw new Error('Use the native file picker') } }
