import { CheckCircle2, Copy, RefreshCw, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { VersionInfo } from '../../../shared/types'

const UPDATE_COMMAND =
  'cd /path/to/3pi-desk-for-claude-code && npm install @anthropic-ai/claude-agent-sdk@latest && npm run package'

export function AboutPanel() {
  const [info, setInfo] = useState<VersionInfo | null>(null)
  const [checking, setChecking] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setChecking(true)
    try {
      setInfo(await window.desk.versionInfo())
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(UPDATE_COMMAND)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  const hasUpdate = Boolean(info?.latestSdk && info.latestSdk !== info.sdk)

  return (
    <div className="about-panel">
      <div className="about-mark">
        <Sparkles size={24} />
      </div>
      <div>
        <h4>3PI Desk</h4>
        <p>本地 AI 编程图形界面，基于 Agent SDK 运行。</p>
        <p>Powered by BA4RNJ · macOS rebuild and maintained by ELT Group</p>
      </div>

      <div className="settings-rows">
        <div className="settings-row">
          <span>应用版本</span>
          <strong>{info?.app || '—'}</strong>
        </div>
        <div className="settings-row">
          <span>Agent SDK</span>
          <strong>{info?.sdk || '—'}</strong>
        </div>
        <div className="settings-row">
          <span>内置引擎</span>
          <strong>{info?.claudeCode || '—'}</strong>
        </div>
        <div className="settings-row">
          <span>Electron / Node</span>
          <strong>
            {info ? `${info.electron} / ${info.node}` : '—'}
          </strong>
        </div>
        <div className="settings-row">
          <span>最新 SDK</span>
          <strong>
            {info?.latestSdk || '检查失败'}
            {hasUpdate ? ' · 有新版本' : info?.latestSdk ? ' · 已是最新' : ''}
          </strong>
        </div>
      </div>

      <div className="settings-inline-actions">
        <button
          type="button"
          className="button ghost"
          disabled={checking}
          onClick={() => void load()}
        >
          <RefreshCw size={14} className={checking ? 'spin-icon' : ''} /> 检查更新
        </button>
        <button type="button" className="button ghost" onClick={() => void copy()}>
          {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
          {copied ? '已复制' : '复制更新命令'}
        </button>
      </div>

      <div className="about-command">
        <code>{UPDATE_COMMAND}</code>
      </div>

      <p className="settings-note">
        当前是本地构建，未配置发布源，因此应用不会自动下载安装包。更新 SDK 后重新打包即可；引擎版本由 SDK 内置。
      </p>
    </div>
  )
}
