import { createInterface } from 'node:readline'

// One JSON object per line. stdout is reserved exclusively for protocol traffic.
export function serve({ input, output, createSession, service, onShutdown = () => {} }) {
  const sessions = new Map()
  let shutdownPromise
  const emit = (value) => output.write(JSON.stringify({ version: 1, ...value }) + '\n')
  const requireTab = (request) => {
    if (typeof request.tabId !== 'string' || !request.tabId) throw new Error('Missing tabId')
    return request.tabId
  }
  async function dispatch(request) {
    if (request.version !== 1 || typeof request.id !== 'string' || typeof request.method !== 'string') throw new Error('Invalid request')
    if (request.method === 'ping') return { ready: true }
    if (request.method.includes(':') && service) return service(request.method, request.params || {})
    const tabId = requireTab(request)
    if (request.method === 'start') {
      if (sessions.has(tabId)) throw new Error('Tab already started')
      if (typeof request.params?.cwd !== 'string' || !request.params.cwd.startsWith('/')) throw new Error('An absolute workspace path is required')
      const callbacks = {
        emitEvent: (data) => emit({ event: 'message', tabId, data }),
        emitState: (data) => emit({ event: 'state', tabId, data }),
        emitPermission: (data) => emit({ event: 'permission', tabId, data }),
        emitPermissionCancel: (data) => emit({ event: 'permissionCancel', tabId, data }),
        onResult: () => {}
      }
      const session = createSession(callbacks)
      sessions.set(tabId, session)
      try { return await session.start(request.params) } catch (error) { sessions.delete(tabId); await session.stop(); throw error }
    }
    const session = sessions.get(tabId)
    if (!session) throw new Error('Tab not started')
    switch (request.method) {
      case 'send':
        if (typeof request.params?.text !== 'string') throw new Error('Missing message text')
        await session.send(request.params); return null
      case 'model':
        if (typeof request.params?.model !== 'string' || !request.params.model.trim()) throw new Error('Invalid model')
        await session.setModel(request.params.model); return null
      case 'effort':
        if (!['default', 'low', 'medium', 'high', 'xhigh', 'max'].includes(request.params?.effort)) throw new Error('Invalid effort')
        await session.setEffort(request.params.effort); return null
      case 'mode':
        if (!['default', 'plan', 'acceptEdits', 'bypassPermissions'].includes(request.params?.mode)) throw new Error('Invalid permission mode')
        await session.setPermissionMode(request.params.mode); return null
      case 'commands': return session.supportedCommands()
      case 'mcpStatus': return session.mcpStatus()
      case 'toggleMcp': return session.toggleMcp(request.params.name, request.params.enabled === true)
      case 'rewind': return session.rewind(request.params.id, request.params.dryRun !== false)
      case 'interrupt': await session.interrupt(); return null
      case 'permission':
        if (typeof request.params?.id !== 'string' || !['allow', 'deny'].includes(request.params?.decision)) throw new Error('Invalid permission response')
        session.respondPermission(request.params.id, request.params.decision, request.params.always === true, undefined, request.params.answers); return null
      case 'stop': sessions.delete(tabId); await session.stop(); return null
      default: throw new Error('Unknown method')
    }
  }
  const lines = createInterface({ input, crlfDelay: Infinity })
  // Serialize commands per tab so start/send/stop cannot race. Different tabs remain concurrent.
  const queues = new Map()
  lines.on('line', (line) => {
    let request
    try {
      if (Buffer.byteLength(line) > 64 * 1024 * 1024) throw new Error('Request too large')
      request = JSON.parse(line)
    } catch { emit({ id: null, error: 'Invalid request' }); return }
    const key = typeof request?.method === 'string' && request.method.includes(':')
      ? (request.method.startsWith('settings:') ? '__settings' : request.method)
      : (typeof request?.tabId === 'string' ? request.tabId : '')
    const previous = queues.get(key) || Promise.resolve()
    const current = previous.then(async () => {
      try { const result = await dispatch(request); emit({ id: request.id, result }) }
      catch (error) { emit({ id: typeof request?.id === 'string' ? request.id : null, error: error instanceof Error ? error.message : 'Request failed' }) }
    })
    queues.set(key, current)
    void current.finally(() => { if (queues.get(key) === current) queues.delete(key) })
  })
  const shutdown = () => {
    if (shutdownPromise) return shutdownPromise
    shutdownPromise = Promise.resolve().then(async () => {
      lines.close()
      onShutdown()
      await Promise.allSettled([...queues.values()])
      await Promise.allSettled([...sessions.values()].map((session) => session.stop()))
      sessions.clear()
    })
    return shutdownPromise
  }
  lines.on('close', () => { void shutdown() })
  return shutdown
}
