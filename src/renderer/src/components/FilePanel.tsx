import {
  ChevronRight,
  FileCode2,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  GitCommit,
  RefreshCw,
  Sparkles,
  X
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { FileNode, GitFileChange, GitStatusSnapshot } from '../../../shared/types'

interface FilePanelProps {
  cwd: string
  onOpenFile: (path: string, initialView?: 'edit' | 'diff') => void
  onSendPrompt?: (prompt: string) => void
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

export function FilePanel({ cwd, onOpenFile, onSendPrompt, onClose }: FilePanelProps) {
  const [mode, setMode] = useState<'tree' | 'git'>('tree')
  const [tree, setTree] = useState<FileNode[]>([])
  const [gitStatus, setGitStatus] = useState<GitStatusSnapshot | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!cwd) return
    setLoading(true)
    setError('')
    try {
      const [nodes, git] = await Promise.all([
        window.desk.fileTree(cwd),
        window.desk.gitStatus(cwd).catch(() => ({ isRepo: false, files: [] }))
      ])
      setTree(nodes)
      setGitStatus(git)
      setExpanded((prev) =>
        prev.size > 0
          ? prev
          : new Set(nodes.filter((node) => node.type === 'dir').map((node) => node.path))
      )
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

  const changedCount = gitStatus?.files.length || 0

  return (
    <aside className="file-panel">
      <div className="file-panel-head">
        <div className="file-panel-tabs">
          <button
            type="button"
            className={`file-panel-tab ${mode === 'tree' ? 'is-active' : ''}`}
            onClick={() => setMode('tree')}
          >
            文件
          </button>
          <button
            type="button"
            className={`file-panel-tab ${mode === 'git' ? 'is-active' : ''}`}
            onClick={() => setMode('git')}
          >
            <GitBranch size={12} />
            <span>Git 变更</span>
            {changedCount > 0 && <span className="git-badge">{changedCount}</span>}
          </button>
        </div>
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
        {gitStatus?.branch ? (
          <span>
            <GitBranch size={11} /> {gitStatus.branch} · {cwd}
          </span>
        ) : (
          cwd
        )}
      </div>

      {error && <div className="settings-error">{error}</div>}

      {mode === 'tree' ? (
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
              onOpenFile={(filePath) => onOpenFile(filePath, 'edit')}
            />
          ))}
        </div>
      ) : (
        <div className="file-tree git-changes-pane">
          {!gitStatus?.isRepo ? (
            <p className="settings-empty">当前目录不是 Git 仓库。</p>
          ) : gitStatus.files.length === 0 ? (
            <p className="settings-empty">工作区很干净，没有未提交的修改。</p>
          ) : (
            <>
              {onSendPrompt && (
                <div className="git-quick-actions">
                  <button
                    type="button"
                    className="mini-button"
                    onClick={() =>
                      onSendPrompt(
                        '请审查当前工作区所有未提交的 Git 改动（git status / git diff），指出潜在 Bug、遗漏的边界情况或可简化的代码。'
                      )
                    }
                  >
                    <Sparkles size={12} /> 审查未提交改动
                  </button>
                  <button
                    type="button"
                    className="mini-button"
                    onClick={() =>
                      onSendPrompt(
                        '请查看当前工作区的 Git 改动（git status / git diff），为我生成一条清晰、符合仓库风格的 Commit Message。'
                      )
                    }
                  >
                    <GitCommit size={12} /> 生成提交信息
                  </button>
                </div>
              )}
              {gitStatus.files.map((item: GitFileChange) => (
                <button
                  key={item.path}
                  type="button"
                  className="file-node file-file git-change-row"
                  onClick={() => onOpenFile(item.path, 'diff')}
                  title={`点击查看 Diff: ${item.path}`}
                >
                  <FileCode2 size={13} />
                  <span className="git-change-path">{item.path}</span>
                  <span className="git-change-meta">
                    {(item.additions !== undefined || item.deletions !== undefined) && (
                      <small className="git-numstat">
                        {item.additions ? `+${item.additions}` : ''}
                        {item.additions && item.deletions ? ' ' : ''}
                        {item.deletions ? `−${item.deletions}` : ''}
                      </small>
                    )}
                    <code className={`git-status-pill git-status-${item.status[0] || 'M'}`}>
                      {item.status}
                    </code>
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      <div className="file-panel-footer">
        {mode === 'tree'
          ? '点击文件预览；支持文本编辑与图片查看。'
          : '点击变更文件可直接查看 Git Diff 对比。'}
      </div>
    </aside>
  )
}
