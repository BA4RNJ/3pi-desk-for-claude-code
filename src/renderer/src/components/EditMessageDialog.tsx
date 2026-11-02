import { useEffect, useRef, useState } from 'react'
import type { UserMessage } from '../types'

interface EditMessageDialogProps {
  message: UserMessage
  onSave: (text: string) => void
  onClose: () => void
}

export function EditMessageDialog({ message, onSave, onClose }: EditMessageDialogProps) {
  const [value, setValue] = useState(message.text)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.setSelectionRange(value.length, value.length)
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, value.length])

  const save = (): void => {
    const text = value.trim()
    if (!text) return
    onSave(text)
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="dialog edit-message-dialog" role="dialog" aria-modal="true" aria-label="编辑消息">
        <h2>编辑并重发</h2>
        <p className="settings-page-sub">
          会从这条消息之前创建一个分支，然后发送修改后的内容。
        </p>
        <textarea
          ref={ref}
          className="config-editor edit-message-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
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
            重发
          </button>
        </div>
      </div>
    </div>
  )
}
