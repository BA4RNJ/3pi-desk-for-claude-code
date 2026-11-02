import { existsSync } from 'node:fs'
import { _electron as electron } from 'playwright-core'

const testDir = '/tmp/claude-desk-rewind-test'
const target = `${testDir}/hello.txt`
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
await input.fill('请在当前目录创建 hello.txt，内容为 hello，然后只回复 done')
await page.keyboard.press('Enter')

const dialog = page.locator('.permission-dialog')
try {
  await dialog.waitFor({ state: 'visible', timeout: 45000 })
  await page.getByRole('button', { name: '允许一次' }).click()
  console.log('permission: allowed')
} catch {
  console.log('permission: no dialog (auto-approved)')
}

await page.waitForFunction(
  () => {
    const cards = Array.from(document.querySelectorAll('.tool-card'))
    return cards.some((card) => card.classList.contains('tool-done'))
  },
  undefined,
  { timeout: 180000 }
)
await page.waitForFunction(() => !document.querySelector('.working-chip'), undefined, {
  timeout: 180000
})
console.log('file exists after edit:', existsSync(target))

const userMessage = page.locator('.message-user').first()
await userMessage.hover()
const rewindButton = userMessage.locator('.rewind-button')
console.log('rewind button:', await rewindButton.count())
if ((await rewindButton.count()) === 0) {
  console.log('FAIL: no rewind button')
  await page.evaluate((cwd) => window.desk.saveCwd(cwd), original.cwd)
  await app.close()
  process.exit(1)
}

await rewindButton.click()
await page.locator('.rewind-dialog').waitFor({ state: 'visible', timeout: 20000 })
await page.waitForTimeout(1500)
console.log('preview:', (await page.locator('.rewind-dialog').innerText()).slice(0, 400).replace(/\n/g, ' | '))
await page.screenshot({ path: '/tmp/opencode/ui-rewind.png' })

await page.locator('.rewind-dialog').getByRole('button', { name: '恢复文件' }).click()
await page.locator('.rewind-dialog').waitFor({ state: 'hidden', timeout: 30000 })
await page.waitForTimeout(1000)
console.log('file exists after rewind:', existsSync(target))
console.log('notices:', (await page.locator('.notice').allInnerTexts()).join(' | '))
await page.screenshot({ path: '/tmp/opencode/ui-rewind-done.png' })

await page.evaluate((cwd) => window.desk.saveCwd(cwd), original.cwd)
await app.close()
