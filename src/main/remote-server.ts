import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { extname, join, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { WebSocketServer, WebSocket } from 'ws'
import type { AppDefaults, ClaudeCliStatus, RemoteStatus, SettingsSnapshot } from '../shared/types'
import type { RemoteSnapshot } from '../shared/remote'

const REMOTE_PROTOCOL_VERSION = 1
import type { DeskHub, HubClient } from './desk-hub'
import type { RemoteAuth } from './remote-auth'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
}

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
  "media-src 'self' data: blob: https: http:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'"
].join('; ')

export interface RemoteServerOptions {
  hub: DeskHub
  auth: RemoteAuth
  staticRoot: string
  getDefaults: () => AppDefaults
  getSettings: () => SettingsSnapshot
  getRemoteStatus: () => RemoteStatus
  getClaudeCliStatus: () => ClaudeCliStatus | null
  log?: (line: string) => void
}

class RemoteClient implements HubClient {
  readonly id = randomUUID()
  readonly kind = 'remote' as const
  deviceName = '浏览器'
  ip = ''
  authenticated = false
  alive = true
  private readonly ws: WebSocket
  private queue: Promise<void> = Promise.resolve()

  constructor(ws: WebSocket) {
    this.ws = ws
  }

  send(channel: string, payload: unknown): void {
    if (this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(
      JSON.stringify({ v: REMOTE_PROTOCOL_VERSION, event: channel, data: payload })
    )
  }

  sendMessage(message: unknown): void {
    if (this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify(message))
  }

  close(): void {
    try {
      this.ws.close()
    } catch {
      // ignore
    }
  }

  ping(): void {
    try {
      this.ws.ping()
    } catch {
      // ignore
    }
  }

  enqueue(task: () => Promise<void>): void {
    this.queue = this.queue.then(task, task)
  }
}

export class RemoteServer {
  private httpServer: Server | null = null
  private wss: WebSocketServer | null = null
  private readonly clients = new Set<RemoteClient>()
  private heartbeat: NodeJS.Timeout | null = null
  private port = 3789
  private bind: 'localhost' | 'lan' = 'lan'
  private running = false
  private lastError = ''
  private readonly options: RemoteServerOptions

  constructor(options: RemoteServerOptions) {
    this.options = options
  }

  getStatus(): RemoteStatus {
    return {
      running: this.running,
      port: this.port,
      bind: this.bind,
      lanUrls: this.running && this.bind === 'lan' ? this.lanUrls() : [],
      clients: this.clients.size,
      error: this.lastError || undefined
    }
  }

  async start(port: number, bind: 'localhost' | 'lan'): Promise<RemoteStatus> {
    await this.stop()
    this.port = port
    this.bind = bind
    this.lastError = ''

    const server = createServer((req, res) => this.handleHttp(req, res))
    const wss = new WebSocketServer({
      noServer: true,
      perMessageDeflate: false,
      maxPayload: 16 * 1024 * 1024
    })
    server.on('upgrade', (req, socket, head) => this.handleUpgrade(req, socket, head, wss))
    server.on('error', (error) => {
      this.lastError = error.message
      this.options.log?.(`remote server error: ${error.message}`)
    })
    wss.on('error', (error) => {
      this.lastError = error.message
      this.options.log?.(`remote websocket error: ${error.message}`)
    })

    await new Promise<void>((resolvePromise, reject) => {
      const onError = (error: Error): void => {
        server.off('error', onError)
        reject(error)
      }
      server.once('error', onError)
      server.listen(port, bind === 'lan' ? '0.0.0.0' : '127.0.0.1', () => {
        server.off('error', onError)
        resolvePromise()
      })
    })

    const address = server.address()
    if (address && typeof address === 'object') {
      this.port = address.port
    }
    this.httpServer = server
    this.wss = wss
    this.running = true
    this.heartbeat = setInterval(() => this.pingClients(), 30_000)
    this.options.log?.(`remote server listening on ${bind}:${port}`)
    return this.getStatus()
  }

  async stop(): Promise<void> {
    if (this.heartbeat) {
      clearInterval(this.heartbeat)
      this.heartbeat = null
    }
    for (const client of this.clients) {
      client.close()
      this.options.hub.unregisterClient(client)
    }
    this.clients.clear()
    const wss = this.wss
    this.wss = null
    if (wss) {
      // Terminating here avoids a graceful close handshake keeping the server
      // alive when a browser has already disappeared.
      for (const socket of wss.clients) {
        try {
          socket.terminate()
        } catch {
          // already closed
        }
      }
      await new Promise<void>((resolvePromise) => {
        const timer = setTimeout(resolvePromise, 2000)
        wss.close(() => {
          clearTimeout(timer)
          resolvePromise()
        })
      })
    }
    const server = this.httpServer
    this.httpServer = null
    if (server) {
      await new Promise<void>((resolvePromise) => {
        const timer = setTimeout(() => {
          // Node 18+: drop keep-alive sockets that would otherwise hold
          // server.close() open indefinitely.
          server.closeAllConnections?.()
          resolvePromise()
        }, 2000)
        server.close(() => {
          clearTimeout(timer)
          resolvePromise()
        })
        server.closeIdleConnections?.()
      })
    }
    this.running = false
  }

  lanUrls(): string[] {
    const urls: string[] = []
    for (const entries of Object.values(networkInterfaces())) {
      for (const entry of entries || []) {
        if (entry.family !== 'IPv4' || entry.internal) continue
        urls.push(`http://${entry.address}:${this.port}`)
      }
    }
    return [...new Set(urls)]
  }

  private handleUpgrade(
    req: IncomingMessage,
    socket: import('node:stream').Duplex,
    head: Buffer,
    wss: WebSocketServer
  ): void {
    let pathname = ''
    try {
      pathname = new URL(req.url || '/', 'http://localhost').pathname
    } catch {
      socket.destroy()
      return
    }
    if (pathname !== '/ws') {
      socket.destroy()
      return
    }
    if (!this.originAllowed(req)) {
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => this.handleConnection(ws, req))
  }

  private originAllowed(req: IncomingMessage): boolean {
    const origin = req.headers.origin
    if (!origin) return true
    try {
      const originHost = new URL(origin).host
      const host = req.headers.host || ''
      return originHost === host
    } catch {
      return false
    }
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const client = new RemoteClient(ws)
    client.ip = this.clientIp(req)
    this.clients.add(client)
    const timer = setTimeout(() => {
      if (!client.authenticated) {
        client.sendMessage({
          v: REMOTE_PROTOCOL_VERSION,
          type: 'error',
          error: { code: 'auth_timeout', message: '登录超时，请重新连接。' }
        })
        client.close()
      }
    }, 10_000)

    ws.on('pong', () => {
      client.alive = true
    })
    ws.on('message', (data) => {
      client.enqueue(() => this.handleMessage(client, data))
    })
    ws.on('close', () => {
      clearTimeout(timer)
      this.clients.delete(client)
      this.options.hub.unregisterClient(client)
    })
    ws.on('error', () => {
      // close follows
    })
  }

  private async handleMessage(client: RemoteClient, data: import('ws').RawData): Promise<void> {
    let message: Record<string, unknown>
    try {
      message = JSON.parse(data.toString()) as Record<string, unknown>
    } catch {
      client.sendMessage({
        v: REMOTE_PROTOCOL_VERSION,
        type: 'error',
        error: { code: 'bad_json', message: '消息格式无效。' }
      })
      return
    }

    if (!client.authenticated) {
      const type = String(message.type || '')
      if (type === 'login') {
        const username = String(message.username || '')
        const password = String(message.password || '')
        const token = this.options.auth.login(username, password, client.ip)
        if (!token) {
          client.sendMessage({
            v: REMOTE_PROTOCOL_VERSION,
            type: 'error',
            error: { code: 'unauthorized', message: '账号或密码错误，或尝试次数过多。' }
          })
          setTimeout(() => client.close(), 250)
          return
        }
        client.deviceName = String(
          (message.device as { name?: string } | undefined)?.name || '浏览器'
        )
        client.authenticated = true
        this.options.hub.registerClient(client)
        client.sendMessage({
          v: REMOTE_PROTOCOL_VERSION,
          type: 'ready',
          protocol: REMOTE_PROTOCOL_VERSION,
          runtime: 'web',
          token,
          snapshot: this.snapshot()
        })
        return
      }
      if (type === 'pair') {
        const code = String(message.code || '')
        const token = this.options.auth.redeemPairingToken(code, client.ip)
        if (!token) {
          client.sendMessage({
            v: REMOTE_PROTOCOL_VERSION,
            type: 'error',
            error: { code: 'unauthorized', message: '扫码配对码已过期或无效，请在电脑端刷新二维码。' }
          })
          setTimeout(() => client.close(), 250)
          return
        }
        client.deviceName = String(
          (message.device as { name?: string } | undefined)?.name || '手机扫码'
        )
        client.authenticated = true
        this.options.hub.registerClient(client)
        client.sendMessage({
          v: REMOTE_PROTOCOL_VERSION,
          type: 'ready',
          protocol: REMOTE_PROTOCOL_VERSION,
          runtime: 'web',
          token,
          snapshot: this.snapshot()
        })
        return
      }
      if (type === 'resume') {
        const token = String(message.token || '')
        const username = this.options.auth.resume(token)
        if (!username) {
          client.sendMessage({
            v: REMOTE_PROTOCOL_VERSION,
            type: 'error',
            error: { code: 'unauthorized', message: '登录已过期，请重新登录。' }
          })
          setTimeout(() => client.close(), 250)
          return
        }
        client.authenticated = true
        this.options.hub.registerClient(client)
        client.sendMessage({
          v: REMOTE_PROTOCOL_VERSION,
          type: 'ready',
          protocol: REMOTE_PROTOCOL_VERSION,
          runtime: 'web',
          token,
          snapshot: this.snapshot()
        })
        return
      }
      client.sendMessage({
        v: REMOTE_PROTOCOL_VERSION,
        type: 'error',
        error: { code: 'unauthorized', message: '请先登录。' }
      })
      return
    }

    const id = String(message.id || '')
    const method = String(message.method || '')
    const args = Array.isArray(message.args) ? message.args : []
    if (!id || !method) {
      client.sendMessage({
        v: REMOTE_PROTOCOL_VERSION,
        id,
        error: { code: 'bad_request', message: '请求格式无效。' }
      })
      return
    }
    try {
      const result = await this.options.hub.request(method, args, client)
      client.sendMessage({ v: REMOTE_PROTOCOL_VERSION, id, result })
    } catch (error) {
      client.sendMessage({
        v: REMOTE_PROTOCOL_VERSION,
        id,
        error: {
          code: 'request_failed',
          message: error instanceof Error ? error.message : '请求失败。'
        }
      })
    }
  }

  private snapshot(): RemoteSnapshot {
    const defaults = this.options.getDefaults()
    return {
      protocol: REMOTE_PROTOCOL_VERSION,
      runtime: 'web',
      defaults: { ...defaults, runtime: 'web' },
      settings: this.options.getSettings(),
      claudeCli: this.options.getClaudeCliStatus(),
      tabs: this.options.hub.listTabsWithLive(),
      remote: this.options.getRemoteStatus()
    }
  }

  private pingClients(): void {
    for (const client of this.clients) {
      if (!client.alive) {
        client.close()
        this.clients.delete(client)
        this.options.hub.unregisterClient(client)
        continue
      }
      client.alive = false
      client.ping()
    }
  }

  private clientIp(req: IncomingMessage): string {
    const socketIp = req.socket.remoteAddress || ''
    const forwarded = req.headers['cf-connecting-ip']
    if (
      typeof forwarded === 'string' &&
      (socketIp === '127.0.0.1' || socketIp === '::1' || socketIp === '::ffff:127.0.0.1')
    ) {
      return forwarded
    }
    return socketIp.replace(/^::ffff:/, '')
  }

  private handleHttp(req: IncomingMessage, res: ServerResponse): void {
    const headers: Record<string, string> = {
      'Content-Security-Policy': CSP,
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    }
    let pathname = '/'
    try {
      pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname)
    } catch {
      res.writeHead(400, headers)
      res.end('Bad request')
      return
    }
    if (pathname === '/healthz') {
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: true, protocol: REMOTE_PROTOCOL_VERSION }))
      return
    }

    const root = resolve(this.options.staticRoot)
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
    const file = resolve(root, relative)
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403, headers)
      res.end('Forbidden')
      return
    }
    if (existsSync(file) && statSync(file).isFile()) {
      this.serveFile(res, file, headers)
      return
    }
    if (pathname.startsWith('/assets/')) {
      res.writeHead(404, headers)
      res.end('Not found')
      return
    }
    const index = join(root, 'index.html')
    if (existsSync(index)) {
      this.serveFile(res, index, headers)
      return
    }
    res.writeHead(503, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('3PI Desk web UI is not built. Run `npx electron-vite build` first.')
  }

  private serveFile(
    res: ServerResponse,
    file: string,
    headers: Record<string, string>
  ): void {
    const ext = extname(file).toLowerCase()
    const immutable = file.includes(`${sep}assets${sep}`)
    res.writeHead(200, {
      ...headers,
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache'
    })
    createReadStream(file).pipe(res)
  }
}
