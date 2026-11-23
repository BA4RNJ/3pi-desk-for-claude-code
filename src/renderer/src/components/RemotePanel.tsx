import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Cloud,
  Copy,
  Download,
  Globe,
  QrCode,
  RefreshCw,
  Shield,
  Smartphone,
  Square
} from 'lucide-react'
import type { AppDefaults, RemoteSettings } from '../../../shared/types'
import { qrSvgPath } from '../lib/qr'

interface RemotePanelProps {
  defaults: AppDefaults | null
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function RemotePanel({ defaults }: RemotePanelProps): React.JSX.Element {
  const isWeb = defaults?.runtime === 'web'
  const [remote, setRemote] = useState<RemoteSettings | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [port, setPort] = useState('3789')
  const [bind, setBind] = useState<'localhost' | 'lan'>('lan')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [tunnelMode, setTunnelMode] = useState<'quick' | 'named'>('quick')
  const [tunnelName, setTunnelName] = useState('')
  const [tunnelConfig, setTunnelConfig] = useState('')
  const [tunnelHost, setTunnelHost] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [qrTarget, setQrTarget] = useState<string>('')
  const [pairingToken, setPairingToken] = useState<{ code: string; expiresAt: number } | null>(
    null
  )
  const initialized = useRef(false)

  const refreshPairingToken = useCallback(async () => {
    if (isWeb) return
    try {
      const token = await window.desk.createRemotePairingToken()
      setPairingToken(token)
    } catch {
      // ignore if remote is not active yet
    }
  }, [isWeb])

  const apply = useCallback((value: RemoteSettings) => {
    setRemote(value)
    setEnabled(value.enabled)
    setPort(String(value.port))
    setBind(value.bind)
    setUsername(value.username)
    if (value.tunnel) {
      setTunnelMode(value.tunnel.mode)
      setTunnelName(value.tunnel.name || '')
      setTunnelConfig(value.tunnel.configPath || '')
      setTunnelHost(value.tunnel.hostname || '')
    }
  }, [])

  const refresh = useCallback(
    async (applyForm = false) => {
      try {
        const value = await window.desk.getRemoteSettings()
        setRemote(value)
        // Status polling must never overwrite fields the user is editing
        // (especially the enable checkbox). Only the first load and an
        // explicit save/refresh may repopulate the form.
        if (!initialized.current || applyForm) {
          apply(value)
          initialized.current = true
        }
      } catch (reason) {
        setError(errorText(reason))
      }
    },
    [apply]
  )

  useEffect(() => {
    void refresh(true)
    const timer = window.setInterval(() => void refresh(false), 4000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const save = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const value = await window.desk.saveRemoteSettings({
        enabled,
        port: Number(port) || 3789,
        bind,
        username: username.trim(),
        // Deliberately not sending `password` here: saving the panel must not
        // silently change the login. Use the separate 修改密码 action.
        tunnel: {
          provider: 'cloudflare',
          mode: tunnelMode,
          name: tunnelName.trim() || undefined,
          configPath: tunnelConfig.trim() || undefined,
          hostname: tunnelHost.trim() || undefined
        }
      })
      apply(value)
      setMessage('远程访问设置已保存（密码未修改）。')
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setBusy(false)
    }
  }

  const startTunnel = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const saved = await window.desk.saveRemoteSettings({
        tunnel: {
          provider: 'cloudflare',
          mode: tunnelMode,
          name: tunnelName.trim() || undefined,
          configPath: tunnelConfig.trim() || undefined,
          hostname: tunnelHost.trim() || undefined
        }
      })
      if (!saved.enabled) {
        setError('请先启用远程访问并保存，再启动隧道。')
        return
      }
      const status = await window.desk.startTunnel(tunnelMode, {
        name: tunnelName.trim(),
        configPath: tunnelConfig.trim(),
        hostname: tunnelHost.trim()
      })
      if (status.tunnelRunning) {
        setMessage('Cloudflare Tunnel 已启动。')
      } else {
        setMessage('已发送启动请求，正在等待 cloudflared 输出公网地址。')
      }
      await refresh()
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setBusy(false)
    }
  }

  const savePassword = async (): Promise<void> => {
    if (busy) return
    const next = password.trim()
    if (!next) {
      setError('请输入新密码后再保存。')
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const value = await window.desk.saveRemoteSettings({ password: next })
      apply(value)
      setPassword('')
      setMessage('登录密码已更新。下次登录请使用新密码。')
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setBusy(false)
    }
  }

  const downloadCloudflared = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('正在下载 cloudflared…')
    try {
      await window.desk.downloadCloudflared()
      setMessage('cloudflared 已下载。')
      await refresh()
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setBusy(false)
    }
  }

  const stopTunnel = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await window.desk.stopTunnel()
      setMessage('Cloudflare Tunnel 已停止。')
      await refresh()
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setBusy(false)
    }
  }

  const copy = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setMessage('已复制。')
    } catch {
      setMessage(text)
    }
  }

  const lanUrls = remote?.lanUrls || []
  const tunnel = remote?.tunnel
  const tunnelUrl = tunnel?.url
  const publicUrl = tunnelUrl || (tunnel?.hostname ? `https://${tunnel.hostname}` : '')
  const availableQrUrls = useMemo(() => {
    const list: Array<{ label: string; url: string }> = []
    for (const u of lanUrls) list.push({ label: `局域网: ${u}`, url: u })
    if (publicUrl) list.push({ label: `公网隧道: ${publicUrl}`, url: publicUrl })
    return list
  }, [lanUrls, publicUrl])

  useEffect(() => {
    if (!qrTarget && availableQrUrls.length > 0) {
      setQrTarget(availableQrUrls[0].url)
    } else if (qrTarget && !availableQrUrls.some((item) => item.url === qrTarget)) {
      setQrTarget(availableQrUrls[0]?.url || '')
    }
  }, [availableQrUrls, qrTarget])

  useEffect(() => {
    if (remote?.enabled && availableQrUrls.length > 0 && !pairingToken && !isWeb) {
      void refreshPairingToken()
    }
  }, [availableQrUrls.length, isWeb, pairingToken, refreshPairingToken, remote?.enabled])

  const qrConnectUrl = useMemo(() => {
    if (!qrTarget) return ''
    if (!pairingToken?.code) return qrTarget
    const sep = qrTarget.includes('?') ? '&' : '?'
    return `${qrTarget}${sep}pair=${encodeURIComponent(pairingToken.code)}`
  }, [pairingToken?.code, qrTarget])

  const qrSvg = useMemo(() => {
    if (!qrConnectUrl) return null
    try {
      return qrSvgPath(qrConnectUrl)
    } catch {
      return null
    }
  }, [qrConnectUrl])

  return (
    <div className="settings-page">
      <h3>远程访问</h3>
      <p className="settings-page-sub">
        {'在同一局域网用手机浏览器操控这台电脑上的 3PI Desk，或通过 Cloudflare Tunnel 从公网访问。应用必须保持运行。'}
      </p>

      <div className="settings-group">
        <span className="settings-label">局域网访问</span>
        <div className="settings-rows">
          <div className="settings-row">
            <span>启用远程访问</span>
            <input
              type="checkbox"
              checked={enabled}
              disabled={isWeb}
              onChange={(event) => setEnabled(event.target.checked)}
            />
          </div>
          <div className="settings-row">
            <span>端口</span>
            <input
              className="text-input"
              value={port}
              disabled={isWeb}
              inputMode="numeric"
              onChange={(event) => setPort(event.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
          <div className="settings-row">
            <span>绑定地址</span>
            <select
              className="text-input"
              value={bind}
              disabled={isWeb}
              onChange={(event) => setBind(event.target.value as 'localhost' | 'lan')}
            >
              <option value="lan">局域网（0.0.0.0）</option>
              <option value="localhost">仅本机（配合隧道）</option>
            </select>
          </div>
          <div className="settings-row">
            <span>账号</span>
            <input
              className="text-input"
              value={username}
              disabled={isWeb}
              autoComplete="username"
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div className="settings-row">
            <span>密码</span>
            <input
              className="text-input"
              type="password"
              value={password}
              disabled={isWeb}
              placeholder={remote?.hasPassword ? '已设置；输入新密码后点“修改密码”' : '设置登录密码'}
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
            />
            {!isWeb && (
              <button
                type="button"
                className="button ghost"
                disabled={busy || !password.trim()}
                onClick={() => void savePassword()}
              >
                修改密码
              </button>
            )}
          </div>
        </div>
        <p className="settings-note">
          {'远程访问等同于在这台电脑上执行 Claude Code 工具。请使用强密码；公网访问建议使用 Cloudflare Tunnel，并启用 Cloudflare Access。'}
        </p>
        {!isWeb && (
          <div className="settings-actions">
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() => void save()}
            >
              保存远程访问设置
            </button>
          </div>
        )}
      </div>

      <div className="settings-group">
        <span className="settings-label">局域网地址</span>
        {bind === 'localhost' ? (
          <p className="settings-note">
            {'仅本机模式：局域网不可直接访问；请使用 Cloudflare Tunnel 或改为局域网绑定。'}
          </p>
        ) : lanUrls.length > 0 ? (
          <div className="settings-rows">
            {lanUrls.map((url) => (
              <div className="settings-row" key={url}>
                <span>{url}</span>
                <button type="button" className="button ghost" onClick={() => void copy(url)}>
                  <Copy size={14} /> 复制
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="settings-note">
            {remote?.enabled
              ? '服务器尚未启动或没有检测到局域网 IPv4 地址。'
              : '启用远程访问后这里会显示手机可访问的地址。'}
          </p>
        )}
        <p className="settings-note">
          手机与电脑需在同一 Wi-Fi；如果打不开，请检查电脑防火墙是否放行该端口。
        </p>
      </div>

      {!isWeb && remote?.enabled && availableQrUrls.length > 0 && (
        <div className="settings-group">
          <span className="settings-label">
            <QrCode size={15} /> 手机扫码免密直连
          </span>
          <div className="remote-qr-card">
            {qrSvg && (
              <div className="remote-qr-box">
                <svg
                  viewBox={`-2 -2 ${qrSvg.size + 4} ${qrSvg.size + 4}`}
                  width="156"
                  height="156"
                  shapeRendering="crispEdges"
                  aria-label="远程访问二维码"
                >
                  <rect
                    x="-2"
                    y="-2"
                    width={qrSvg.size + 4}
                    height={qrSvg.size + 4}
                    fill="#ffffff"
                    rx="2"
                  />
                  <path d={qrSvg.path} fill="#111111" />
                </svg>
              </div>
            )}
            <div className="remote-qr-info">
              {availableQrUrls.length > 1 && (
                <select
                  className="text-input"
                  value={qrTarget}
                  onChange={(event) => setQrTarget(event.target.value)}
                >
                  {availableQrUrls.map((item) => (
                    <option key={item.url} value={item.url}>
                      {item.label}
                    </option>
                  ))}
                </select>
              )}
              <p className="settings-note" style={{ margin: 0 }}>
                使用手机相机扫描上方二维码，将自动携带 <strong>5 分钟有效的一次性配对码</strong> 直接登录，无需在手机上手动输入长密码。
              </p>
              <div className="settings-inline-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => void refreshPairingToken()}
                >
                  <RefreshCw size={13} /> 刷新配对码
                </button>
                {qrConnectUrl && (
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => void copy(qrConnectUrl)}
                  >
                    <Copy size={13} /> 复制免密链接
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="settings-group">
        <span className="settings-label">
          <Cloud size={15} /> Cloudflare Tunnel
        </span>
        <div className="settings-rows">
          <div className="settings-row">
            <span>模式</span>
            <select
              className="text-input"
              value={tunnelMode}
              disabled={isWeb}
              onChange={(event) => setTunnelMode(event.target.value as 'quick' | 'named')}
            >
              <option value="quick">Quick Tunnel（临时地址）</option>
              <option value="named">Named Tunnel（固定域名）</option>
            </select>
          </div>
          {tunnelMode === 'named' && (
            <>
              <div className="settings-row">
                <span>Tunnel 名称</span>
                <input
                  className="text-input"
                  value={tunnelName}
                  disabled={isWeb}
                  placeholder="例如 3pi-desk"
                  onChange={(event) => setTunnelName(event.target.value)}
                />
              </div>
              <div className="settings-row">
                <span>配置文件</span>
                <input
                  className="text-input"
                  value={tunnelConfig}
                  disabled={isWeb}
                  placeholder="~/.cloudflared/config.yml（可选）"
                  onChange={(event) => setTunnelConfig(event.target.value)}
                />
              </div>
              <div className="settings-row">
                <span>公网域名</span>
                <input
                  className="text-input"
                  value={tunnelHost}
                  disabled={isWeb}
                  placeholder="desk.example.com"
                  onChange={(event) => setTunnelHost(event.target.value)}
                />
              </div>
            </>
          )}
        </div>
        <div className="settings-rows">
          <div className="settings-row">
            <span>状态</span>
            <strong>
              {tunnel?.running ? '运行中' : '未运行'}
              {tunnel?.error ? ` · ${tunnel.error}` : ''}
            </strong>
          </div>
          {publicUrl && (
            <div className="settings-row">
              <span>{publicUrl}</span>
              <button
                type="button"
                className="button ghost"
                onClick={() => void copy(publicUrl)}
              >
                <Copy size={14} /> 复制
              </button>
            </div>
          )}
        </div>
        {!isWeb && (
          <div className="settings-actions">
            {tunnel?.running ? (
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => void stopTunnel()}
              >
                <Square size={14} /> 停止隧道
              </button>
            ) : (
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => void startTunnel()}
              >
                <Cloud size={14} /> 启动隧道
              </button>
            )}
            {tunnel?.available === false && (
              <button
                type="button"
                className="button ghost"
                disabled={busy}
                onClick={() => void downloadCloudflared()}
              >
                <Download size={14} /> 下载 cloudflared
              </button>
            )}
            <button
              type="button"
              className="button ghost"
              disabled={busy}
              onClick={() => void refresh()}
            >
              <RefreshCw size={14} /> 刷新状态
            </button>
          </div>
        )}
        <p className="settings-note">
          Quick Tunnel 每次启动都会生成新的 trycloudflare.com 地址，适合临时使用。
          Named Tunnel 需要先在 Cloudflare 控制台创建隧道并把 ingress 指向
          http://127.0.0.1:{port}；建议同时启用 Cloudflare Access（邮箱 OTP / SSO）。
        </p>
        {!isWeb && (
          <p className="settings-note">
            未安装 cloudflared 时请先安装：
            https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
          </p>
        )}
      </div>

      <div className="settings-group">
        <span className="settings-label">
          <Smartphone size={15} /> 已连接设备
        </span>
        {remote?.devices && remote.devices.length > 0 ? (
          <div className="settings-rows">
            {remote.devices.map((device) => (
              <div className="settings-row" key={device.id}>
                <span>{device.name}</span>
                <strong>{device.ip || '—'}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="settings-note">暂无已连接设备。</p>
        )}
      </div>

      {error && <div className="settings-message is-error">{error}</div>}
      {message && <div className="settings-message">{message}</div>}

      <div className="settings-note">
        <Shield size={14} /> 令牌与密码只保存在这台电脑的应用数据目录（0600）。手机端不会
        收到 API Token。关闭远程访问后所有浏览器连接会立即断开。
      </div>
      {isWeb && (
        <p className="settings-note">
          你正在通过浏览器访问。端口、绑定地址、密码和隧道启停只能在电脑端修改。
        </p>
      )}
      <div className="settings-note">
        <Globe size={14} /> 如果使用 Cloudflare Access，请先在同一浏览器完成 Access
        登录，再打开隧道地址；登录重定向可能丢失 URL 中的临时信息。
      </div>
    </div>
  )
}
