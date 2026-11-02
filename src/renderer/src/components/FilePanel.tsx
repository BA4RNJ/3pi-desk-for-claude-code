import { ChevronRight, FileText, Folder, FolderOpen, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { FileNode } from '../../../shared/types'

interface FilePanelProps {
  cwd: string
  onOpenFile: (path: string) => void
  onClose: () => void
}

function TreeNode({
  node,
  depth,
  expanded,
  onToggle,
  onOpenFile
}: {
  node: FileNode
  depth: number
  expanded: Set<string>
  onToggle: (path: string) => void
  onOpenFile: (path: string) => void
}) {
  const isOpen = expanded.has(node.path)
  if (node.type === 'dir') {
    return (
      <>
        <button
          type="button"
          className="file-node file-dir"
          style={{ paddingLeft: `${8 + depth * 13}px` }}
          onClick={() => onToggle(node.path)}
        >
          <ChevronRight size={12} className={`file-chevron ${isOpen ? 'is-open' : ''}`} />
          {isOpen ? <FolderOpen size={14} /> : <Folder size={14} />}
          <span>{node.name}</span>
        </button>
        {isOpen &&
          node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onOpenFile={onOpenFile}
            />
          ))}
      </>
    )
  }
  return (
    <button
      type="button"
      className="file-node file-file"
      style={{ paddingLeft: `${8 + depth * 13 + 17}px` }}
      onClick={() => onOpenFile(node.path)}
      title={node.relativePath}
    >
      <FileText size={13} />
      <span>{node.name}</span>
    </button>
  )
}

export function FilePanel({ cwd, onOpenFile, onClose }: FilePanelProps) {
  const [tree, setTree] = useState<FileNode[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!cwd) return
    setLoading(true)
    setError('')
    try {
      const nodes = await window.desk.fileTree(cwd)
      setTree(nodes)
      setExpanded(new Set(nodes.filter((node) => node.type === 'dir').map((node) => node.path)))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }, [cwd])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = (path: string): void => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  return (
    <aside className="file-panel">
      <div className="file-panel-head">
        <strong>文件</strong>
        <div>
          <button
            type="button"
            className="icon-button"
            onClick={() => void load()}
            title="刷新文件树"
            aria-label="刷新文件树"
          >
            <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            title="关闭文件面板"
            aria-label="关闭文件面板"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="file-panel-path" title={cwd}>
        {cwd}
      </div>
      {error && <div className="settings-error">{error}</div>}
      <div className="file-tree">
        {tree.length === 0 && !loading && (
          <p className="settings-empty">目录为空，或没有可显示的文件。</p>
        )}
        {tree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            expanded={expanded}
            onToggle={toggle}
            onOpenFile={onOpenFile}
          />
        ))}
      </div>
      <div className="file-panel-footer">点击文件预览；支持文本编辑与图片查看。</div>
    </aside>
  )
}
