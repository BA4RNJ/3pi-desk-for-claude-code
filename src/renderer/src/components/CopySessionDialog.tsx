import { FolderOpen, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { SessionCopyMode, SessionInfo } from '../../../shared/types'
import { basename } from '../lib/format'

interface CopySessionDialogProps {
  session: SessionInfo
  workspaces: string[]
  currentCwd: string
  onCopy: (targetCwd: string, mode: SessionCopyMode) => Promise<void>
  onClose: () => void
}

export function CopySessionDialog({
  session,
  workspaces,
  currentCwd,
  onCopy,
  onClose
}: CopySessionDialogProps) {
  const choices = useMemo(() => {
    const source = session.cwd || currentCwd
    return [source, ...workspaces].filter(
      (path, index, list) => Boolean(path) && list.indexOf(path) === index
    )
  }, [currentCwd, session.cwd, workspaces])
  const [target, setTarget] = useState(choices[0] || currentCwd)
  const [busy, setBusy] = useState<SessionCopyMode | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const chooseFolder = async (): Promise<void> => {
    const directory = await window.desk.pickDirectory(target)
    if (directory) setTarget(directory)
  }

  const run = async (mode: SessionCopyMode): Promise<void> => {
    setBusy(mode)
    setError('')
    try {
      await onCopy(target, mode)
      onClose()
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : String(copyError))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="dialog copy-session-dialog" role="dialog" aria-modal="true" aria-label="复制或迁移会话">
        <button type="button" className="dialog-close" onClick={onClose} aria-label="关闭">
          <X size={16} />
        </button>
        <h2>复制 / 迁移会话</h2>
        <p className="settings-page-sub">
          「复制」会生成一个独立的新会话；「迁移」会在目标项目生成新会话，并把原会话从列表中隐藏（原记录仍保留在本机）。
        </p>

        <div className="copy-session-source">
          <span>当前会话</span>
          <strong data-i18n-skip>
            {session.customTitle || session.summary || session.firstPrompt || '未命名会话'}
          </strong>
        </div>

        <label className="copy-session-field">
          <span>目标项目</span>
          <select
            className="text-input"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          >
            {choices.map((path) => (
              <option key={path} value={path}>
                {basename(path)} — {path}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="mini-button" onClick={() => void chooseFolder()}>
          <FolderOpen size={12} /> 选择其他文件夹
        </button>

        {error && <div className="settings-error">{error}</div>}

        <div className="dialog-actions">
          <button type="button" className="button ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={Boolean(busy) || target === (session.cwd || currentCwd)}
            onClick={() => void run('move')}
          >
            {busy === 'move' ? '迁移中…' : '迁移到目标项目'}
          </button>
          <button
            type="button"
            className="button primary"
            disabled={Boolean(busy)}
            onClick={() => void run('copy')}
          >
            {busy === 'copy' ? '复制中…' : '复制为独立会话'}
          </button>
        </div>
      </div>
    </div>
  )
}
