import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron } from 'playwright-core'

const candidates =
  process.platform === 'darwin'
    ? [
        `release/mac-${process.arch}/3PI Desk for Claude Code.app/Contents/MacOS/3PI Desk for Claude Code`,
        'release/mac/3PI Desk for Claude Code.app/Contents/MacOS/3PI Desk for Claude Code'
      ]
    : ['release/linux-unpacked/3pi-desk']

const executablePath = candidates.find((candidate) => existsSync(candidate))
if (!executablePath) {
  console.error(`Packaged app not found. Looked in:\n${candidates.map((p) => `  - ${p}`).join('\n')}`)
  process.exit(1)
}

const app = await electron.launch({
  executablePath,
  args: [],
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
})

const page = await app.firstWindow()
page.on('pageerror', (error) => console.log('[pageerror]', error.message))

await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(1500)
console.log('title:', await page.title())
console.log('body:', (await page.locator('body').innerText()).slice(0, 220).replace(/\n/g, ' | '))
await page.screenshot({ path: join(tmpdir(), 'claude-desk-packaged.png') })

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
