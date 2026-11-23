import { useEffect, useState } from 'react'
import App from './App'
import { webDesk, type WebDeskStatus } from './lib/web-desk'

const shell: React.CSSProperties = {
  minHeight: '100dvh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  background: 'var(--bg, #f0eee6)',
  color: 'var(--ink, #1f1e1c)',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
}

const card: React.CSSProperties = {
  width: '100%',
  maxWidth: '380px',
  padding: '28px',
  borderRadius: '20px',
  background: 'var(--panel, #fff)',
  boxShadow: '0 18px 60px rgba(0,0,0,.16)'
}

const input: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  marginTop: '8px',
  marginBottom: '14px',
  padding: '12px 14px',
  borderRadius: '12px',
  border: '1px solid rgba(0,0,0,.16)',
  background: 'transparent',
  color: 'inherit',
  fontSize: '16px'
}

const button: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '12px',
  border: 'none',
  background: 'var(--coral, #c96442)',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 600,
  cursor: 'pointer'
}

export default function WebRoot(): React.JSX.Element {
  const [status, setStatus] = useState<WebDeskStatus>('connecting')
  const [error, setError] = useState('')
  const [username, setUsername] = useState('ba4rnj')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    return webDesk.onStatus((next, message) => {
      setStatus(next)
      setError(message || '')
    })
  }, [])

  if (status === 'ready') return <App />

  const connecting = status === 'connecting' || status === 'disconnected'

  return (
    <div style={shell}>
      <form
        style={card}
        onSubmit={(event) => {
          event.preventDefault()
          if (busy) return
          setBusy(true)
          setError('')
          webDesk
            .login(username.trim(), password)
            .catch((reason: unknown) => {
              setError(reason instanceof Error ? reason.message : String(reason))
            })
            .finally(() => setBusy(false))
        }}
      >
        <div style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>
          3PI Desk
        </div>
        <div style={{ opacity: 0.65, fontSize: '14px', marginBottom: '22px' }}>
          手机 / 浏览器远程访问桌面端 Claude Code
        </div>

        {connecting && (
          <div style={{ marginBottom: '14px', fontSize: '14px', opacity: 0.75 }}>
            {status === 'disconnected' ? '连接已断开，正在重连…' : '正在连接桌面端…'}
          </div>
        )}

        <label style={{ fontSize: '13px', fontWeight: 600 }}>账号</label>
        <input
          style={input}
          value={username}
          autoComplete="username"
          onChange={(event) => setUsername(event.target.value)}
        />

        <label style={{ fontSize: '13px', fontWeight: 600 }}>密码</label>
        <input
          style={input}
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
        />

        {error && (
          <div style={{ color: '#b3261e', fontSize: '13px', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <button style={{ ...button, opacity: busy ? 0.6 : 1 }} type="submit" disabled={busy}>
          {busy ? '登录中…' : '登录'}
        </button>

        <div style={{ marginTop: '16px', fontSize: '12px', opacity: 0.55, lineHeight: 1.5 }}>
          远程访问等同于在电脑上执行命令。请只在可信网络中登录，并在电脑端设置强密码。
        </div>
      </form>
    </div>
  )
}
