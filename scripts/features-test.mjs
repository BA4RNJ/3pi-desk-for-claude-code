import { readFileSync } from 'node:fs'
import { _electron as electron } from 'playwright-core'

const testDir = '/tmp/claude-desk-feature-test'
const app = await electron.launch({
  args: ['.', '--no-sandbox'],
  cwd: process.cwd(),
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
})
const page = await app.firstWindow()
page.on('pageerror', (error) => console.log('[pageerror]', error.message))
await page.waitForLoadState('domcontentloaded')
await page.locator('.tabbar').waitFor({ state: 'visible', timeout: 20000 })

const original = await page.evaluate(() => window.desk.getDefaults())
await page.evaluate((cwd) => window.desk.saveCwd(cwd), testDir)
await page.reload()
await page.locator('.tabbar').waitFor({ state: 'visible', timeout: 20000 })

const input = page.getByPlaceholder(/给 Claude 发消息/)
await input.fill('只回复 OK')
await page.keyboard.press('Enter')
await page.waitForFunction(
  () => {
    const nodes = Array.from(document.querySelectorAll('.message-assistant'))
    return nodes.some((node) => (node.textContent || '').includes('OK'))
  },
  undefined,
  { timeout: 180000 }
)
await page.waitForFunction(() => !document.querySelector('.working-chip'), undefined, {
  timeout: 180000
})

await page.getByRole('button', { name: '设置' }).click()
await page.locator('.settings-shell').waitFor({ state: 'visible' })
await page.locator('.settings-nav').getByRole('button', { name: 'API' }).click()
await page.getByRole('button', { name: '测试连接' }).click()
await page.locator('.settings-page .settings-message').waitFor({ state: 'visible', timeout: 30000 })
console.log('api test:', (await page.locator('.settings-page .settings-message').innerText()).replace(/\n/g, ' | '))
await page.locator('.settings-content .dialog-close').click()

const effortChip = page.locator('.topbar .chip').filter({ hasText: '强度' }).first()
await effortChip.click()
await page.locator('.topbar .dropdown-menu .dropdown-item').filter({ hasText: '高' }).first().click()
await page.waitForTimeout(1200)
console.log('effort:', (await effortChip.innerText()).replace(/\n/g, ' '))

await input.fill('只回复 OK2')
await page.keyboard.press('Enter')
await page.waitForFunction(
  () => document.querySelectorAll('.message-assistant').length >= 2,
  undefined,
  { timeout: 180000 }
)
await page.waitForFunction(() => !document.querySelector('.working-chip'), undefined, {
  timeout: 180000
})
console.log('continued after effort change:', (await page.locator('.message-assistant').last().innerText()).slice(0, 80).replace(/\n/g, ' | '))

await page.getByRole('button', { name: '设置' }).click()
await page.locator('.settings-nav').getByRole('button', { name: '扩展' }).click()
await page.waitForTimeout(1500)
console.log('extensions:', (await page.locator('.extensions-panel').innerText()).slice(0, 600).replace(/\n/g, ' | '))
await page.screenshot({ path: '/tmp/opencode/ui-extensions-full.png' })

await page.locator('.scope-switch').getByRole('button', { name: '项目' }).click()
await page.waitForTimeout(500)
const editor = page.locator('.config-editor')
console.log('project mcp config:', (await editor.inputValue()).replace(/\n/g, ' ').slice(0, 200))
const config = JSON.parse(await editor.inputValue())
config.test = { type: 'stdio', command: 'echo', args: ['test'] }
await editor.fill(JSON.stringify(config, null, 2))
await page.getByRole('button', { name: '保存配置' }).click()
await page.waitForTimeout(1000)
const saved = JSON.parse(readFileSync(`${testDir}/.mcp.json`, 'utf8'))
console.log('mcp saved test server:', Boolean(saved.mcpServers?.test))

await page.locator('.settings-content .dialog-close').click()
await page.evaluate((cwd) => window.desk.saveCwd(cwd), original.cwd)
await app.close()
