import { useEffect, useRef, useState } from 'react'
import type { SessionInfo } from '../../../shared/types'

interface TagDialogProps {
  session: SessionInfo
  onSave: (tag: string | null) => void
  onClose: () => void
}

export function TagDialog({ session, onSave, onClose }: TagDialogProps) {
  const [value, setValue] = useState(session.tag || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const save = (): void => {
    onSave(value.trim() || null)
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="dialog rename-dialog" role="dialog" aria-modal="true" aria-label="设置标签">
        <h2>设置会话标签</h2>
        <input
          ref={inputRef}
          className="text-input"
          value={value}
          maxLength={40}
          placeholder="例如：重要、待跟进、实验"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              save()
            }
          }}
        />
        <div className="dialog-actions">
          <button type="button" className="button ghost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="button primary" onClick={save}>
            保存标签
          </button>
        </div>
      </div>
    </div>
  )
}
