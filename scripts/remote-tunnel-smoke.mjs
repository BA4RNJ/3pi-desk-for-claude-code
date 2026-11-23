/**
 * End-to-end test of the app-managed Cloudflare Quick Tunnel.
 * Launches the installed packaged app with isolated data, starts the tunnel
 * through the real IPC handler, then verifies HTTPS + WSS login through the
 * public trycloudflare.com URL. Stops the tunnel and app afterwards.
 */
import { _electron as electron } from 'playwright-core'
import { promises as fs } from 'node:fs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { WebSocket } from 'ws'
import { hashPassword } from '../src/main/remote-auth.ts'

const root = '/tmp/3pi-tunnel-smoke'
const port = 37993
const username = 'tunnel-tester'
const password = 'tunnel-test-password'
const cloudflared =
  process.env.CLOUDFLARED_PATH ||
  join(homedir(), '.config', 'claude-desk', 'cloudflared', 'cloudflared')
const executablePath =
  process.env.THREE_PI_BIN || join(homedir(), '.local', 'opt', '3pi-desk', '3pi-desk')

await fs.rm(root, { recursive: true, force: true })
const home = join(root, 'home')
const config = join(root, 'config')
const userData = join(root, 'userData')
const workspace = join(home, 'workspace')
for (const dir of [home, workspace, config, userData, join(config, 'claude-desk')]) {
  mkdirSync(dir, { recursive: true })
}
const { salt, hash } = hashPassword(password)
const settings = {
  cwd: workspace,
  preferences: { recentWorkspaces: [workspace], closeToTray: false },
  remote: {
    enabled: true,
    port,
    bind: 'localhost',
    username,
    passwordSalt: salt,
    passwordHash: hash,
    allowedRoots: [home]
  }
}
for (const path of [
  join(userData, 'settings.json'),
  join(config, 'claude-desk', 'settings.json')
]) {
  writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 })
}

const app = await electron.launch({
  executablePath,
  args: ['--no-sandbox', `--user-data-dir=${userData}`],
  env: {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: config,
    CLAUDE_CONFIG_DIR: join(root, 'claude'),
    CLOUDFLARED_PATH: cloudflared,
    ELECTRON_ENABLE_LOGGING: '1'
  }
})

function waitMessage(socket, predicate = () => true, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for websocket message')), timeoutMs)
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

try {
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(1200)

  let healthy = false
  for (let attempt = 0; attempt < 40; attempt += 1) {
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
  if (!healthy) throw new Error('local remote server did not start')
  console.log('local server ready')

  const started = await page.evaluate(() => window.desk.startTunnel('quick'))
  console.log('startTunnel:', JSON.stringify(started))

  let publicUrl = ''
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const remote = await page.evaluate(() => window.desk.getRemoteSettings())
    publicUrl = remote.tunnel?.url || ''
    if (publicUrl) break
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  if (!publicUrl) throw new Error('app did not receive a tunnel URL')
  console.log('public url:', publicUrl)

  let tunnelHealthy = false
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      const response = await fetch(`${publicUrl}/healthz`)
      if (response.ok) {
        tunnelHealthy = true
        console.log('public health ok after', attempt + 1, 's')
        break
      }
    } catch {
      // DNS propagation
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  if (!tunnelHealthy) throw new Error('public tunnel did not become reachable')

  const shell = await fetch(`${publicUrl}/`)
  const html = await shell.text()
  console.log('public shell:', shell.status, 'root:', html.includes('<div id="root">'))

  const socket = await openSocket(publicUrl.replace(/^https:/, 'wss:') + '/ws')
  socket.send(JSON.stringify({ v: 1, type: 'login', username, password }))
  const ready = await waitMessage(socket, (message) => message.type === 'ready')
  console.log('wss login:', ready.runtime, Boolean(ready.token))
  socket.send(JSON.stringify({ v: 1, id: 't1', method: 'tabs:list', args: [] }))
  const response = await waitMessage(socket, (message) => message.id === 't1')
  console.log('wss rpc tabs:', Array.isArray(response.result), response.result.length)
  socket.close()

  const stopped = await page.evaluate(() => window.desk.stopTunnel())
  console.log('stopTunnel:', JSON.stringify(stopped))
  const after = await page.evaluate(() => window.desk.getRemoteSettings())
  console.log('tunnel running after stop:', after.tunnel?.running)
  console.log('cloudflare tunnel smoke test passed')
} finally {
  await app.close()
  await fs.rm(root, { recursive: true, force: true })
}
