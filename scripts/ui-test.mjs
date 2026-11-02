import { _electron as electron } from 'playwright-core'

const app = await electron.launch({
  args: ['.', '--no-sandbox'],
  cwd: process.cwd(),
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
})
const page = await app.firstWindow()
page.on('pageerror', (error) => console.log('[pageerror]', error.message))
page.on('console', (message) => {
  if (message.type() === 'error') console.log('[console]', message.text())
})

await page.waitForLoadState('domcontentloaded')
await page.locator('.tabbar').waitFor({ state: 'visible', timeout: 20000 })
console.log('tabs:', await page.locator('.tab').count())

await page.getByRole('button', { name: '设置' }).click()
await page.locator('.settings-shell').waitFor({ state: 'visible' })
await page.screenshot({ path: '/tmp/opencode/ui-general.png' })

await page.locator('.settings-nav').getByRole('button', { name: 'API' }).click()
await page.waitForTimeout(300)
await page.screenshot({ path: '/tmp/opencode/ui-api.png' })
console.log('api fields:', (await page.locator('.settings-page').innerText()).slice(0, 200).replace(/\n/g, ' | '))

await page.locator('.settings-nav').getByRole('button', { name: '扩展' }).click()
await page.waitForTimeout(1200)
await page.screenshot({ path: '/tmp/opencode/ui-extensions.png' })
console.log('extensions:', (await page.locator('.extensions-panel').innerText()).slice(0, 400).replace(/\n/g, ' | '))

await page.locator('.settings-nav').getByRole('button', { name: '用量' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: '/tmp/opencode/ui-usage.png' })
console.log('usage:', (await page.locator('.usage-panel').innerText()).slice(0, 300).replace(/\n/g, ' | '))

await page.locator('.settings-content .dialog-close').click()
await page.waitForTimeout(300)

const modelChip = page.locator('.topbar .dropdown .chip').filter({ hasText: 'DeepSeek' }).first()
await modelChip.click()
await page.screenshot({ path: '/tmp/opencode/ui-models.png' })
const modelCount = await page.locator('.topbar .dropdown-menu .model-item').count()
console.log('model options:', modelCount)
await page.locator('.topbar .dropdown-menu .model-item').filter({ hasText: 'DeepSeek V4 Pro' }).click()
await page.waitForTimeout(500)
console.log('model chip:', (await modelChip.innerText()).replace(/\n/g, ' '))
await modelChip.click()
await page.locator('.topbar .dropdown-menu .model-item').filter({ hasText: 'DeepSeek V4.1 Flash' }).click()
await page.waitForTimeout(500)

const effortChip = page.locator('.topbar .chip').filter({ hasText: '强度' }).first()
if (await effortChip.isVisible()) {
  await effortChip.click()
  await page.screenshot({ path: '/tmp/opencode/ui-effort.png' })
  console.log('effort options:', await page.locator('.topbar .dropdown-menu .dropdown-item').count())
  await page.locator('.topbar .dropdown-menu .dropdown-item').filter({ hasText: '高' }).first().click()
  await page.waitForTimeout(600)
  console.log('effort chip:', (await effortChip.innerText()).replace(/\n/g, ' '))
}

const before = await page.locator('.tab').count()
await page.getByRole('button', { name: '新建对话' }).click()
await page.waitForTimeout(400)
const after = await page.locator('.tab').count()
console.log('new tab:', before, '->', after)
await page.locator('.tab.is-active .tab-close').click()
await page.waitForTimeout(300)
console.log('after close:', await page.locator('.tab').count())

await page.screenshot({ path: '/tmp/opencode/ui-final.png' })
await app.close()
