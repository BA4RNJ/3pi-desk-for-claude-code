import { Download, FolderOpen, RefreshCw, Settings } from 'lucide-react'
import { useState } from 'react'
import type { ClaudeCliStatus } from '../../../shared/types'

interface ClaudeCliBannerProps {
  status: ClaudeCliStatus | null
  onDownload: () => Promise<ClaudeCliStatus>
  onPick: () => Promise<ClaudeCliStatus | null>
  onRefresh: () => Promise<ClaudeCliStatus>
  onOpenSettings: () => void
}

function formatBytes(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value) || value <= 0) return '—'
  return `${Math.round(value / (1024 * 1024))} MB`
}

export function ClaudeCliBanner({
  status,
  onDownload,
  onPick,
  onRefresh,
  onOpenSettings
}: ClaudeCliBannerProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!status || (status.source !== 'missing' && !status.downloading)) return null

  const progress = status.progress
  const percent =
    progress?.total && progress.total > 0
      ? Math.min(100, Math.round((progress.received / progress.total) * 100))
      : null
  const downloading = status.downloading || busy

  const run = async (action: () => Promise<unknown>): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : String(actionError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cli-banner" role="status">
      <div className="cli-banner-icon" aria-hidden="true">
        <Download size={18} />
      </div>
      <div className="cli-banner-body">
        <strong>
          {downloading
            ? progress?.phase === 'extract'
              ? '正在解压 CLI…'
              : '正在下载 CLI…'
            : '未找到 Claude Code CLI'}
        </strong>
        {downloading ? (
          <div className="cli-progress">
            <div className="cli-progress-track">
              <div
                className="cli-progress-value"
                style={{ width: percent != null ? `${percent}%` : '35%' }}
              />
            </div>
            <span className="cli-progress-text">
              {formatBytes(progress?.received)}
              {progress?.total ? ` / ${formatBytes(progress.total)}` : ''}
            </span>
          </div>
        ) : (
          <p>聊天需要 Claude Code CLI。可以下载官方 CLI（约 146 MB），或选择本机已安装的 claude。</p>
        )}
        {error && <p className="cli-banner-error">{error}</p>}
      </div>
      {!downloading && (
        <div className="cli-banner-actions">
          <button
            type="button"
            className="button primary"
            disabled={busy}
            onClick={() => void run(onDownload)}
          >
            <Download size={14} /> 下载 CLI
          </button>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => void run(onPick)}
          >
            <FolderOpen size={14} /> 选择已有安装
          </button>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => void run(onRefresh)}
          >
            <RefreshCw size={14} /> 重新检测
          </button>
          <button type="button" className="button" onClick={onOpenSettings}>
            <Settings size={14} /> 设置
          </button>
        </div>
      )}
    </div>
  )
}
