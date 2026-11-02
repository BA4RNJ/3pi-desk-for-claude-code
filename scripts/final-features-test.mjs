import { readFileSync } from 'node:fs'
import { _electron as electron } from 'playwright-core'

const testDir = '/tmp/claude-desk-final-test'
const app = await electron.launch({ args: ['.', '--no-sandbox'], cwd: process.cwd(), env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' } })
const page = await app.firstWindow()
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
await page.waitForLoadState('domcontentloaded')
await page.locator('.tabbar').waitFor({ state: 'visible', timeout: 20000 })

const original = await page.evaluate(() => window.desk.getDefaults())
await page.evaluate((cwd) => window.desk.saveCwd(cwd), testDir)
await page.reload()
await page.locator('.tabbar').waitFor({ state: 'visible', timeout: 20000 })

// File panel + preview/edit
await page.locator('.topbar-icon').click()
await page.locator('.file-panel').waitFor({ state: 'visible' })
await page.locator('.file-file').filter({ hasText: 'README.md' }).click()
await page.locator('.file-preview-dialog').waitFor({ state: 'visible', timeout: 10000 })
const editor = page.locator('.file-text-editor')
const before = await editor.inputValue()
await editor.fill(before + '\nEdited by test.\n')
await page.locator('.file-preview-dialog').getByRole('button', { name: '保存文件' }).click()
await page.locator('.settings-message').filter({ hasText: '已保存' }).waitFor({ state: 'visible', timeout: 10000 })
console.log('file edit saved:', readFileSync(`${testDir}/README.md`, 'utf8').includes('Edited by test.'))
await page.locator('.file-preview-dialog .dialog-close').click()
await page.locator('.file-panel .icon-button').last().click()

// First chat
const input = page.getByPlaceholder(/给 Claude 发消息/)
await input.fill('只回复 FIRST')
await page.keyboard.press('Enter')
await page.waitForFunction(() => {
  const nodes = Array.from(document.querySelectorAll('.message-assistant'))
  return nodes.some(n => (n.textContent || '').includes('FIRST'))
}, undefined, { timeout: 180000 })
await page.waitForFunction(() => !document.querySelector('.working-chip'), undefined, { timeout: 180000 })

// Edit and resend the first user message
const userMessage = page.locator('.message-user').first()
await userMessage.hover()
await userMessage.locator('.message-actions').getByRole('button', { name: '编辑' }).click()
await page.locator('.edit-message-dialog').waitFor({ state: 'visible' })
await page.locator('.edit-message-dialog textarea').fill('只回复 EDITED')
await page.locator('.edit-message-dialog').getByRole('button', { name: '重发' }).click()
await page.waitForFunction(() => {
  const nodes = Array.from(document.querySelectorAll('.message-assistant'))
  return nodes.some(n => (n.textContent || '').includes('EDITED'))
}, undefined, { timeout: 180000 })
console.log('edit/resend worked, tabs:', await page.locator('.tab').count())

// Tag, pin, search
const firstSession = page.locator('.session-item').first()
await firstSession.hover()
await firstSession.locator('.session-more').click()
await page.locator('.session-menu').getByRole('button', { name: '设置标签' }).click()
await page.locator('.rename-dialog input').fill('test-tag')
await page.locator('.rename-dialog').getByRole('button', { name: '保存标签' }).click()
await page.waitForTimeout(800)
console.log('tagged:', (await page.locator('.session-item').first().innerText()).includes('test-tag'))
const session2 = page.locator('.session-item').first()
await session2.hover()
await session2.locator('.session-more').click()
await page.locator('.session-menu').getByRole('button', { name: '置顶会话' }).click()
await page.waitForTimeout(500)
console.log('pinned:', await page.locator('.pin-icon').count())
await page.locator('.session-search input').fill('EDITED')
await page.waitForTimeout(1200)
console.log('search results:', await page.locator('.session-item').count())

// Visual customization
await page.getByRole('button', { name: '设置' }).click()
await page.locator('.settings-shell').waitFor({ state: 'visible' })
await page.locator('.accent-blue').click()
await page.locator('.toggle-row').filter({ hasText: '紧凑模式' }).locator('input').check()
await page.locator('.segmented').filter({ hasText: '特大' }).getByRole('button', { name: '特大' }).click()
await page.getByRole('button', { name: '保存偏好' }).click()
await page.waitForTimeout(600)
const appearance = await page.evaluate(() => ({
  accent: document.documentElement.dataset.accent,
  compact: document.documentElement.dataset.compact,
  scale: document.documentElement.style.getPropertyValue('--ui-scale')
}))
console.log('appearance:', appearance)

// About panel
await page.locator('.settings-nav').getByRole('button', { name: '关于' }).click()
await page.waitForTimeout(4000)
console.log('about:', (await page.locator('.about-panel').innerText()).slice(0, 300).replace(/\n/g, ' | '))
await page.screenshot({ path: '/tmp/opencode/ui-final-features.png' })
await page.locator('.settings-content .dialog-close').click()

console.log('errors:', errors)
await page.evaluate((cwd) => window.desk.saveCwd(cwd), original.cwd)
await app.close()
