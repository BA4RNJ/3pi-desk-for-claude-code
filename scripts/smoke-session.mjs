import { _electron as electron } from 'playwright-core'

const app = await electron.launch({
  args: ['.', '--no-sandbox'],
  cwd: process.cwd(),
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
})

const page = await app.firstWindow()
page.on('pageerror', (error) => console.log('[pageerror]', error.message))

await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(1500)

const firstSession = page.locator('.session-item').first()
await firstSession.waitFor({ state: 'visible', timeout: 15000 })
console.log('session:', (await firstSession.innerText()).replace(/\n/g, ' | '))
await firstSession.click()

await page.waitForFunction(
  () => !document.querySelector('.history-loading') && document.querySelectorAll('.message').length > 0,
  undefined,
  { timeout: 60000 }
)
console.log('history:', (await page.locator('.chat-inner').innerText()).slice(0, 900).replace(/\n/g, ' | '))
await page.screenshot({ path: '/tmp/opencode/claude-desk-history.png' })

const modelChip = page.locator('.topbar .dropdown .chip').first()
await modelChip.click()
await page.getByRole('button', { name: /DeepSeek V4 Pro/ }).click()
await page.waitForTimeout(1200)
console.log('model chip:', (await modelChip.innerText()).replace(/\n/g, ' '))

const input = page.getByPlaceholder('给 Claude 发消息…')
await input.fill('继续，只回复 OK')
await page.keyboard.press('Enter')

await page.waitForFunction(
  () => {
    const nodes = Array.from(document.querySelectorAll('.message-assistant'))
    return nodes.some((node) => (node.textContent || '').includes('OK'))
  },
  undefined,
  { timeout: 120000 }
)

console.log('resumed chat:', (await page.locator('.chat-inner').innerText()).slice(-700).replace(/\n/g, ' | '))
await page.screenshot({ path: '/tmp/opencode/claude-desk-resumed.png' })

await app.close()
