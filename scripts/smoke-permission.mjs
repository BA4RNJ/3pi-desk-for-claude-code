import { _electron as electron } from 'playwright-core'

const app = await electron.launch({
  args: ['.', '--no-sandbox'],
  cwd: process.cwd(),
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
})

const page = await app.firstWindow()
page.on('pageerror', (error) => console.log('[pageerror]', error.message))

await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(1200)

await page.getByRole('button', { name: '新建对话' }).click()
await page.waitForTimeout(500)

const input = page.getByPlaceholder('给 Claude 发消息…')
await input.fill('请创建 /tmp/claude-desk-test/proof.txt，内容为 ok，然后只回复 done')
await page.keyboard.press('Enter')

const dialog = page.locator('.permission-dialog')
await dialog.waitFor({ state: 'visible', timeout: 120000 })
console.log('dialog:', (await dialog.innerText()).replace(/\n/g, ' | ').slice(0, 500))
await page.screenshot({ path: '/tmp/opencode/claude-desk-permission.png' })

await page.getByRole('button', { name: '允许一次' }).click()

await page.waitForFunction(
  () => {
    const cards = Array.from(document.querySelectorAll('.tool-card'))
    return cards.some((card) => card.classList.contains('tool-done'))
  },
  undefined,
  { timeout: 120000 }
)

console.log('chat:', (await page.locator('.chat-inner').innerText()).slice(0, 1200).replace(/\n/g, ' | '))
await page.screenshot({ path: '/tmp/opencode/claude-desk-permission-done.png' })

await app.close()
