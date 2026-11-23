import { ExternalLink, FileCode2, FileText, Save, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FileContent, GitDiffResult } from '../../../shared/types'
import { DiffView } from './DiffView'

interface FilePreviewDialogProps {
  cwd: string
  path: string
  line?: number
  initialView?: 'edit' | 'diff'
  onClose: () => void
}

function sizeLabel(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function toRelativePath(cwd: string, target: string): string {
  if (!target.startsWith('/')) return target
  const prefix = cwd.endsWith('/') ? cwd : `${cwd}/`
  return target.startsWith(prefix) ? target.slice(prefix.length) : target
}

export function FilePreviewDialog({
  cwd,
  path,
  line,
  initialView = 'edit',
  onClose
}: FilePreviewDialogProps) {
  const [viewMode, setViewMode] = useState<'edit' | 'diff'>(initialView)
  const [content, setContent] = useState<FileContent | null>(null)
  const [gitDiff, setGitDiff] = useState<GitDiffResult | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const jumpedTo = useRef('')

  useEffect(() => {
    setViewMode(initialView)
  }, [initialView, path])

  useEffect(() => {
    let disposed = false
    const rel = toRelativePath(cwd, path)
    Promise.all([
      window.desk.readFile(cwd, path).catch(() => null),
      window.desk.gitDiff(cwd, rel).catch(() => null)
    ]).then(([file, diff]) => {
      if (disposed) return
      if (file) {
        setContent(file)
        if (file.kind === 'text') setText(file.text || '')
      } else if (diff && (diff.before || diff.patch)) {
        // Deleted file in Git working tree: still show its Git diff
        setContent({
          kind: 'text',
          path,
          text: '',
          size: 0
        })
        setText('')
      } else {
        setError('无法读取该文件。')
      }
      setGitDiff(diff)
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

  useEffect(() => {
    if (!line || content?.kind !== 'text' || viewMode !== 'edit') return
    const key = `${path}:${line}`
    if (jumpedTo.current === key) return
    const textarea = textareaRef.current
    if (!textarea) return
    jumpedTo.current = key
    const lines = text.split('\n')
    const target = Math.max(1, Math.min(line, lines.length))
    const offset = lines.slice(0, target - 1).reduce((sum, item) => sum + item.length + 1, 0)
    textarea.focus()
    textarea.setSelectionRange(offset, offset + (lines[target - 1]?.length || 0))
  }, [content, line, path, text, viewMode])

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

  const hasGitChanges = Boolean(
    gitDiff && (gitDiff.patch.trim().length > 0 || gitDiff.before !== text)
  )

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="dialog file-preview-dialog" role="dialog" aria-modal="true" aria-label="文件预览">
        <button type="button" className="dialog-close" onClick={onClose} aria-label="关闭">
          <X size={16} />
        </button>
        <div className="file-preview-header-row">
          <div>
            <h2 className="file-preview-title">{path.split('/').at(-1)}</h2>
            <p className="settings-page-sub file-preview-path" title={path}>
              {path}
              {content ? ` · ${sizeLabel(content.size)}` : ''}
            </p>
          </div>
          {content?.kind === 'text' && (hasGitChanges || viewMode === 'diff') && (
            <div className="file-preview-tabs">
              <button
                type="button"
                className={`file-panel-tab ${viewMode === 'edit' ? 'is-active' : ''}`}
                onClick={() => setViewMode('edit')}
              >
                <FileText size={13} /> 编辑
              </button>
              <button
                type="button"
                className={`file-panel-tab ${viewMode === 'diff' ? 'is-active' : ''}`}
                onClick={() => setViewMode('diff')}
              >
                <FileCode2 size={13} /> Git Diff
              </button>
            </div>
          )}
        </div>

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

        {content?.kind === 'text' && viewMode === 'edit' && (
          <textarea
            ref={textareaRef}
            className="config-editor file-text-editor"
            value={text}
            spellCheck={false}
            onChange={(event) => {
              setText(event.target.value)
              setMessage('')
            }}
          />
        )}

        {content?.kind === 'text' && viewMode === 'diff' && (
          <div className="file-diff-container">
            <DiffView before={gitDiff?.before || ''} after={text} />
          </div>
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
          {content?.kind === 'text' && viewMode === 'edit' && (
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
