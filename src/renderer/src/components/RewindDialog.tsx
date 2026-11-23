import { AlertTriangle, ChevronDown, ChevronRight, FileCode2, RotateCcw, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { RewindPreview } from '../../../shared/types'
import type { UIMessage } from '../types'
import { DiffView } from './DiffView'

interface RewindDialogProps {
  messageId: string
  cwd?: string
  messages?: UIMessage[]
  onPreview: (messageId: string) => Promise<RewindPreview>
  onApply: (messageId: string) => Promise<RewindPreview>
  onClose: () => void
}

interface TurnFileDiff {
  path: string
  before: string
  after: string
}

function collectEditsSinceMessage(
  messages: UIMessage[],
  rewindMessageId: string,
  cwd?: string
): TurnFileDiff[] {
  const startIdx = messages.findIndex(
    (msg) =>
      msg.role === 'user' && (msg.rewindId === rewindMessageId || msg.id === rewindMessageId)
  )
  const slice = startIdx >= 0 ? messages.slice(startIdx) : messages
  const byFile = new Map<string, { before: string; after: string }>()
  const prefix = cwd ? (cwd.endsWith('/') ? cwd : `${cwd}/`) : ''

  for (const msg of slice) {
    if (msg.role !== 'assistant') continue
    for (const block of msg.blocks) {
      if (block.kind !== 'tool') continue
      const rawPath =
        typeof block.input.file_path === 'string'
          ? block.input.file_path
          : typeof block.input.path === 'string'
            ? block.input.path
            : ''
      if (!rawPath) continue
      const normPath = prefix && rawPath.startsWith(prefix) ? rawPath.slice(prefix.length) : rawPath
      if (block.name === 'Edit' || block.name === 'MultiEdit') {
        const oldStr = typeof block.input.old_string === 'string' ? block.input.old_string : ''
        const newStr = typeof block.input.new_string === 'string' ? block.input.new_string : ''
        const prev = byFile.get(normPath)
        byFile.set(normPath, {
          before: prev ? `${prev.before}\n---\n${oldStr}` : oldStr,
          after: prev ? `${prev.after}\n---\n${newStr}` : newStr
        })
      } else if (block.name === 'Write') {
        const content = typeof block.input.content === 'string' ? block.input.content : ''
        const prev = byFile.get(normPath)
        byFile.set(normPath, {
          before: prev?.before || '',
          after: content
        })
      }
    }
  }

  return [...byFile.entries()].map(([path, item]) => ({
    path,
    before: item.before,
    after: item.after
  }))
}

export function RewindDialog({
  messageId,
  cwd,
  messages = [],
  onPreview,
  onApply,
  onClose
}: RewindDialogProps) {
  const [preview, setPreview] = useState<RewindPreview | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [gitDiff, setGitDiff] = useState<{ before: string; after: string } | null>(null)
  const [error, setError] = useState('')
  const [applying, setApplying] = useState(false)

  const recordedEdits = useMemo(
    () => collectEditsSinceMessage(messages, messageId, cwd),
    [cwd, messageId, messages]
  )

  useEffect(() => {
    let disposed = false
    onPreview(messageId)
      .then((result) => {
        if (!disposed) {
          setPreview(result)
          const first = result.filesChanged?.[0] || recordedEdits[0]?.path || null
          setSelectedFile(first)
        }
      })
      .catch((previewError) => {
        if (!disposed) {
          setError(previewError instanceof Error ? previewError.message : String(previewError))
        }
      })
    return () => {
      disposed = true
    }
  }, [messageId, onPreview, recordedEdits])

  useEffect(() => {
    if (!selectedFile || !cwd) {
      setGitDiff(null)
      return
    }
    const recorded = recordedEdits.find(
      (item) => item.path === selectedFile || selectedFile.endsWith(item.path)
    )
    if (recorded) {
      // Replay reverses the change: current (after) -> checkpoint (before)
      setGitDiff({ before: recorded.after, after: recorded.before })
      return
    }
    let disposed = false
    window.desk
      .gitDiff(cwd, selectedFile)
      .then((diff) => {
        if (!disposed && (diff.before || diff.after)) {
          setGitDiff({ before: diff.after, after: diff.before })
        }
      })
      .catch(() => {
        if (!disposed) setGitDiff(null)
      })
    return () => {
      disposed = true
    }
  }, [cwd, recordedEdits, selectedFile])

  const apply = async (): Promise<void> => {
    setApplying(true)
    setError('')
    try {
      const result = await onApply(messageId)
      if (!result.canRewind) {
        setError(result.error || '回滚失败')
        setApplying(false)
        return
      }
      onClose()
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : String(applyError))
      setApplying(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="dialog rewind-dialog" role="dialog" aria-modal="true" aria-label="恢复文件">
        <button type="button" className="dialog-close" onClick={onClose} aria-label="关闭">
          <X size={16} />
        </button>
        <div className="permission-header">
          <span className="permission-icon">
            <RotateCcw size={20} />
          </span>
          <div>
            <h2>恢复文件到此消息</h2>
            <p>把助手在该消息之后修改的文件恢复到当时的状态。</p>
          </div>
        </div>

        {!preview && !error && (
          <div className="history-loading">
            <span className="spinner" /> 正在检查文件检查点…
          </div>
        )}

        {error && (
          <div className="settings-error">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {preview && (
          <>
            {preview.canRewind ? (
              <div className="rewind-summary">
                <strong>
                  {preview.filesChanged?.length ?? 0} 个文件将被恢复
                </strong>
                <span>
                  约 +{preview.insertions ?? 0} / −{preview.deletions ?? 0} 行
                  {preview.skippedLinks ? ` · ${preview.skippedLinks} 个链接文件被跳过` : ''}
                </span>
              </div>
            ) : (
              <div className="settings-error">{preview.error || '这个检查点不可用'}</div>
            )}

            {preview.filesChanged && preview.filesChanged.length > 0 && (
              <div className="rewind-files">
                <p className="settings-note" style={{ margin: '0 0 6px' }}>
                  点击下方文件名可预览恢复前后的代码差异：
                </p>
                {preview.filesChanged.slice(0, 30).map((file) => {
                  const isSelected = selectedFile === file
                  return (
                    <div key={file} className="rewind-file-item">
                      <button
                        type="button"
                        className={`rewind-file-button ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => setSelectedFile(isSelected ? null : file)}
                      >
                        {isSelected ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        <FileCode2 size={13} />
                        <code>{file}</code>
                      </button>
                      {isSelected && gitDiff && (
                        <div className="rewind-diff-box">
                          <DiffView before={gitDiff.before} after={gitDiff.after} compact />
                        </div>
                      )}
                    </div>
                  )
                })}
                {preview.filesChanged.length > 30 && (
                  <small>还有 {preview.filesChanged.length - 30} 个文件…</small>
                )}
              </div>
            )}

            <p className="settings-note">
              只恢复会话记录的文件编辑；Bash 命令、git 操作、依赖安装等外部副作用不会被撤销。
            </p>

            <div className="dialog-actions">
              <button type="button" className="button ghost" onClick={onClose}>
                取消
              </button>
              <button
                type="button"
                className="button primary"
                disabled={!preview.canRewind || applying}
                onClick={() => void apply()}
              >
                {applying ? '正在恢复…' : '恢复文件'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
