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

const input = page.getByPlaceholder(/给 Claude 发消息/)
await page.getByRole('button', { name: '新建对话' }).click()
await page.waitForTimeout(400)
console.log('tabs after new:', await page.locator('.tab').count())

await input.fill('只回复 ONE')
await page.keyboard.press('Enter')

await page.locator('.tab').first().click()
await page.waitForTimeout(300)
await input.fill('只回复 TWO')
await page.keyboard.press('Enter')

await page.waitForFunction(
  () => {
    const nodes = Array.from(document.querySelectorAll('.message-assistant'))
    return nodes.some((node) => (node.textContent || '').includes('TWO'))
  },
  undefined,
  { timeout: 180000 }
)
console.log('tab1:', (await page.locator('.chat-inner').innerText()).slice(-200).replace(/\n/g, ' | '))

await page.locator('.tab').nth(1).click()
await page.waitForFunction(
  () => {
    const nodes = Array.from(document.querySelectorAll('.message-assistant'))
    return nodes.some((node) => (node.textContent || '').includes('ONE'))
  },
  undefined,
  { timeout: 180000 }
)
console.log('tab2:', (await page.locator('.chat-inner').innerText()).slice(-200).replace(/\n/g, ' | '))

await page.screenshot({ path: '/tmp/opencode/ui-tabs.png' })
await page.locator('.tab').nth(1).click()
await page.locator('.tab.is-active .tab-close').click()
await page.waitForTimeout(500)
console.log('tabs after close:', await page.locator('.tab').count())
await app.close()
