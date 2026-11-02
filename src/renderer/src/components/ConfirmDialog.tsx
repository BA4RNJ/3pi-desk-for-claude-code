import { X } from 'lucide-react'
import { useEffect } from 'react'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = '确认',
  danger,
  onConfirm,
  onClose
}: ConfirmDialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="dialog confirm-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <button type="button" className="dialog-close" onClick={onClose} aria-label="关闭">
          <X size={16} />
        </button>
        <h2>{title}</h2>
        <p className="settings-page-sub">{message}</p>
        <div className="dialog-actions">
          <button type="button" className="button ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className={`button ${danger ? 'danger-button' : 'primary'}`}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
