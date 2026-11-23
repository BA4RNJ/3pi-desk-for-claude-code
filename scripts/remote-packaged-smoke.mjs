/**
 * Verify the packaged binary serves the web UI from app.asar and accepts a
 * login. Uses a temporary HOME/userData; never touches the real app data.
 *
 *   node scripts/remote-packaged-smoke.mjs
 */
import { _electron as electron } from 'playwright-core'
import { promises as fs } from 'node:fs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { WebSocket } from 'ws'
import { hashPassword } from '../src/main/remote-auth.ts'

const root = '/tmp/3pi-packaged-smoke'
const port = 37997
const username = 'packaged-tester'
const password = 'packaged-test-password'
const executablePath =
  process.env.THREE_PI_BIN || join(homedir(), '.local', 'opt', '3pi-desk', '3pi-desk')

await fs.rm(root, { recursive: true, force: true })
const home = join(root, 'home')
const config = join(root, 'config')
const userData = join(root, 'userData')
const workspace = join(root, 'workspace')
for (const dir of [home, config, userData, workspace, join(config, 'claude-desk')]) {
  mkdirSync(dir, { recursive: true })
}
const { salt, hash } = hashPassword(password)
const settings = {
  cwd: workspace,
  preferences: { recentWorkspaces: [workspace], closeToTray: false },
  remote: {
    enabled: true,
    port,
    bind: 'lan',
    username,
    passwordSalt: salt,
    passwordHash: hash,
    allowedRoots: [home, workspace]
  }
}
for (const path of [
  join(userData, 'settings.json'),
  join(config, 'claude-desk', 'settings.json')
]) {
  writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 })
}

function waitMessage(socket, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), 10000)
    const onMessage = (data) => {
      const message = JSON.parse(data.toString())
      if (!predicate(message)) return
      clearTimeout(timer)
      socket.off('message', onMessage)
      resolve(message)
    }
    socket.on('message', onMessage)
  })
}

function openSocket(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
  })
}

const app = await electron.launch({
  executablePath,
  args: ['--no-sandbox', `--user-data-dir=${userData}`],
  env: {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: config,
    CLAUDE_CONFIG_DIR: join(root, 'claude'),
    ELECTRON_ENABLE_LOGGING: '1'
  }
})

try {
  await app.firstWindow()
  let healthy = false
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`)
      if (response.ok) {
        healthy = true
        break
      }
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  if (!healthy) throw new Error('packaged remote server did not start')

  const shell = await fetch(`http://127.0.0.1:${port}/`)
  const html = await shell.text()
  console.log('packaged shell:', shell.status, 'root:', html.includes('<div id="root">'))
  const asset = html.match(/src="\.\/assets\/([^"]+\.js)"/)?.[1]
  if (!asset) throw new Error('built index.html has no JS asset')
  const assetResponse = await fetch(`http://127.0.0.1:${port}/assets/${asset}`)
  console.log('packaged asset:', assetResponse.status, assetResponse.headers.get('content-type'))

  const socket = await openSocket(`ws://127.0.0.1:${port}/ws`)
  socket.send(JSON.stringify({ v: 1, type: 'login', username, password }))
  const ready = await waitMessage(socket, (message) => message.type === 'ready')
  console.log('packaged login:', ready.runtime, Boolean(ready.token))
  socket.send(JSON.stringify({ v: 1, id: 'p1', method: 'tabs:list', args: [] }))
  const response = await waitMessage(socket, (message) => message.id === 'p1')
  console.log('packaged tabs:', Array.isArray(response.result), response.result.length)
  socket.close()
  console.log('packaged smoke test passed')
} finally {
  await app.close()
  await fs.rm(root, { recursive: true, force: true })
}
