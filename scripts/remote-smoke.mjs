/**
 * Manual LAN/web smoke test. Launches a separate Electron instance with a
 * temporary HOME/userData, enables remote access on a test port, then opens a
 * 390x844 browser window without the preload bridge and logs in through the
 * web UI. It never touches the real app data or workspace.
 *
 *   node scripts/remote-smoke.mjs
 */
import { _electron as electron } from 'playwright-core'
import { promises as fs } from 'node:fs'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { hashPassword } from '../src/main/remote-auth.ts'

const root = '/tmp/3pi-remote-smoke'
const port = 37999
const username = 'tester'
const password = 'test-password'

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
  preferences: {
    recentWorkspaces: [workspace],
    closeToTray: false
  },
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
  await desktop.waitForTimeout(1500)
  console.log('desktop title:', await desktop.title())

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
  if (!healthy) throw new Error('remote server did not start')

  const url = `http://127.0.0.1:${port}/`
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

  const pages = app.windows()
  const mobile = pages.find((page) => page.url().startsWith(url))
  if (!mobile) throw new Error('mobile browser window was not created')
  await mobile.waitForLoadState('domcontentloaded')
  await mobile.waitForTimeout(800)
  console.log('mobile url:', mobile.url())
  console.log('login visible:', await mobile.locator('input[type="password"]').count())

  // Wrong password must not enter the app.
  await mobile.locator('input[autocomplete="username"]').fill(username)
  await mobile.locator('input[type="password"]').fill('wrong-password')
  await mobile.locator('button[type="submit"]').click()
  await mobile.waitForTimeout(700)
  console.log('wrong password error:', (await mobile.locator('body').innerText()).includes('账号或密码错误'))

  await mobile.locator('input[type="password"]').fill(password)
  await mobile.locator('button[type="submit"]').click()
  await mobile.locator('.app').waitFor({ state: 'visible', timeout: 20000 })
  console.log('logged in, app visible')

  // Create a tab from the mobile drawer; the desktop tab bar must update.
  await mobile.locator('.mobile-menu-button').click()
  await mobile.locator('.new-chat').click()
  await mobile.waitForTimeout(1200)
  const desktopTabs = await desktop.locator('.tab').count()
  const mobileTabs = await mobile.locator('.tab').count()
  console.log('tabs desktop/mobile:', desktopTabs, mobileTabs)

  const mapping = await mobile.evaluate(async () => {
    const defaults = await window.desk.getDefaults()
    const sessions = await window.desk.listSessions(defaults.cwd, 0, 5)
    let sendError = ''
    try {
      await window.desk.sendMessage('fake-tab', { text: 'x' })
    } catch (error) {
      sendError = error instanceof Error ? error.message : String(error)
    }
    return { sessionsIsArray: Array.isArray(sessions), sendError }
  })
  console.log('channel mapping:', mapping)
  if (!mapping.sessionsIsArray) throw new Error('listSessions did not return an array')
  if (mapping.sendError.includes('Unknown method')) {
    throw new Error('sendMessage was not mapped to session:send')
  }

  const dropdownTriggers = mobile.locator('.composer-controls .dropdown > button')
  const dropdownCount = await dropdownTriggers.count()
  console.log('composer dropdowns:', dropdownCount)
  const viewport = await mobile.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight
  }))
  for (let index = 0; index < Math.min(3, dropdownCount); index += 1) {
    const trigger = dropdownTriggers.nth(index)
    await trigger.click()
    await mobile.waitForTimeout(250)
    const menu = mobile.locator('.dropdown-menu').first()
    const visible = await menu.isVisible().catch(() => false)
    const box = visible ? await menu.boundingBox() : null
    console.log(
      `dropdown ${index}: visible=${visible} box=${JSON.stringify(box)} viewport=${JSON.stringify(viewport)}`
    )
    if (!visible) throw new Error(`composer dropdown ${index} did not open`)
    if (
      box &&
      (box.x < -1 ||
        box.y < -1 ||
        box.x + box.width > viewport.width + 1 ||
        box.y + box.height > viewport.height + 1)
    ) {
      throw new Error(`composer dropdown ${index} is clipped outside the viewport`)
    }
    await trigger.click()
    await mobile.waitForTimeout(150)
  }

  // The same controls on the desktop window must still open.
  await desktop.locator('.tab').first().click()
  await desktop.waitForTimeout(400)
  const desktopTriggers = desktop.locator('.composer-controls .dropdown > button')
  const desktopCount = await desktopTriggers.count()
  console.log('desktop composer dropdowns:', desktopCount)
  if (desktopCount > 0) {
    await desktopTriggers.first().click()
    await desktop.waitForTimeout(200)
    console.log(
      'desktop first dropdown visible:',
      await desktop.locator('.dropdown-menu').first().isVisible()
    )
    await desktopTriggers.first().click()
  }

  const overflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  console.log('horizontal overflow:', overflow)

  await mobile.screenshot({ path: '/tmp/3pi-remote-mobile.png' })
  await desktop.screenshot({ path: '/tmp/3pi-remote-desktop.png' })

  // Check the mobile project home and project view layouts too.
  await mobile.locator('.mobile-menu-button').click()
  await mobile.locator('.projects-nav').click()
  await mobile.waitForTimeout(600)
  await mobile.screenshot({ path: '/tmp/3pi-remote-home.png' })
  const homeOverflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  console.log('home overflow:', homeOverflow)
  const card = mobile.locator('.project-card').first()
  if ((await card.count()) > 0) {
    await card.click()
    await mobile.waitForTimeout(800)
    await mobile.screenshot({ path: '/tmp/3pi-remote-project.png' })
    const projectOverflow = await mobile.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    console.log('project overflow:', projectOverflow)
  }

  if (desktopTabs < 1 || mobileTabs < 1) {
    throw new Error('shared tab was not created on both clients')
  }
  if (overflow > 2) {
    throw new Error(`mobile layout overflows horizontally by ${overflow}px`)
  }
  console.log('remote smoke test passed')
} finally {
  await app.close()
  await fs.rm(root, { recursive: true, force: true })
}
