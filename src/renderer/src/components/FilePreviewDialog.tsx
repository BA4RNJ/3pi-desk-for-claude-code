import { ExternalLink, Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FileContent } from '../../../shared/types'

interface FilePreviewDialogProps {
  cwd: string
  path: string
  onClose: () => void
}

function sizeLabel(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export function FilePreviewDialog({ cwd, path, onClose }: FilePreviewDialogProps) {
  const [content, setContent] = useState<FileContent | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let disposed = false
    window.desk
      .readFile(cwd, path)
      .then((file) => {
        if (disposed) return
        setContent(file)
        if (file.kind === 'text') setText(file.text || '')
      })
      .catch((readError) => {
        if (!disposed) {
          setError(readError instanceof Error ? readError.message : String(readError))
        }
      })
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      disposed = true
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [cwd, path, onClose])

  const save = async (): Promise<void> => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await window.desk.writeFile(cwd, path, text)
      setMessage('已保存')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="dialog file-preview-dialog" role="dialog" aria-modal="true" aria-label="文件预览">
        <button type="button" className="dialog-close" onClick={onClose} aria-label="关闭">
          <X size={16} />
        </button>
        <h2 className="file-preview-title">{path.split('/').at(-1)}</h2>
        <p className="settings-page-sub file-preview-path" title={path}>
          {path}
          {content ? ` · ${sizeLabel(content.size)}` : ''}
        </p>

        {error && <div className="settings-error">{error}</div>}
        {!content && !error && (
          <div className="history-loading">
            <span className="spinner" /> 正在读取文件…
          </div>
        )}

        {content?.kind === 'image' && (
          <div className="file-image-preview">
            <img src={content.dataUrl} alt={path} />
          </div>
        )}

        {content?.kind === 'binary' && (
          <p className="settings-empty">这是二进制文件，无法在面板中预览。</p>
        )}

        {content?.kind === 'text' && (
          <textarea
            className="config-editor file-text-editor"
            value={text}
            spellCheck={false}
            onChange={(event) => {
              setText(event.target.value)
              setMessage('')
            }}
          />
        )}

        {message && <div className="settings-message">{message}</div>}

        <div className="dialog-actions">
          <button
            type="button"
            className="button ghost"
            onClick={() => void window.desk.openPath(path)}
          >
            <ExternalLink size={14} /> 在系统中打开
          </button>
          {content?.kind === 'text' && (
            <button
              type="button"
              className="button primary"
              disabled={saving}
              onClick={() => void save()}
            >
              <Save size={14} /> 保存文件
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
