import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import * as tar from 'tar'

export interface TunnelStatus {
  running: boolean
  mode?: 'quick' | 'named'
  url?: string
  error?: string
  output?: string
  /** Whether a usable cloudflared binary was found. */
  available?: boolean
}

const URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*m/g, '')
}

function candidatePaths(): string[] {
  const candidates = [
    process.env.CLOUDFLARED_PATH,
    '/usr/local/bin/cloudflared',
    '/usr/bin/cloudflared',
    '/opt/homebrew/bin/cloudflared',
    join(homedir(), '.local', 'bin', 'cloudflared')
  ].filter((item): item is string => Boolean(item))
  return candidates
}

function probe(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(command, ['--version'], { timeout: 5000 }, (error) => resolve(!error))
  })
}

export class TunnelManager {
  private child: ChildProcess | null = null
  private status: TunnelStatus = { running: false }
  private buffer = ''
  private stopTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectDelay = 2000
  private manualStop = false
  private lastConfig:
    | { mode: 'quick'; port: number }
    | { mode: 'named'; name: string; options: { configPath?: string; hostname?: string } }
    | null = null
  private readonly onStatus: (status: TunnelStatus) => void
  private readonly binDir: string
  private available = false

  constructor(onStatus: (status: TunnelStatus) => void, binDir?: string) {
    this.onStatus = onStatus
    this.binDir = binDir || join(homedir(), '.3pi-desk', 'cloudflared')
  }

  getStatus(): TunnelStatus {
    return { ...this.status, available: this.available }
  }

  async detect(): Promise<string | null> {
    const local = join(
      this.binDir,
      process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'
    )
    const candidates = [
      process.env.CLOUDFLARED_PATH,
      local,
      ...candidatePaths()
    ].filter((item): item is string => Boolean(item))
    for (const candidate of candidates) {
      if (existsSync(candidate) && (await probe(candidate))) {
        this.available = true
        return candidate
      }
    }
    if (await probe('cloudflared')) {
      this.available = true
      return 'cloudflared'
    }
    this.available = false
    return null
  }

  async download(): Promise<TunnelStatus> {
    const url = this.downloadUrl()
    if (!url) {
      this.setStatus({
        running: false,
        error: `当前平台不支持自动下载 cloudflared（${process.platform}/${process.arch}）。`
      })
      return this.getStatus()
    }
    try {
      await mkdir(this.binDir, { recursive: true })
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`下载失败：HTTP ${response.status}`)
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      const isArchive = url.endsWith('.tgz')
      if (isArchive) {
        const archive = join(this.binDir, 'cloudflared.tgz')
        await writeFile(archive, buffer)
        await tar.x({ file: archive, cwd: this.binDir })
        await rm(archive, { force: true })
      } else {
        const target = join(
          this.binDir,
          process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'
        )
        await writeFile(target, buffer)
      }
      const target = join(
        this.binDir,
        process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'
      )
      await chmod(target, 0o755).catch(() => undefined)
      this.available = true
      this.setStatus({ running: false, available: true })
      return this.getStatus()
    } catch (error) {
      this.setStatus({
        running: false,
        available: false,
        error: error instanceof Error ? error.message : String(error)
      })
      return this.getStatus()
    }
  }

  private downloadUrl(): string | null {
    const base = 'https://github.com/cloudflare/cloudflared/releases/latest/download'
    if (process.platform === 'linux') {
      return `${base}/cloudflared-linux-${process.arch === 'arm64' ? 'arm64' : 'amd64'}`
    }
    if (process.platform === 'win32') {
      return `${base}/cloudflared-windows-amd64.exe`
    }
    if (process.platform === 'darwin') {
      return `${base}/cloudflared-darwin-${process.arch === 'arm64' ? 'arm64' : 'amd64'}.tgz`
    }
    return null
  }

  async startQuick(port: number): Promise<TunnelStatus> {
    const binary = await this.detect()
    if (!binary) {
      this.setStatus({
        running: false,
        mode: 'quick',
        error: '未找到 cloudflared。请先安装：https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/'
      })
      return this.getStatus()
    }
    await this.stop(false)
    this.manualStop = false
    this.lastConfig = { mode: 'quick', port }
    this.buffer = ''
    this.setStatus({ running: true, mode: 'quick' })
    const child = spawn(
      binary,
      ['tunnel', '--url', `http://127.0.0.1:${port}`, '--no-autoupdate'],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    )
    this.child = child
    const timeout = setTimeout(() => {
      if (!this.status.url && this.status.running) {
        this.setStatus({
          ...this.status,
          error: 'cloudflared 启动超时，未获取到公网地址。',
          output: this.buffer.slice(-2000)
        })
      }
    }, 30_000)
    const consume = (chunk: Buffer): void => {
      this.buffer += stripAnsi(chunk.toString('utf8'))
      if (this.buffer.length > 20_000) this.buffer = this.buffer.slice(-20_000)
      const match = this.buffer.match(URL_PATTERN)
      if (match && match[0] !== this.status.url) {
        clearTimeout(timeout)
        this.reconnectDelay = 2000
        this.setStatus({ ...this.status, url: match[0], error: undefined })
      }
    }
    child.stdout?.on('data', consume)
    child.stderr?.on('data', consume)
    child.on('error', (error) => {
      clearTimeout(timeout)
      this.child = null
      this.setStatus({ running: false, mode: 'quick', error: error.message })
      this.scheduleAutoReconnect()
    })
    child.on('close', (code) => {
      clearTimeout(timeout)
      this.child = null
      this.setStatus({
        running: false,
        mode: 'quick',
        url: this.status.url,
        error:
          code && code !== 0
            ? `cloudflared 已退出（code ${code}）。${this.buffer.slice(-500)}`
            : undefined
      })
      if (!this.manualStop && code !== 0) {
        this.scheduleAutoReconnect()
      }
    })
    return this.getStatus()
  }

  async startNamed(
    name: string,
    options: { configPath?: string; hostname?: string } = {}
  ): Promise<TunnelStatus> {
    const binary = await this.detect()
    if (!binary) {
      this.setStatus({
        running: false,
        mode: 'named',
        error: '未找到 cloudflared。请先安装并运行 `cloudflared tunnel login`。'
      })
      return this.getStatus()
    }
    if (!name.trim()) {
      this.setStatus({ running: false, mode: 'named', error: '请填写 Cloudflare Tunnel 名称。' })
      return this.getStatus()
    }
    await this.stop(false)
    this.manualStop = false
    this.lastConfig = { mode: 'named', name: name.trim(), options }
    this.buffer = ''
    const args = ['tunnel', 'run', name.trim()]
    if (options.configPath?.trim()) args.push('--config', options.configPath.trim())
    this.setStatus({
      running: true,
      mode: 'named',
      url: options.hostname ? `https://${options.hostname.replace(/^https?:\/\//, '')}` : undefined
    })
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    this.child = child
    const consume = (chunk: Buffer): void => {
      const text = stripAnsi(chunk.toString('utf8'))
      this.buffer += text
      if (this.buffer.length > 20_000) this.buffer = this.buffer.slice(-20_000)
      if (text.includes('Registered tunnel connection')) {
        this.reconnectDelay = 2000
      }
    }
    child.stdout?.on('data', consume)
    child.stderr?.on('data', consume)
    child.on('error', (error) => {
      this.child = null
      this.setStatus({ running: false, mode: 'named', error: error.message })
      this.scheduleAutoReconnect()
    })
    child.on('close', (code) => {
      this.child = null
      this.setStatus({
        running: false,
        mode: 'named',
        url: this.status.url,
        error:
          code && code !== 0
            ? `cloudflared 已退出（code ${code}）。${this.buffer.slice(-500)}`
            : undefined
      })
      if (!this.manualStop && code !== 0) {
        this.scheduleAutoReconnect()
      }
    })
    return this.getStatus()
  }

  private scheduleAutoReconnect(): void {
    if (this.manualStop || !this.lastConfig || this.reconnectTimer) return
    const delay = this.reconnectDelay
    this.reconnectDelay = Math.min(30_000, Math.round(this.reconnectDelay * 1.8))
    const cfg = this.lastConfig
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.manualStop || !this.lastConfig) return
      if (cfg.mode === 'named') {
        void this.startNamed(cfg.name, cfg.options)
      } else {
        void this.startQuick(cfg.port)
      }
    }, delay)
  }

  async stop(manual = true): Promise<void> {
    if (manual) {
      this.manualStop = true
      this.lastConfig = null
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.stopTimer) {
      clearTimeout(this.stopTimer)
      this.stopTimer = null
    }
    const child = this.child
    this.child = null
    if (child) {
      try {
        child.kill('SIGTERM')
      } catch {
        // ignore
      }
      this.stopTimer = setTimeout(() => {
        try {
          child.kill('SIGKILL')
        } catch {
          // ignore
        }
      }, 5000)
    }
    if (this.status.running) {
      this.setStatus({ running: false, mode: this.status.mode, url: this.status.url })
    }
  }

  private setStatus(status: TunnelStatus): void {
    this.status = status
    this.onStatus(this.getStatus())
  }
}
