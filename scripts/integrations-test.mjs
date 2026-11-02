import { _electron as electron } from 'playwright-core'

const app = await electron.launch({
  args: ['.', '--no-sandbox'],
  cwd: process.cwd(),
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
})
const page = await app.firstWindow()
page.on('pageerror', (error) => console.log('[pageerror]', error.message))
await page.waitForLoadState('domcontentloaded')
await page.locator('.tabbar').waitFor({ state: 'visible', timeout: 20000 })

const original = await page.evaluate(() => window.desk.getSettings())

await page.getByRole('button', { name: '设置' }).click()
await page.locator('.settings-shell').waitFor({ state: 'visible' })
const ide = page.locator('.toggle-row').filter({ hasText: '连接 IDE' }).locator('input')
const chrome = page.locator('.toggle-row').filter({ hasText: 'Chrome 集成' }).locator('input')
await ide.check()
await chrome.check()
await page.getByRole('button', { name: '保存偏好' }).click()
await page.waitForTimeout(400)
await page.locator('.settings-content .dialog-close').click()

await page.getByRole('button', { name: '新建对话' }).click()
const input = page.getByPlaceholder(/给 Claude 发消息/)
await input.fill('只回复 OK')
await page.keyboard.press('Enter')
await page.waitForTimeout(15000)
console.log('chat after integrations:', (await page.locator('.chat-inner').innerText()).slice(0, 400).replace(/\n/g, ' | '))
const errorBanner = await page.locator('.error-banner').count()
console.log('error banner:', errorBanner)

await page.evaluate((preferences) => window.desk.savePreferences(preferences), original.preferences)
await app.close()
