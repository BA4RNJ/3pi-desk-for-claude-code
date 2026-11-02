import { _electron as electron } from 'playwright-core'

const app = await electron.launch({
  executablePath: 'release/linux-unpacked/3pi-desk',
  args: [],
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
})

const page = await app.firstWindow()
page.on('pageerror', (error) => console.log('[pageerror]', error.message))

await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(1500)
console.log('title:', await page.title())
console.log('body:', (await page.locator('body').innerText()).slice(0, 220).replace(/\n/g, ' | '))
await page.screenshot({ path: '/tmp/opencode/claude-desk-packaged.png' })

await page.getByRole('button', { name: '新建对话' }).click()
const input = page.getByPlaceholder('给 Claude 发消息…')
await input.fill('只回复 OK')
await page.keyboard.press('Enter')

await page.waitForFunction(
  () => {
    const nodes = Array.from(document.querySelectorAll('.message-assistant'))
    return nodes.some((node) => (node.textContent || '').includes('OK'))
  },
  undefined,
  { timeout: 120000 }
)

console.log('reply:', (await page.locator('.message-assistant').last().innerText()).slice(0, 200).replace(/\n/g, ' | '))
await app.close()
