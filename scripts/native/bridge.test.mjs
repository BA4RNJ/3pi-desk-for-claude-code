import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { once } from 'node:events'
import { serve } from '../../packages/agent-bridge/protocol.mjs'

test('protocol serializes each tab, routes events, rejects invalid requests and stops on EOF', async () => {
  const input = new PassThrough(), output = new PassThrough()
  let buffer = '', stopped = 0
  const calls = []
  output.on('data', chunk => { buffer += chunk })
  const shutdown = serve({ input, output, createSession: callbacks => ({
    async start() { await new Promise(resolve => setTimeout(resolve, 10)); calls.push('start'); callbacks.emitState({ running: false }); return {} },
    async send({ text }) { calls.push(text) }, async interrupt() {}, respondPermission() {}, async stop() { stopped++ }
  }) })
  for (const request of [
    {version: 1, id: '1', method: 'start', tabId: 'a', params: {cwd: '/tmp'}},
    {version: 1, id: '2', method: 'send', tabId: 'a', params: {text: 'hello'}},
    {version: 1, id: '3', method: 'bad', tabId: 'a'}
  ]) input.write(JSON.stringify(request) + '\n')
  input.end()
  await once(input, 'end')
  await shutdown()
  const messages = buffer.trim().split('\n').map(JSON.parse)
  assert.deepEqual(calls, ['start', 'hello'])
  assert.equal(stopped, 1)
  assert.ok(messages.some(message => message.event === 'state' && message.tabId === 'a'))
  assert.equal(messages.find(message => message.id === '3').error, 'Unknown method')
})


test('bridge forwards attachment payloads and turn UUIDs and shuts down once', async () => {
  const input = new PassThrough(), output = new PassThrough()
  let received, stops = 0, cancellations = 0
  const shutdown = serve({ input, output, onShutdown: () => { cancellations++ }, createSession: () => ({ async start() {}, async send(payload) { received = payload }, async stop() { stops++ } }) })
  const payload = { text: 'image fixture', uuid: 'turn-fixture', attachments: [{ kind: 'image', name: 'fixture.png', mediaType: 'image/png', data: 'a'.repeat(1100000) }] }
  input.write(JSON.stringify({ version: 1, id: 'start', method: 'start', tabId: 'b', params: { cwd: '/tmp' } }) + '\n')
  input.write(JSON.stringify({ version: 1, id: 'send', method: 'send', tabId: 'b', params: payload }) + '\n')
  await shutdown()
  await shutdown()
  assert.deepEqual(received, payload)
  assert.equal(stops, 1)
  assert.equal(cancellations, 1)
})

test('long service reads do not block settings or cancellation', async () => {
  const input = new PassThrough(), output = new PassThrough(), order = []
  const shutdown = serve({ input, output, createSession: () => {}, service: async method => {
    if (method === 'extensions:marketplaces') await new Promise(resolve => setTimeout(resolve, 30))
    order.push(method); return null
  } })
  for (const method of ['extensions:marketplaces', 'settings:get', 'extensions:cancelPluginAction']) {
    input.write(JSON.stringify({ version: 1, id: method, method, tabId: 'same-tab' }) + '\n')
  }
  input.end()
  await once(input, 'end')
  await shutdown()
  assert.equal(order.at(-1), 'extensions:marketplaces')
  assert.ok(order.indexOf('extensions:cancelPluginAction') < order.indexOf('extensions:marketplaces'))
})
