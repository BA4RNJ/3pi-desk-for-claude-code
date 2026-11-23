/**
 * Reproduce the remote-access toggle race in an isolated app instance.
 * Opens Settings -> Remote access, unchecks the enable box, waits for the
 * 4-second status poll, then saves and checks whether the server stopped.
 */
import { _electron as electron } from 'playwright-core'
import { promises as fs } from 'node:fs'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { hashPassword } from '../src/main/remote-auth.ts'

const root = '/tmp/3pi-toggle-check'
const port = 37995
const username = 'toggle-tester'
const password = 'toggle-test-password'

await fs.rm(root, { recursive: true, force: true })
const home = join(root, 'home')
const config = join(root, 'config')
const userData = join(root, 'userData')
const workspace = join(home, 'workspace')
for (const dir of [home, workspace, config, userData, join(config, 'claude-desk')]) {
  mkdirSync(dir, { recursive: true })
}
const { salt, hash } = hashPassword(password)
const settings = {
  cwd: workspace,
  preferences: { recentWorkspaces: [workspace], closeToTray: false },
  remote: {
    enabled: true,
    port,
    bind: 'localhost',
    username,
    passwordSalt: salt,
    passwordHash: hash,
    allowedRoots: [home]
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
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(1200)

  let healthy = false
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`)
      if (response.ok) {
        healthy = true
        break
      }
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  console.log('server initially healthy:', healthy)

  // Open Settings -> Remote access.
  await page.locator('.footer-button').last().click()
  await page.locator('.settings-shell').waitFor({ state: 'visible', timeout: 10000 })
  const remoteNav = page
    .locator('.settings-nav button')
    .filter({ hasText: /远程访问|Remote/i })
    .first()
  await remoteNav.click()
  await page.waitForTimeout(500)

  const checkbox = page.locator('.settings-page input[type="checkbox"]').first()
  console.log('checkbox count:', await checkbox.count(), 'initial checked:', await checkbox.isChecked())
  await checkbox.uncheck()
  console.log('after uncheck (immediate):', await checkbox.isChecked())
  await page.waitForTimeout(5200)
  console.log('after 5.2s poll:', await checkbox.isChecked())

  console.log('panel buttons:', (await page.locator('.settings-page button').allInnerTexts()).slice(0, 20))
  const save = page
    .locator('.settings-page button')
    .filter({ hasText: /Save|保存/ })
    .first()
  console.log('save button count:', await save.count(), 'text:', await save.innerText().catch(() => ''))
  if ((await save.count()) > 0) {
    await save.click()
    await page.waitForTimeout(1500)
  }

  const persisted = JSON.parse(
    readFileSync(join(userData, 'settings.json'), 'utf8')
  ).remote.enabled
  console.log('persisted enabled:', persisted)

  let stillHealthy = false
  try {
    const response = await fetch(`http://127.0.0.1:${port}/healthz`)
    stillHealthy = response.ok
  } catch {
    // expected after disabling
  }
  console.log('server still healthy after save:', stillHealthy)
  console.log('final checkbox:', await checkbox.isChecked())
} finally {
  await app.close()
  await fs.rm(root, { recursive: true, force: true })
}
