/**
 * Load the real running remote server in an isolated Electron browser window,
 * log in with the real credentials, and verify the channel mapping. Does not
 * create sessions or send real messages.
 */
import { _electron as electron } from 'playwright-core'
import { promises as fs } from 'node:fs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const root = '/tmp/3pi-live-check'
const url = 'http://127.0.0.1:3789/?v=livecheck'
const username = process.env.REMOTE_LIVE_USER || 'ba4rnj'
// Never hard-code real credentials in this repository. Export the password
// before running: REMOTE_LIVE_PASSWORD='…' node scripts/remote-live-check.mjs
const password = process.env.REMOTE_LIVE_PASSWORD || ''
if (!password) {
  console.error('Set REMOTE_LIVE_PASSWORD before running this live check.')
  process.exit(1)
}
const cwd = process.env.REMOTE_LIVE_CWD || process.cwd()

await fs.rm(root, { recursive: true, force: true })
const home = join(root, 'home')
const config = join(root, 'config')
const userData = join(root, 'userData')
for (const dir of [home, config, userData, join(config, 'claude-desk')]) {
  mkdirSync(dir, { recursive: true })
}
const settings = { remote: { enabled: false } }
for (const path of [
  join(userData, 'settings.json'),
  join(config, 'claude-desk', 'settings.json')
]) {
  writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 })
}

const executablePath =
  process.env.THREE_PI_BIN || join(homedir(), '.local', 'opt', '3pi-desk', '3pi-desk')

const app = await electron.launch({
  executablePath,
  args: ['--no-sandbox', `--user-data-dir=${userData}`],
  env: {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: config,
    CLAUDE_CONFIG_DIR: join(root, 'claude'),
    ELECTRON_ENABLE_LOGGING: '1'
  }
})

try {
  await app.firstWindow()
  await app.evaluate(
    async ({ BrowserWindow }, target) => {
      const win = new BrowserWindow({
        width: 390,
        height: 844,
        show: true,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true
        }
      })
      await win.loadURL(target)
      return win.id
    },
    url
  )
  const page = app.windows().find((item) => item.url().startsWith(url))
  if (!page) throw new Error('browser window not created')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(500)
  console.log('login form:', await page.locator('input[type="password"]').count())

  await page.locator('input[autocomplete="username"]').fill(username)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForTimeout(2500)
  if ((await page.locator('.app').count()) === 0) {
    console.log('after login body:', (await page.locator('body').innerText()).slice(0, 800))
  }
  await page.locator('.app').waitFor({ state: 'visible', timeout: 20000 })
  console.log('logged in; asset:', await page.evaluate(() => document.querySelector('script[src]')?.getAttribute('src')))

  const result = await page.evaluate(async (targetCwd) => {
    const sessions = await window.desk.listSessions(targetCwd, 0, 5)
    let sendError = ''
    try {
      await window.desk.sendMessage('fake-tab', { text: 'x' })
    } catch (error) {
      sendError = error instanceof Error ? error.message : String(error)
    }
    const defaults = await window.desk.getDefaults()
    return {
      runtime: defaults.runtime,
      sessionsIsArray: Array.isArray(sessions),
      sessionCount: sessions.length,
      sendError
    }
  }, cwd)
  console.log('live result:', result)
  if (result.sendError.includes('Unknown method')) {
    throw new Error('live bundle is still using camelCase methods')
  }
  console.log('live check passed')
} finally {
  await app.close()
  await fs.rm(root, { recursive: true, force: true })
}
