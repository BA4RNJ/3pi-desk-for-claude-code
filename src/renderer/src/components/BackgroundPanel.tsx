import { RefreshCw, Square, Terminal, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { BackgroundSession } from '../../../shared/types'

interface BackgroundPanelProps {
  defaultCwd: string
}

export function BackgroundPanel({ defaultCwd }: BackgroundPanelProps) {
  const [sessions, setSessions] = useState<BackgroundSession[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [cwd, setCwd] = useState(defaultCwd)
  const [prompt, setPrompt] = useState('')
  const [trust, setTrust] = useState(false)
  const [logs, setLogs] = useState<{ id: string; text: string } | null>(null)
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSessions(await window.desk.listBackgroundSessions())
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const start = async (): Promise<void> => {
    if (!prompt.trim() || !cwd.trim()) return
    setBusy('start')
    setError('')
    setMessage('')
    try {
      const result = await window.desk.startBackgroundSession(cwd.trim(), prompt.trim(), trust)
      setSessions(result.sessions)
      setMessage(result.id ? `已启动后台会话 ${result.id}` : result.output.trim())
      setPrompt('')
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : String(startError))
    } finally {
      setBusy('')
    }
  }

  const doTrust = async (): Promise<void> => {
    try {
      await window.desk.trustDirectory(cwd.trim())
      setTrust(true)
      setMessage('目录已加入信任列表，可以重试启动')
    } catch (trustError) {
      setError(trustError instanceof Error ? trustError.message : String(trustError))
    }
  }

  const showLogs = async (session: BackgroundSession): Promise<void> => {
    if (!session.id) return
    setBusy(`logs-${session.id}`)
    try {
      const text = await window.desk.backgroundLogs(session.id)
      setLogs({ id: session.id, text })
    } catch (logError) {
      setError(logError instanceof Error ? logError.message : String(logError))
    } finally {
      setBusy('')
    }
  }

  const stop = async (session: BackgroundSession): Promise<void> => {
    if (!session.id) return
    setBusy(`stop-${session.id}`)
    try {
      await window.desk.backgroundStop(session.id)
      await load()
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : String(stopError))
    } finally {
      setBusy('')
    }
  }

  const remove = async (session: BackgroundSession): Promise<void> => {
    if (!session.id) return
    setBusy(`remove-${session.id}`)
    try {
      await window.desk.backgroundRemove(session.id)
      await load()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : String(removeError))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="background-panel">
      <div className="background-start">
        <span className="settings-label">启动后台会话</span>
        <input
          className="text-input"
          value={cwd}
          spellCheck={false}
          onChange={(event) => setCwd(event.target.value)}
        />
        <textarea
          className="config-editor background-prompt"
          value={prompt}
          placeholder="给后台任务的消息…"
          onChange={(event) => setPrompt(event.target.value)}
        />
        <label className="background-trust">
          <input
            type="checkbox"
            checked={trust}
            onChange={(event) => setTrust(event.target.checked)}
          />
          信任此目录（写入引擎信任列表）
        </label>
        <div className="settings-actions">
          <button type="button" className="button ghost" onClick={() => void doTrust()}>
            只信任目录
          </button>
          <button
            type="button"
            className="button primary"
            disabled={busy === 'start' || !prompt.trim() || !cwd.trim()}
            onClick={() => void start()}
          >
            <Terminal size={14} /> 启动后台会话
          </button>
        </div>
        {message && <div className="settings-message">{message}</div>}
        {error && <div className="settings-error">{error}</div>}
      </div>

      <div className="background-list-head">
        <span className="settings-label">后台/交互会话</span>
        <button
          type="button"
          className="icon-button"
          onClick={() => void load()}
          title="刷新"
          aria-label="刷新后台会话"
        >
          <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
        </button>
      </div>

      <div className="extension-list">
        {sessions.length === 0 && !loading && (
          <p className="settings-empty">没有运行中的后台会话。</p>
        )}
        {sessions.map((session) => (
          <div key={`${session.kind}-${session.sessionId}`} className="extension-row">
            <span className="extension-icon">
              <Terminal size={14} />
            </span>
            <div className="extension-copy">
              <strong>{session.name || session.sessionId.slice(0, 8)}</strong>
              <small>
                {session.kind} · {session.status}
                {session.state ? ` · ${session.state}` : ''}
                {session.id ? ` · ${session.id}` : ''} · {session.cwd}
              </small>
            </div>
            <button
              type="button"
              className="mini-button"
              disabled={!session.id || busy === `logs-${session.id}`}
              onClick={() => void showLogs(session)}
            >
              日志
            </button>
            <button
              type="button"
              className="mini-button"
              disabled={!session.id || busy === `stop-${session.id}`}
              onClick={() => void stop(session)}
            >
              <Square size={11} /> 停止
            </button>
            <button
              type="button"
              className="mini-button"
              disabled={!session.id || busy === `remove-${session.id}`}
              onClick={() => void remove(session)}
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>

      {logs && (
        <div className="background-logs-wrap">
          <div className="background-list-head">
            <span className="settings-label">日志 · {logs.id}</span>
            <button type="button" className="mini-button" onClick={() => setLogs(null)}>
              关闭
            </button>
          </div>
          <pre className="background-logs">{logs.text || '（暂无日志）'}</pre>
        </div>
      )}

      <p className="settings-note">
        后台会话由本地引擎管理，关闭面板后继续运行。云端会话需要 Anthropic 账号，当前供应商下通常不可用。
      </p>
    </div>
  )
}
