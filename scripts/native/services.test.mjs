import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

// Exercises the actual bundled adapter against disposable data, with no provider calls.
test('native adapter reuses settings and file APIs without Electron or user configuration', async () => {
  const root = await mkdtemp(join(tmpdir(), '3pi-native-services-'))
  const config = join(root, 'claude'), data = join(root, 'app'), workspace = join(root, 'project')
  await mkdir(config); await mkdir(workspace)
  await writeFile(join(workspace, 'hello.md'), '# temporary fixture')
  const child = spawn(process.execPath, [resolve('.cache/agent-bridge.cjs')], { env: { ...process.env, HOME: root, CLAUDE_CONFIG_DIR: config, DESK_NATIVE_DATA_DIR: data }, stdio: ['pipe', 'pipe', 'pipe'] })
  let buffer = '', next = 0
  const callbacks = new Map()
  child.stdout.on('data', chunk => {
    buffer += chunk
    while (buffer.includes('\n')) {
      const index = buffer.indexOf('\n'), item = JSON.parse(buffer.slice(0, index)); buffer = buffer.slice(index + 1)
      const resolve = callbacks.get(item.id); if (resolve) { callbacks.delete(item.id); resolve(item) }
    }
  })
  function call(method, params = {}) {
    const id = String(++next)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { callbacks.delete(id); reject(new Error('Adapter timeout')) }, 10000)
      callbacks.set(id, item => { clearTimeout(timer); resolve(item) })
      child.stdin.write(JSON.stringify({ version: 1, id, method, tabId: 'fixture', params }) + '\n')
    })
  }
  try {
    assert.equal((await call('settings:get')).result.api.hasToken, false)
    const saved = await call('settings:saveApi', { patch: { baseUrl: 'http://127.0.0.1:1', model: 'fixture-model', token: 'fixture-secret', providerId: 'custom', authMode: 'apiKey' } })
    assert.equal(saved.result.model, 'fixture-model')
    assert.notEqual(saved.result.tokenMasked, 'fixture-secret')
    const stored = JSON.parse(await readFile(join(config, 'settings.json'), 'utf8'))
    assert.equal(stored.env.ANTHROPIC_API_KEY, 'fixture-secret')
    const tree = await call('files:tree', { cwd: workspace })
    assert.equal(tree.result[0].name, 'hello.md')
    const file = await call('files:read', { cwd: workspace, path: 'hello.md' })
    assert.equal(file.result.text, '# temporary fixture')
    assert.ok((await call('files:read', { cwd: workspace, path: join(root, 'outside') })).error)
    assert.ok((await call('sessions:delete', { cwd: workspace, sessionId: '../../outside' })).error)
    assert.equal((await call('providers:list')).result.length, 8)
  } finally {
    child.stdin.end()
    await new Promise(resolve => { child.once('exit', resolve); setTimeout(() => { child.kill(); resolve() }, 2000).unref() })
    await rm(root, { recursive: true, force: true })
  }
})
