/**
 * Manual Cloudflare Tunnel transport test (no Electron window). Starts the
 * same RemoteServer used by the app on a local port, exposes it through a
 * quick tunnel, then verifies HTTPS + WSS + login + RPC through the public URL.
 *
 *   node scripts/remote-cloudflare-ws.mjs
 */
import { join } from 'node:path'
import { WebSocket } from 'ws'
import { RemoteServer } from '../src/main/remote-server.ts'
import { RemoteAuth, hashPassword } from '../src/main/remote-auth.ts'
import { TunnelManager } from '../src/main/tunnel.ts'

const port = 37998
const username = 'cloudflare-tester'
const password = 'cloudflare-test-password'

const { salt, hash } = hashPassword(password)
const auth = new RemoteAuth(() => ({ username, salt, hash }))
const server = new RemoteServer({
  hub: {
    registerClient() {},
    unregisterClient() {},
    listTabs() {
      return []
    },
    listTabsWithLive() {
      return []
    },
    async request(method, args) {
      if (method === 'defaults:get') {
        return {
          cwd: '/tmp',
          home: '/tmp',
          platform: 'linux',
          appVersion: 'test',
          wsl: false
        }
      }
      return { method, args }
    }
  },
  auth,
  staticRoot: join(process.cwd(), 'out/renderer'),
  getDefaults: () => ({
    cwd: '/tmp',
    home: '/tmp',
    platform: 'linux',
    appVersion: 'test',
    wsl: false
  }),
  getSettings: () => ({}),
  getRemoteStatus: () => ({ running: true, lanUrls: [], clients: 0 }),
  getClaudeCliStatus: () => null
})

function waitMessage(socket, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for message')), 20000)
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

const tunnel = new TunnelManager(() => {}, '/tmp/3pi-cloudflared-test')
if (!(await tunnel.detect())) {
  const downloaded = await tunnel.download()
  if (!downloaded.available) throw new Error(downloaded.error || 'cloudflared download failed')
}

await server.start(port, 'localhost')
let publicUrl = ''
try {
  await tunnel.startQuick(port)
  for (let attempt = 0; attempt < 120; attempt += 1) {
    publicUrl = tunnel.getStatus().url || ''
    if (publicUrl) break
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  if (!publicUrl) throw new Error('cloudflared did not report a public URL')
  console.log('public url:', publicUrl)

  let healthy = false
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${publicUrl}/healthz`)
      if (response.ok) {
        healthy = true
        console.log('public health ok after', attempt + 1, 's')
        break
      }
    } catch {
      // DNS record is created asynchronously
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  if (!healthy) throw new Error('public health check did not succeed')

  const shell = await fetch(`${publicUrl}/`)
  const html = await shell.text()
  console.log('shell status:', shell.status, 'has root:', html.includes('<div id="root">'))

  const wsUrl = publicUrl.replace(/^https:/, 'wss:') + '/ws'
  const socket = await openSocket(wsUrl)
  socket.send(
    JSON.stringify({ v: 1, type: 'login', username, password })
  )
  const ready = await waitMessage(socket, (message) => message.type === 'ready')
  console.log('wss ready:', ready.runtime, 'token:', Boolean(ready.token))

  socket.send(JSON.stringify({ v: 1, id: 'cf1', method: 'defaults:get', args: [] }))
  const response = await waitMessage(socket, (message) => message.id === 'cf1')
  console.log('wss rpc platform:', response.result.platform)

  socket.close()
  console.log('cloudflare websocket test passed')
} finally {
  await tunnel.stop()
  await server.stop()
}
