import { useEffect, useRef, useState } from 'react'
import type { SessionInfo } from '../../../shared/types'

interface RenameDialogProps {
  session: SessionInfo
  onSave: (title: string) => void
  onClose: () => void
}

export function RenameDialog({ session, onSave, onClose }: RenameDialogProps) {
  const [value, setValue] = useState(session.customTitle || session.summary || '')
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
    const title = value.trim()
    if (!title) return
    onSave(title)
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="dialog rename-dialog" role="dialog" aria-modal="true" aria-label="重命名会话">
        <h2>重命名会话</h2>
        <input
          ref={inputRef}
          className="text-input"
          value={value}
          maxLength={80}
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
          <button type="button" className="button primary" disabled={!value.trim()} onClick={save}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
