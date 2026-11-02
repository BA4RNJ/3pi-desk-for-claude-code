import { _electron as electron } from 'playwright-core'

const app = await electron.launch({
  args: ['.', '--no-sandbox'],
  cwd: process.cwd(),
  env: {
    ...process.env,
    ELECTRON_ENABLE_LOGGING: '1'
  }
})

const page = await app.firstWindow()
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    console.log(`[renderer:${message.type()}]`, message.text())
  }
})
page.on('pageerror', (error) => console.log('[pageerror]', error.message))

await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(1200)
console.log('title:', await page.title())
console.log('body:', (await page.locator('body').innerText()).slice(0, 320).replace(/\n/g, ' | '))
await page.screenshot({ path: '/tmp/opencode/claude-desk-welcome.png' })

const input = page.getByPlaceholder('给 Claude 发消息…')
await input.waitFor({ state: 'visible', timeout: 15000 })
await input.fill('只回复两个字：你好')
await page.keyboard.press('Enter')

await page.waitForFunction(
  () => {
    const nodes = Array.from(document.querySelectorAll('.message-assistant'))
    return nodes.some((node) => (node.textContent || '').includes('你好'))
  },
  undefined,
  { timeout: 120000 }
)

console.log('assistant:', (await page.locator('.message-assistant').last().innerText()).slice(0, 300).replace(/\n/g, ' | '))
console.log('state:', await page.locator('.topbar').innerText())
await page.screenshot({ path: '/tmp/opencode/claude-desk-chat.png' })

await app.close()
