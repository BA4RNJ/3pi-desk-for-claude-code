// Small platform adapter for business services originally hosted by Electron.
// Native dialogs are handled by Swift, never emulated here.
import { homedir } from 'node:os'
import { join } from 'node:path'
export const app = {
  getPath(name: string): string {
    if (name === 'userData') return process.env.DESK_NATIVE_DATA_DIR || join(homedir(), 'Library', 'Application Support', 'claude-desk')
    if (name === 'home') return homedir()
    throw new Error(`Unsupported native path: ${name}`)
  },
  getAppPath: () => process.cwd(),
  getVersion: () => process.env.DESK_NATIVE_VERSION || '0.1.4.1'
}
export const dialog = { showOpenDialog: async () => { throw new Error('Use the native file picker') } }
