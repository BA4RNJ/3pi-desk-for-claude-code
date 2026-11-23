import { FileText, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ContentSearchMatch, FileEntry } from '../../../shared/types'

type SearchMode = 'content' | 'files'

interface WorkspaceSearchDialogProps {
  cwd: string
  initialMode?: SearchMode
  onOpenFile: (path: string, line?: number) => void
  onClose: () => void
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function WorkspaceSearchDialog({
  cwd,
  initialMode = 'content',
  onOpenFile,
  onClose
}: WorkspaceSearchDialogProps) {
  const [mode, setMode] = useState<SearchMode>(initialMode)
  const [query, setQuery] = useState('')
  const [contentResults, setContentResults] = useState<ContentSearchMatch[]>([])
  const [fileResults, setFileResults] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    inputRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const term = query.trim()
    if (!term) {
      setContentResults([])
      setFileResults([])
      setLoading(false)
      setError('')
      return
    }
    let disposed = false
    setLoading(true)
    setError('')
    const timer = window.setTimeout(() => {
      const request =
        mode === 'content'
          ? window.desk.searchContent(cwd, term, 200)
          : window.desk.searchFiles(cwd, term)
      request
        .then((results) => {
          if (disposed) return
          if (mode === 'content') setContentResults(results as ContentSearchMatch[])
          else setFileResults(results as FileEntry[])
        })
        .catch((searchError) => {
          if (!disposed) setError(errorText(searchError))
        })
        .finally(() => {
          if (!disposed) setLoading(false)
        })
    }, 180)
    return () => {
      disposed = true
      window.clearTimeout(timer)
    }
  }, [cwd, mode, query])

  const results = mode === 'content' ? contentResults : fileResults

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="dialog workspace-search-dialog" role="dialog" aria-modal="true" aria-label="搜索工作区">
        <button type="button" className="dialog-close" onClick={onClose} aria-label="关闭">
          <X size={16} />
        </button>
        <h2 className="workspace-search-title">
          <Search size={17} /> 搜索工作区
        </h2>
        <div className="workspace-search-controls">
          <input
            ref={inputRef}
            className="text-input"
            value={query}
            placeholder={mode === 'content' ? '搜索文件内容…' : '搜索文件名…'}
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && results.length > 0) {
                const first = results[0]
                if (mode === 'content') {
                  const match = first as ContentSearchMatch
                  onOpenFile(match.path, match.line)
                } else {
                  onOpenFile((first as FileEntry).path)
                }
                onClose()
              }
            }}
          />
          <div className="segmented">
            <button
              type="button"
              className={`segment ${mode === 'content' ? 'is-active' : ''}`}
              onClick={() => setMode('content')}
            >
              内容
            </button>
            <button
              type="button"
              className={`segment ${mode === 'files' ? 'is-active' : ''}`}
              onClick={() => setMode('files')}
            >
              文件名
            </button>
          </div>
        </div>
        {error && <div className="settings-error">{error}</div>}
        <div className="workspace-search-results">
          {!query.trim() && <p className="settings-empty">输入关键词开始搜索。</p>}
          {loading && <p className="settings-empty">正在搜索…</p>}
          {!loading && query.trim() && results.length === 0 && !error && (
            <p className="settings-empty">没有匹配结果。</p>
          )}
          {mode === 'content' &&
            !loading &&
            contentResults.map((match, index) => (
              <button
                key={`${match.path}-${match.line}-${index}`}
                type="button"
                className="workspace-search-result"
                onClick={() => {
                  onOpenFile(match.path, match.line)
                  onClose()
                }}
              >
                <span className="workspace-search-result-head">
                  <FileText size={13} />
                  <strong>{match.relativePath}</strong>
                  <em>
                    {match.line}:{match.column}
                  </em>
                </span>
                <span className="workspace-search-result-preview">{match.preview}</span>
              </button>
            ))}
          {mode === 'files' &&
            !loading &&
            fileResults.map((file) => (
              <button
                key={file.path}
                type="button"
                className="workspace-search-result"
                onClick={() => {
                  onOpenFile(file.path)
                  onClose()
                }}
              >
                <span className="workspace-search-result-head">
                  <FileText size={13} />
                  <strong>{file.relativePath}</strong>
                </span>
              </button>
            ))}
        </div>
        <p className="settings-note">
          快捷键：Ctrl/Cmd + Shift + F 打开内容搜索，Ctrl/Cmd + P 打开文件名搜索。
        </p>
      </div>
    </div>
  )
}

export type { SearchMode }
