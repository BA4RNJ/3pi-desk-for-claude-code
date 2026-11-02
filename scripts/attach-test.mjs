import { _electron as electron } from 'playwright-core'

const testDir = '/tmp/claude-desk-attach-test'
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
await input.click()
await input.type('@alp')
await page.locator('.mention-menu').waitFor({ state: 'visible', timeout: 10000 })
console.log('mention:', (await page.locator('.mention-menu').innerText()).replace(/\n/g, ' | '))
await page.keyboard.press('Enter')
console.log('composer value:', await input.inputValue())
await input.fill('')

const dataTransfer = await page.evaluateHandle(() => {
  const png = Uint8Array.from(
    atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lK3Q6wAAAABJRU5ErkJggg=='),
    (c) => c.charCodeAt(0)
  )
  const transfer = new DataTransfer()
  transfer.items.add(new File(['附件内容'], 'note.txt', { type: 'text/plain' }))
  transfer.items.add(new File([png], 'red.png', { type: 'image/png' }))
  return transfer
})
await page.locator('.chat-wrap').dispatchEvent('drop', { dataTransfer })
await page.locator('.attachment-chip').first().waitFor({ state: 'visible', timeout: 10000 })
console.log('attachments:', await page.locator('.attachment-chip').count())
await page.screenshot({ path: '/tmp/opencode/ui-attachments.png' })

await input.fill('只回复 OK，不要描述附件')
await page.keyboard.press('Enter')

await page.waitForFunction(
  () => {
    const nodes = Array.from(document.querySelectorAll('.message-assistant'))
    return nodes.some((node) => (node.textContent || '').includes('OK'))
  },
  undefined,
  { timeout: 180000 }
)

console.log('user chips:', await page.locator('.user-file-chip').count())
console.log('user images:', await page.locator('.user-image').count())
console.log('reply:', (await page.locator('.message-assistant').last().innerText()).slice(0, 200).replace(/\n/g, ' | '))
await page.screenshot({ path: '/tmp/opencode/ui-attachments-sent.png' })

await page.evaluate((cwd) => window.desk.saveCwd(cwd), original.cwd)
await app.close()
