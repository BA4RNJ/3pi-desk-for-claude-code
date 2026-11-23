/**
 * Measure real end-to-end turn latency in an isolated app instance.
 * Copies the real ~/.claude/settings.json into a temporary CLAUDE_CONFIG_DIR,
 * starts a throw-away workspace, and sends one tiny prompt over the remote
 * WebSocket. The temporary directory (including the copied credentials) is
 * deleted in `finally`.
 *
 *   node scripts/remote-latency.mjs
 */
import { _electron as electron } from 'playwright-core'
import { promises as fs } from 'node:fs'
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { WebSocket } from 'ws'
import { hashPassword } from '../src/main/remote-auth.ts'

const root = '/tmp/3pi-latency'
const port = 37996
const username = 'latency-tester'
const password = 'latency-test-password'

await fs.rm(root, { recursive: true, force: true })
const home = join(root, 'home')
const config = join(root, 'config')
const userData = join(root, 'userData')
const workspace = join(home, 'workspace')
const claudeDir = join(root, 'claude')
for (const dir of [home, workspace, config, userData, claudeDir, join(config, 'claude-desk')]) {
  mkdirSync(dir, { recursive: true })
}

// Use the real provider credentials for this isolated run. The file is 0600
// and lives under /tmp for the duration of the test only.
copyFileSync(join(homedir(), '.claude', 'settings.json'), join(claudeDir, 'settings.json'))

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
  args: ['.', '--no-sandbox', `--user-data-dir=${userData}`],
  cwd: process.cwd(),
  env: {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: config,
    CLAUDE_CONFIG_DIR: claudeDir,
    ELECTRON_ENABLE_LOGGING: '1'
  }
})

function waitMessage(socket, predicate = () => true, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), timeoutMs)
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
  if (!healthy) throw new Error('remote server did not start')

  const socket = await openSocket(`ws://127.0.0.1:${port}/ws`)
  socket.send(
    JSON.stringify({ v: 1, type: 'login', username, password })
  )
  await waitMessage(socket, (message) => message.type === 'ready')

  let nextId = 0
  const call = (method, args = []) => {
    const id = `c${++nextId}`
    socket.send(JSON.stringify({ v: 1, id, method, args }))
    return waitMessage(socket, (message) => message.id === id)
  }

  const settingsResponse = await call('settings:get')
  const model = settingsResponse.result.api.model
  console.log('model:', model)

  const tabId = `latency-${Date.now()}`
  await call('tabs:create', [{ id: tabId, cwd: workspace, title: '延迟测试' }])

  const startAt = Date.now()
  const startResponse = await call('session:start', [
    tabId,
    { cwd: workspace, model }
  ])
  if (startResponse.error) throw new Error(startResponse.error.message)
  console.log('session:start:', Date.now() - startAt, 'ms')

  const events = []
  let sendAt = 0
  let initAt = 0
  let streamStartAt = 0
  let firstDeltaAt = 0
  let firstAssistantAt = 0
  let resultAt = 0

  const onEvent = (data) => {
    const message = JSON.parse(data.toString())
    if (message.event !== 'session:event') return
    if (message.data?.tabId !== tabId) return
    const event = message.data.message
    const now = Date.now()
    if (event.type === 'system' && event.subtype === 'init' && !initAt) {
      initAt = now
      console.log('system/init:', now - sendAt, 'ms after send')
    }
    if (event.type === 'stream_event' && event.event?.type === 'message_start' && !streamStartAt) {
      streamStartAt = now
      console.log('stream message_start:', now - sendAt, 'ms after send')
    }
    if (
      event.type === 'stream_event' &&
      event.event?.type === 'content_block_delta' &&
      !firstDeltaAt
    ) {
      firstDeltaAt = now
      console.log('first content delta:', now - sendAt, 'ms after send')
    }
    if (event.type === 'assistant' && !firstAssistantAt) {
      const blocks = event.message?.content
      const hasText =
        Array.isArray(blocks) &&
        blocks.some((block) => block?.type === 'text' && String(block.text || '').trim())
      if (hasText) {
        firstAssistantAt = now
        console.log('first assistant text:', now - sendAt, 'ms after send')
      }
    }
    if (event.type === 'result' && !resultAt) {
      resultAt = now
      console.log('result:', now - sendAt, 'ms after send')
      console.log('usage:', JSON.stringify(event.usage || {}))
      socket.off('message', onEvent)
      socket.close()
    }
  }
  socket.on('message', onEvent)

  sendAt = Date.now()
  const sendResponse = await call('session:send', [
    tabId,
    { text: '只回复两个字：你好', uuid: `latency-${sendAt}` }
  ])
  if (sendResponse.error) throw new Error(sendResponse.error.message)

  const deadline = Date.now() + 120000
  while (!resultAt && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  if (!resultAt) throw new Error('no result within 120s')
  console.log('total:', resultAt - sendAt, 'ms')
  console.log(
    'breakdown:',
    JSON.stringify({
      init: initAt ? initAt - sendAt : null,
      streamStart: streamStartAt ? streamStartAt - sendAt : null,
      firstDelta: firstDeltaAt ? firstDeltaAt - sendAt : null,
      firstAssistant: firstAssistantAt ? firstAssistantAt - sendAt : null,
      result: resultAt ? resultAt - sendAt : null
    })
  )
} finally {
  await app.close()
  await fs.rm(root, { recursive: true, force: true })
}
