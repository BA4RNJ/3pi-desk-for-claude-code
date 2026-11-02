import { AlertTriangle, RotateCcw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { RewindPreview } from '../../../shared/types'

interface RewindDialogProps {
  messageId: string
  onPreview: (messageId: string) => Promise<RewindPreview>
  onApply: (messageId: string) => Promise<RewindPreview>
  onClose: () => void
}

export function RewindDialog({
  messageId,
  onPreview,
  onApply,
  onClose
}: RewindDialogProps) {
  const [preview, setPreview] = useState<RewindPreview | null>(null)
  const [error, setError] = useState('')
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    let disposed = false
    onPreview(messageId)
      .then((result) => {
        if (!disposed) setPreview(result)
      })
      .catch((previewError) => {
        if (!disposed) {
          setError(previewError instanceof Error ? previewError.message : String(previewError))
        }
      })
    return () => {
      disposed = true
    }
  }, [messageId, onPreview])

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
                {preview.filesChanged.slice(0, 30).map((file) => (
                  <code key={file}>{file}</code>
                ))}
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
