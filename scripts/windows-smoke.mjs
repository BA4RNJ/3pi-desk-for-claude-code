import { existsSync } from 'node:fs'
import { _electron as electron } from 'playwright-core'

// Launches the packaged Windows build and captures its first screen. This is a
// smoke check only: it does not start a session, call a provider or spend
// credits. The screenshot is uploaded by the Windows CI job.
const executablePath = 'release/win-unpacked/3pi-desk.exe'
if (!existsSync(executablePath)) {
  throw new Error(`Packaged executable not found: ${executablePath}`)
}

const app = await electron.launch({
  executablePath,
  args: ['--disable-gpu'],
  timeout: 60_000
})

try {
  const window = await app.firstWindow({ timeout: 60_000 })
  await window.waitForLoadState('domcontentloaded')
  await window.locator('#root').waitFor({ state: 'attached', timeout: 30_000 })
  // Give React a moment to paint the first screen before capturing it.
  await window.waitForTimeout(3_000)
  const title = await window.title()
  const text = (await window.locator('body').innerText()).trim()
  if (!text) throw new Error('Renderer produced an empty window')
  await window.screenshot({ path: 'release/windows-smoke.png' })
  console.log(`Windows smoke test passed: ${title}`)
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => undefined)
  await app.close().catch(() => undefined)
}
