import { FolderOpen, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { basename, relativeTime } from '../lib/format'

interface WorkspaceManagerProps {
  currentCwd: string
  workspaces: string[]
  onOpen: (path: string) => void
  onAdd: () => void
  onRemove: (path: string) => void
  onOpenBackups: () => void
  onClose: () => void
}

interface WorkspaceInfo {
  count: number
  lastModified?: number
}

export function WorkspaceManager({
  currentCwd,
  workspaces,
  onOpen,
  onAdd,
  onRemove,
  onOpenBackups,
  onClose
}: WorkspaceManagerProps) {
  const [info, setInfo] = useState<Record<string, WorkspaceInfo>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let disposed = false
    setLoading(true)
    Promise.all(
      workspaces.map(async (path) => {
        try {
          const sessions = await window.desk.listSessions(path)
          return [
            path,
            {
              count: sessions.length,
              lastModified: sessions[0]?.lastModified
            }
          ] as const
        } catch {
          return [path, { count: 0 }] as const
        }
      })
    )
      .then((entries) => {
        if (disposed) return
        setInfo(Object.fromEntries(entries))
      })
      .finally(() => {
        if (!disposed) setLoading(false)
      })
    return () => {
      disposed = true
    }
  }, [workspaces])

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="dialog workspace-dialog" role="dialog" aria-modal="true" aria-label="工作区">
        <button type="button" className="dialog-close" onClick={onClose} aria-label="关闭">
          <X size={16} />
        </button>
        <h2>工作区</h2>
        <p className="settings-page-sub">
          对话归属于工作区。打开一个工作区即可查看它的会话，切换工作区不会影响其他标签中的对话。
        </p>

        <div className="workspace-actions">
          <button type="button" className="button primary" onClick={onAdd}>
            <Plus size={14} /> 添加工作区
          </button>
          {loading && <span className="spinner" />}
        </div>

        <div className="workspace-list">
          {workspaces.length === 0 && (
            <p className="settings-empty">还没有工作区。添加一个项目文件夹开始。</p>
          )}
          {workspaces.map((path) => {
            const current = path === currentCwd
            const details = info[path]
            return (
              <div key={path} className={`workspace-card ${current ? 'is-current' : ''}`}>
                <span className="workspace-icon">
                  <FolderOpen size={18} />
                </span>
                <div className="workspace-copy">
                  <div className="workspace-name">
                    <strong>{basename(path)}</strong>
                    {current && <span className="workspace-current">当前</span>}
                  </div>
                  <small title={path}>{path}</small>
                  <em>
                    {details ? `${details.count} 个会话` : '正在读取…'}
                    {details?.lastModified
                      ? ` · 最近 ${relativeTime(details.lastModified)}`
                      : ''}
                  </em>
                </div>
                <div className="workspace-card-actions">
                  <button
                    type="button"
                    className="mini-button"
                    onClick={() => onOpen(path)}
                  >
                    打开
                  </button>
                  {!current && (
                    <button
                      type="button"
                      className="icon-button"
                      title="从常用工作区移除"
                      aria-label="从常用工作区移除"
                      onClick={() => onRemove(path)}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <p className="settings-note workspace-safety">
          会话由本地引擎持久化在本机。应用不会自动删除会话；从界面删除会话会先确认，并保留一份本地备份。
        </p>
        <div className="workspace-actions">
          <button type="button" className="mini-button" onClick={onOpenBackups}>
            打开备份目录
          </button>
        </div>
      </div>
    </div>
  )
}
