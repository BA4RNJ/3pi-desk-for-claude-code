/**
 * End-to-end Cloudflare Tunnel smoke test with isolated app data.
 * Requires network access and the cloudflared binary (auto-downloaded).
 *
 *   node scripts/remote-cloudflare-smoke.mjs
 */
import { _electron as electron } from 'playwright-core'
import { promises as fs } from 'node:fs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { hashPassword } from '../src/main/remote-auth.ts'
import { TunnelManager } from '../src/main/tunnel.ts'

const root = '/tmp/3pi-cloudflare-smoke'
const port = 37998
const username = 'cloudflare-tester'
const password = 'cloudflare-test-password'

await fs.rm(root, { recursive: true, force: true })
const home = join(root, 'home')
const config = join(root, 'config')
const userData = join(root, 'userData')
const workspace = join(root, 'workspace')
for (const dir of [home, config, userData, workspace, join(config, 'claude-desk')]) {
  mkdirSync(dir, { recursive: true })
}

const { salt, hash } = hashPassword(password)
const settings = {
  cwd: workspace,
  preferences: { recentWorkspaces: [workspace], closeToTray: false },
  remote: {
    enabled: true,
    port,
    bind: 'lan',
    username,
    passwordSalt: salt,
    passwordHash: hash,
    allowedRoots: [home, workspace]
  }
}
for (const path of [
  join(userData, 'settings.json'),
  join(config, 'claude-desk', 'settings.json')
]) {
  writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 })
}

const tunnel = new TunnelManager(() => {}, '/tmp/3pi-cloudflared-test')
if (!(await tunnel.detect())) {
  const downloaded = await tunnel.download()
  if (!downloaded.available) throw new Error(downloaded.error || 'cloudflared download failed')
}

const app = await electron.launch({
  args: ['.', '--no-sandbox', `--user-data-dir=${userData}`],
  cwd: process.cwd(),
  env: {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: config,
    CLAUDE_CONFIG_DIR: join(root, 'claude'),
    ELECTRON_ENABLE_LOGGING: '1'
  }
})

try {
  const desktop = await app.firstWindow()
  await desktop.waitForLoadState('domcontentloaded')
  await desktop.waitForTimeout(1200)

  let healthy = false
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`)
      healthy = response.ok
      if (healthy) break
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  if (!healthy) throw new Error('local remote server did not start')

  await tunnel.startQuick(port)
  let publicUrl = ''
  for (let attempt = 0; attempt < 60; attempt += 1) {
    publicUrl = tunnel.getStatus().url || ''
    if (publicUrl) break
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  if (!publicUrl) throw new Error('cloudflared did not report a public URL')
  console.log('public url:', publicUrl)

  // Wait until the tunnel is actually serving the app. Quick tunnels create
  // their DNS record asynchronously, so this can take tens of seconds.
  let tunnelHealthy = false
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${publicUrl}/healthz`)
      if (response.ok) {
        tunnelHealthy = true
        console.log('tunnel health ok after', attempt + 1, 's')
        break
      }
    } catch (error) {
      if (attempt % 10 === 0) {
        console.log('tunnel not ready:', attempt + 1, 's', error instanceof Error ? error.message : String(error))
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  if (!tunnelHealthy) throw new Error('Cloudflare quick tunnel did not become reachable')

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
    publicUrl
  )

  const pages = app.windows()
  const mobile = pages.find((page) => page.url().startsWith(publicUrl))
  if (!mobile) throw new Error('public browser window was not created')
  await mobile.waitForLoadState('domcontentloaded')
  await mobile.waitForTimeout(1000)

  await mobile.locator('input[autocomplete="username"]').fill(username)
  await mobile.locator('input[type="password"]').fill(password)
  await mobile.locator('button[type="submit"]').click()
  await mobile.locator('.app').waitFor({ state: 'visible', timeout: 30000 })
  console.log('logged in through Cloudflare Tunnel')
  console.log('app title:', await mobile.title())
  await mobile.screenshot({ path: '/tmp/3pi-cloudflare-mobile.png' })
  console.log('cloudflare smoke test passed')
} finally {
  await tunnel.stop()
  await app.close()
  await fs.rm(root, { recursive: true, force: true })
}
