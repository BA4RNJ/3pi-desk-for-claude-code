import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { WebSocket } from 'ws'
import { RemoteServer } from '../src/main/remote-server.ts'
import { RemoteAuth, hashPassword } from '../src/main/remote-auth.ts'

function stubHub() {
  return {
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
      if (method === 'settings:get') {
        return {
          api: { baseUrl: '', model: '', tokenMasked: '', hasToken: false },
          preferences: {},
          permissionRules: {},
          profiles: [],
          customModels: [],
          webSearch: {}
        }
      }
      return { method, args }
    }
  }
}

function waitMessage(socket, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for message')), 5000)
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

test('remote server serves the web shell and authenticates websocket clients', async () => {
  const { salt, hash } = hashPassword('correct horse')
  const auth = new RemoteAuth(() => ({ username: 'tester', salt, hash }))
  const server = new RemoteServer({
    hub: stubHub(),
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

  const status = await server.start(0, 'localhost')
  assert.ok(status.running)
  assert.ok(status.port > 0)

  const health = await fetch(`http://127.0.0.1:${status.port}/healthz`)
  assert.equal(health.status, 200)
  assert.equal((await health.json()).ok, true)

  const shell = await fetch(`http://127.0.0.1:${status.port}/`)
  assert.equal(shell.status, 200)
  assert.match(await shell.text(), /<div id="root">/)

  const socket = await openSocket(`ws://127.0.0.1:${status.port}/ws`)

  // An unauthenticated request must not reach the hub.
  socket.send(JSON.stringify({ v: 1, id: 'x', method: 'defaults:get', args: [] }))
  const rejected = await waitMessage(socket)
  assert.equal(rejected.type, 'error')
  assert.equal(rejected.error.code, 'unauthorized')

  socket.send(
    JSON.stringify({ v: 1, type: 'login', username: 'tester', password: 'wrong' })
  )
  const badLogin = await waitMessage(socket, (message) => message.type === 'error')
  assert.equal(badLogin.error.code, 'unauthorized')
  socket.close()

  const socket2 = await openSocket(`ws://127.0.0.1:${status.port}/ws`)
  socket2.send(
    JSON.stringify({ v: 1, type: 'login', username: 'tester', password: 'correct horse' })
  )
  const ready = await waitMessage(socket2, (message) => message.type === 'ready')
  assert.equal(ready.runtime, 'web')
  assert.ok(ready.token)
  assert.equal(ready.snapshot.defaults.runtime, 'web')

  socket2.send(
    JSON.stringify({ v: 1, id: 'r1', method: 'defaults:get', args: [] })
  )
  const response = await waitMessage(socket2, (message) => message.id === 'r1')
  assert.equal(response.result.platform, 'linux')
  socket2.close()

  // One-time QR pairing token login and single-use check
  const pairing = auth.createPairingToken()
  assert.ok(pairing.code)
  const socket3 = await openSocket(`ws://127.0.0.1:${status.port}/ws`)
  socket3.send(JSON.stringify({ v: 1, type: 'pair', code: pairing.code }))
  const pairReady = await waitMessage(socket3, (message) => message.type === 'ready')
  assert.equal(pairReady.runtime, 'web')
  assert.ok(pairReady.token)
  socket3.close()

  // Re-using the same pairing code must fail
  const socket4 = await openSocket(`ws://127.0.0.1:${status.port}/ws`)
  socket4.send(JSON.stringify({ v: 1, type: 'pair', code: pairing.code }))
  const pairReuse = await waitMessage(socket4, (message) => message.type === 'error')
  assert.equal(pairReuse.error.code, 'unauthorized')
  socket4.close()

  await server.stop()
})
