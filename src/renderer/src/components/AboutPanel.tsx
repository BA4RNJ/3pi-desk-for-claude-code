import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  RefreshCw,
  Sparkles
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { BackupEntry, VersionInfo } from '../../../shared/types'

const UPDATE_COMMAND =
  'cd /path/to/3pi-desk-for-claude-code && npm install @anthropic-ai/claude-agent-sdk@latest && npm run package'

export function AboutPanel() {
  const [info, setInfo] = useState<VersionInfo | null>(null)
  const [checking, setChecking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [backups, setBackups] = useState<BackupEntry[]>([])
  const [backupBusy, setBackupBusy] = useState('')
  const [backupMessage, setBackupMessage] = useState('')
  const [backupPreview, setBackupPreview] = useState<{ name: string; text: string } | null>(
    null
  )

  const load = useCallback(async () => {
    setChecking(true)
    try {
      setInfo(await window.desk.versionInfo())
    } finally {
      setChecking(false)
    }
  }, [])

  const loadBackups = useCallback(async () => {
    try {
      setBackups(await window.desk.listBackups())
    } catch {
      setBackups([])
    }
  }, [])

  useEffect(() => {
    void load()
    void loadBackups()
  }, [load, loadBackups])

  const previewBackup = async (backup: BackupEntry): Promise<void> => {
    setBackupBusy(backup.name)
    setBackupMessage('')
    try {
      const text = await window.desk.readBackup(backup.name, 20_000)
      setBackupPreview({ name: backup.name, text })
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBackupBusy('')
    }
  }

  const exportBackup = async (backup: BackupEntry): Promise<void> => {
    setBackupBusy(backup.name)
    setBackupMessage('')
    try {
      const path = await window.desk.exportBackup(backup.name)
      if (path) setBackupMessage(`已导出到 ${path}`)
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBackupBusy('')
    }
  }

  const exportDiagnostics = async (): Promise<void> => {
    setBackupBusy('diagnostics')
    setBackupMessage('')
    try {
      const path = await window.desk.exportDiagnostics()
      if (path) setBackupMessage(`诊断日志已导出到 ${path}`)
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBackupBusy('')
    }
  }

  const formatSize = (size: number): string => {
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / 1024 / 1024).toFixed(1)} MB`
  }

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
  const hasAppUpdate = Boolean(
    info?.latestApp && info.app && info.latestApp !== info.app
  )

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
          <strong>
            {info?.app || '—'}
            {hasAppUpdate ? ` · 最新 ${info?.latestApp}` : info?.latestApp ? ' · 已是最新' : ''}
          </strong>
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
        {info?.releaseUrl && (
          <a
            className="button ghost"
            href={info.releaseUrl}
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: 'none' }}
          >
            <ExternalLink size={14} /> 查看 GitHub 发布页
          </a>
        )}
      </div>

      <div className="about-command">
        <code>{UPDATE_COMMAND}</code>
      </div>

      <div className="settings-group about-maintenance">
        <span className="settings-label">诊断与备份</span>
        <div className="settings-inline-actions">
          <button
            type="button"
            className="button ghost"
            disabled={backupBusy === 'diagnostics'}
            onClick={() => void exportDiagnostics()}
          >
            <FileText size={14} /> 导出诊断日志
          </button>
          <button
            type="button"
            className="button ghost"
            onClick={() => void window.desk.openBackupDir()}
          >
            <Download size={14} /> 打开备份目录
          </button>
          <button
            type="button"
            className="button ghost"
            onClick={() => void loadBackups()}
          >
            <RefreshCw size={14} /> 刷新备份
          </button>
        </div>

        <div className="backup-list">
          {backups.length === 0 && (
            <p className="settings-empty">还没有会话备份。删除会话时应用会先写入备份。</p>
          )}
          {backups.map((backup) => (
            <div className="backup-row" key={backup.name}>
              <div className="backup-copy">
                <strong>{backup.sessionId || backup.name}</strong>
                <small>
                  {new Date(backup.modifiedAt).toLocaleString()} · {formatSize(backup.size)}
                </small>
              </div>
              <button
                type="button"
                className="mini-button"
                disabled={Boolean(backupBusy)}
                onClick={() => void previewBackup(backup)}
              >
                预览
              </button>
              <button
                type="button"
                className="mini-button"
                disabled={Boolean(backupBusy)}
                onClick={() => void exportBackup(backup)}
              >
                {backupBusy === backup.name ? '导出中…' : '导出'}
              </button>
            </div>
          ))}
        </div>
        {backupPreview && (
          <div className="backup-preview">
            <div className="backup-preview-head">
              <strong>{backupPreview.name}</strong>
              <button
                type="button"
                className="mini-button"
                onClick={() => setBackupPreview(null)}
              >
                关闭
              </button>
            </div>
            <pre>{backupPreview.text}</pre>
          </div>
        )}
        {backupMessage && <div className="settings-message">{backupMessage}</div>}
        <p className="settings-note">
          备份仅包含 Claude Code 的会话记录，不会自动恢复或覆盖现有会话。诊断日志会自动脱敏常见的密钥格式。
        </p>
      </div>

      <p className="settings-note">
        当前是本地构建，未配置发布源，因此应用不会自动下载安装包。更新 SDK 后重新打包即可；Claude Code CLI 使用本机安装或按需下载。
      </p>
    </div>
  )
}
