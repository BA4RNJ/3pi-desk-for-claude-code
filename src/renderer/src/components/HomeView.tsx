import {
  BookOpen,
  Briefcase,
  ChevronRight,
  Code2,
  Cpu,
  Database,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Gamepad2,
  Globe,
  Heart,
  Layers,
  Pencil,
  Plus,
  Rocket,
  Search,
  Shield,
  Sparkles,
  Star,
  Terminal,
  Trash2,
  Wrench,
  X
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react'
import type {
  PreferencesPatch,
  ProjectFolder,
  ProjectFolderIcon
} from '../../../shared/types'
import { basename, relativeTime } from '../lib/format'
import { newId } from '../lib/messages'

interface HomeViewProps {
  workspaces: string[]
  projectFolders: ProjectFolder[]
  workspaceFolderMap: Record<string, string>
  hiddenSessions: string[]
  currentCwd: string
  bootError?: string
  onOpenProject: (path: string) => void
  onAddProject: (folderId?: string | null) => void
  onRemoveProject: (path: string) => void
  onSavePreferences: (patch: PreferencesPatch) => Promise<unknown>
  onOpenBackups: () => void
}

interface WorkspaceInfo {
  count: number
  lastModified?: number
}

const FOLDER_ICONS: Array<{
  id: ProjectFolderIcon
  label: string
  Icon: ComponentType<{ size?: number }>
}> = [
  { id: 'folder', label: '文件夹', Icon: Folder },
  { id: 'code', label: '代码', Icon: Code2 },
  { id: 'terminal', label: '终端', Icon: Terminal },
  { id: 'briefcase', label: '工作', Icon: Briefcase },
  { id: 'book', label: '文档', Icon: BookOpen },
  { id: 'globe', label: 'Web', Icon: Globe },
  { id: 'cpu', label: '系统', Icon: Cpu },
  { id: 'database', label: '数据', Icon: Database },
  { id: 'layers', label: '架构', Icon: Layers },
  { id: 'rocket', label: '发布', Icon: Rocket },
  { id: 'sparkles', label: 'AI', Icon: Sparkles },
  { id: 'star', label: '精选', Icon: Star },
  { id: 'heart', label: '偏好', Icon: Heart },
  { id: 'gamepad', label: '娱乐', Icon: Gamepad2 },
  { id: 'wrench', label: '工具', Icon: Wrench },
  { id: 'shield', label: '安全', Icon: Shield }
]

const FOLDER_COLORS: Array<{ id: string; hex: string; label: string }> = [
  { id: 'coral', hex: '#d97757', label: '珊瑚橘' },
  { id: 'amber', hex: '#d99b26', label: '琥珀黄' },
  { id: 'green', hex: '#3f8f62', label: '森林绿' },
  { id: 'teal', hex: '#2a8f9d', label: '青碧色' },
  { id: 'blue', hex: '#3b7dd8', label: '海蔚蓝' },
  { id: 'indigo', hex: '#6366f1', label: '靛青色' },
  { id: 'purple', hex: '#8b5cf6', label: '紫罗兰' },
  { id: 'pink', hex: '#d9487e', label: '玫红色' },
  { id: 'red', hex: '#cc4b37', label: '朱砂红' },
  { id: 'slate', hex: '#64748b', label: '岩石灰' }
]

function resolveFolderColor(color?: string): string {
  if (!color) return FOLDER_COLORS[0].hex
  const preset = FOLDER_COLORS.find((item) => item.id === color)
  if (preset) return preset.hex
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color
  return FOLDER_COLORS[0].hex
}

function FolderGlyph({
  icon,
  size = 20
}: {
  icon?: ProjectFolderIcon
  size?: number
}) {
  const entry = FOLDER_ICONS.find((item) => item.id === icon) || FOLDER_ICONS[0]
  const Icon = entry.Icon
  return <Icon size={size} />
}

/**
 * Normalize folder parent pointers so malformed settings or cyclic references
 * never hide folders or projects. Any folder whose parent chain is missing or
 * cyclic falls back to the root level (`null`).
 */
function normalizeFolders(folders: ProjectFolder[]): {
  byId: Map<string, ProjectFolder>
  parentOf: Map<string, string | null>
} {
  const byId = new Map<string, ProjectFolder>()
  for (const folder of folders) {
    if (folder?.id && folder.name) {
      byId.set(folder.id, folder)
    }
  }

  const parentOf = new Map<string, string | null>()
  for (const folder of byId.values()) {
    const rawParent = folder.parentId ?? null
    if (!rawParent || !byId.has(rawParent) || rawParent === folder.id) {
      parentOf.set(folder.id, null)
      continue
    }
    // Detect cycles by walking up the ancestor chain.
    const seen = new Set<string>([folder.id])
    let cursor: string | null = rawParent
    let cyclic = false
    while (cursor) {
      if (seen.has(cursor)) {
        cyclic = true
        break
      }
      seen.add(cursor)
      const nextParent: string | null = byId.get(cursor)?.parentId ?? null
      cursor = nextParent && byId.has(nextParent) ? nextParent : null
    }
    parentOf.set(folder.id, cyclic ? null : rawParent)
  }

  return { byId, parentOf }
}

interface FolderEditorState {
  mode: 'create' | 'edit'
  folderId?: string
  name: string
  icon: ProjectFolderIcon
  color: string
  parentId: string | null
}

interface MoveTargetState {
  kind: 'workspace' | 'folder'
  /** Workspace path or folder id. */
  key: string
  title: string
  currentFolderId: string | null
}

export function HomeView({
  workspaces,
  projectFolders,
  workspaceFolderMap,
  hiddenSessions,
  currentCwd,
  bootError,
  onOpenProject,
  onAddProject,
  onRemoveProject,
  onSavePreferences,
  onOpenBackups
}: HomeViewProps) {
  const [query, setQuery] = useState('')
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [info, setInfo] = useState<Record<string, WorkspaceInfo>>({})
  const [loading, setLoading] = useState(false)
  const [editor, setEditor] = useState<FolderEditorState | null>(null)
  const [moveTarget, setMoveTarget] = useState<MoveTargetState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProjectFolder | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const hiddenKey = hiddenSessions.join('|')

  const { byId, parentOf } = useMemo(
    () => normalizeFolders(projectFolders),
    [projectFolders]
  )

  // If the currently open folder no longer exists, step back to root.
  useEffect(() => {
    if (currentFolderId && !byId.has(currentFolderId)) {
      setCurrentFolderId(null)
    }
  }, [byId, currentFolderId])

  useEffect(() => {
    if (editor) {
      window.setTimeout(() => {
        nameInputRef.current?.focus()
        nameInputRef.current?.select()
      }, 20)
    }
  }, [editor?.mode, editor?.folderId])

  useEffect(() => {
    let disposed = false
    setLoading(true)
    const hidden = new Set(hiddenSessions)
    Promise.all(
      workspaces.map(async (path) => {
        try {
          const sessions = (await window.desk.listSessions(path, 0, 60)).filter(
            (session) => !hidden.has(session.sessionId)
          )
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
        if (!disposed) setInfo(Object.fromEntries(entries))
      })
      .finally(() => {
        if (!disposed) setLoading(false)
      })
    return () => {
      disposed = true
    }
  }, [workspaces, hiddenKey])

  /**
   * Effective folder assignment for every workspace. Any workspace whose
   * mapped folder does not exist is automatically shown at root so no project
   * path can ever be orphaned or lost.
   */
  const effectiveWorkspaceFolder = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const path of workspaces) {
      const targetId = workspaceFolderMap[path]
      map.set(path, targetId && byId.has(targetId) ? targetId : null)
    }
    return map
  }, [byId, workspaceFolderMap, workspaces])

  /** Breadcrumb chain from root to `folderId`. */
  const buildBreadcrumb = (folderId: string | null): ProjectFolder[] => {
    const chain: ProjectFolder[] = []
    const seen = new Set<string>()
    let cursor = folderId
    while (cursor && byId.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor)
      chain.unshift(byId.get(cursor)!)
      cursor = parentOf.get(cursor) ?? null
    }
    return chain
  }

  const breadcrumbs = useMemo(
    () => buildBreadcrumb(currentFolderId),
    [byId, currentFolderId, parentOf]
  )

  /** Recursive count of sub-folders and projects inside a folder. */
  const folderStats = useMemo(() => {
    const childFolders = new Map<string | null, ProjectFolder[]>()
    for (const folder of byId.values()) {
      const pid = parentOf.get(folder.id) ?? null
      const list = childFolders.get(pid) || []
      list.push(folder)
      childFolders.set(pid, list)
    }

    const directProjects = new Map<string | null, string[]>()
    for (const path of workspaces) {
      const fid = effectiveWorkspaceFolder.get(path) ?? null
      const list = directProjects.get(fid) || []
      list.push(path)
      directProjects.set(fid, list)
    }

    const totals = new Map<string, { subfolders: number; projects: number }>()
    const compute = (id: string, visited = new Set<string>()): { subfolders: number; projects: number } => {
      if (totals.has(id)) return totals.get(id)!
      if (visited.has(id)) return { subfolders: 0, projects: 0 }
      visited.add(id)
      const children = childFolders.get(id) || []
      let subfolders = children.length
      let projects = (directProjects.get(id) || []).length
      for (const child of children) {
        const sub = compute(child.id, visited)
        subfolders += sub.subfolders
        projects += sub.projects
      }
      const result = { subfolders, projects }
      totals.set(id, result)
      return result
    }

    for (const id of byId.keys()) compute(id)
    return { childFolders, directProjects, totals }
  }, [byId, effectiveWorkspaceFolder, parentOf, workspaces])

  const isDescendantFolder = (candidateId: string, targetAncestorId: string): boolean => {
    let cursor: string | null = candidateId
    const seen = new Set<string>()
    while (cursor && !seen.has(cursor)) {
      if (cursor === targetAncestorId) return true
      seen.add(cursor)
      cursor = parentOf.get(cursor) ?? null
    }
    return false
  }

  /** Ordered list of all folders with depth for `<select>` / move menus. */
  const flattenedFolders = useMemo(() => {
    const result: Array<{ folder: ProjectFolder; depth: number; pathLabel: string }> = []
    const visit = (parentId: string | null, depth: number, prefix: string): void => {
      const children = folderStats.childFolders.get(parentId) || []
      for (const folder of children) {
        const label = prefix ? `${prefix} / ${folder.name}` : folder.name
        result.push({ folder, depth, pathLabel: label })
        visit(folder.id, depth + 1, label)
      }
    }
    visit(null, 0, '')
    return result
  }, [folderStats.childFolders])

  const term = query.trim().toLowerCase()
  const visibleFolders = useMemo(() => {
    if (term) {
      return [...byId.values()].filter((folder) =>
        folder.name.toLowerCase().includes(term)
      )
    }
    return folderStats.childFolders.get(currentFolderId) || []
  }, [byId, currentFolderId, folderStats.childFolders, term])

  const visibleWorkspaces = useMemo(() => {
    if (term) {
      return workspaces.filter(
        (path) =>
          path.toLowerCase().includes(term) ||
          basename(path).toLowerCase().includes(term)
      )
    }
    return folderStats.directProjects.get(currentFolderId) || []
  }, [currentFolderId, folderStats.directProjects, term, workspaces])

  const openCreateFolder = (parentId: string | null = currentFolderId): void => {
    setEditor({
      mode: 'create',
      name: '',
      icon: 'folder',
      color: FOLDER_COLORS[projectFolders.length % FOLDER_COLORS.length].id,
      parentId
    })
  }

  const openEditFolder = (folder: ProjectFolder): void => {
    setEditor({
      mode: 'edit',
      folderId: folder.id,
      name: folder.name,
      icon: folder.icon || 'folder',
      color: folder.color || 'coral',
      parentId: parentOf.get(folder.id) ?? null
    })
  }

  const saveFolderEditor = async (): Promise<void> => {
    if (!editor) return
    const name = editor.name.trim()
    if (!name) return

    let safeParentId = editor.parentId && byId.has(editor.parentId) ? editor.parentId : null
    if (
      editor.mode === 'edit' &&
      editor.folderId &&
      safeParentId &&
      isDescendantFolder(safeParentId, editor.folderId)
    ) {
      safeParentId = parentOf.get(editor.folderId) ?? null
    }

    let nextFolders: ProjectFolder[]
    if (editor.mode === 'create') {
      const created: ProjectFolder = {
        id: `pf_${newId()}`,
        name,
        parentId: safeParentId,
        icon: editor.icon,
        color: editor.color,
        createdAt: Date.now()
      }
      nextFolders = [...projectFolders, created]
    } else {
      nextFolders = projectFolders.map((item) =>
        item.id === editor.folderId
          ? {
              ...item,
              name,
              parentId: safeParentId,
              icon: editor.icon,
              color: editor.color
            }
          : item
      )
    }

    setEditor(null)
    await onSavePreferences({ projectFolders: nextFolders })
  }

  /**
   * Delete a folder while preserving every sub-folder and project inside it:
   * child folders and projects move up to the deleted folder's parent.
   */
  const confirmDeleteFolder = async (folder: ProjectFolder): Promise<void> => {
    const fallbackParentId = parentOf.get(folder.id) ?? null
    const nextFolders = projectFolders
      .filter((item) => item.id !== folder.id)
      .map((item) =>
        (parentOf.get(item.id) ?? null) === folder.id
          ? { ...item, parentId: fallbackParentId }
          : item
      )

    const nextMap: Record<string, string> = {}
    for (const [path, targetId] of Object.entries(workspaceFolderMap)) {
      if (targetId === folder.id) {
        if (fallbackParentId) nextMap[path] = fallbackParentId
      } else if (targetId && byId.has(targetId)) {
        nextMap[path] = targetId
      }
    }

    if (currentFolderId === folder.id) {
      setCurrentFolderId(fallbackParentId)
    }
    setDeleteTarget(null)
    await onSavePreferences({
      projectFolders: nextFolders,
      workspaceFolderMap: nextMap
    })
  }

  const moveWorkspaceToFolder = async (
    workspacePath: string,
    targetFolderId: string | null
  ): Promise<void> => {
    const nextMap = { ...workspaceFolderMap }
    if (!targetFolderId || !byId.has(targetFolderId)) {
      delete nextMap[workspacePath]
    } else {
      nextMap[workspacePath] = targetFolderId
    }
    setMoveTarget(null)
    await onSavePreferences({ workspaceFolderMap: nextMap })
  }

  const moveFolderToParent = async (
    folderId: string,
    targetParentId: string | null
  ): Promise<void> => {
    if (targetParentId && isDescendantFolder(targetParentId, folderId)) {
      setMoveTarget(null)
      return
    }
    const nextFolders = projectFolders.map((item) =>
      item.id === folderId
        ? {
            ...item,
            parentId: targetParentId && byId.has(targetParentId) ? targetParentId : null
          }
        : item
    )
    setMoveTarget(null)
    await onSavePreferences({ projectFolders: nextFolders })
  }

  const handleDragStartWorkspace = (event: DragEvent, path: string): void => {
    event.dataTransfer.setData(
      'application/x-3pi-item',
      JSON.stringify({ kind: 'workspace', key: path })
    )
    event.dataTransfer.effectAllowed = 'move'
  }

  const handleDragStartFolder = (event: DragEvent, folderId: string): void => {
    event.dataTransfer.setData(
      'application/x-3pi-item',
      JSON.stringify({ kind: 'folder', key: folderId })
    )
    event.dataTransfer.effectAllowed = 'move'
  }

  const handleDropOnFolder = (
    event: DragEvent,
    targetFolderId: string | null
  ): void => {
    event.preventDefault()
    event.stopPropagation()
    setDragOverFolderId(null)
    const raw = event.dataTransfer.getData('application/x-3pi-item')
    if (!raw) return
    try {
      const payload = JSON.parse(raw) as {
        kind: 'workspace' | 'folder'
        key: string
      }
      if (payload.kind === 'workspace' && payload.key) {
        void moveWorkspaceToFolder(payload.key, targetFolderId)
      } else if (payload.kind === 'folder' && payload.key) {
        if (payload.key !== targetFolderId) {
          void moveFolderToParent(payload.key, targetFolderId)
        }
      }
    } catch {
      // ignore non-3pi drag payload
    }
  }

  const activeFolder = currentFolderId ? byId.get(currentFolderId) || null : null

  return (
    <section className="project-home">
      <header className="project-home-head">
        <div>
          <h1>项目</h1>
          <p>
            {`像管理文件夹一样多层收纳项目（共 ${workspaces.length} 个项目路径已完整保留）。可拖拽项目到文件夹或逐级点开。`}
          </p>
        </div>
        <div className="project-home-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => openCreateFolder(currentFolderId)}
          >
            <FolderPlus size={15} /> 新建文件夹
          </button>
          <button
            type="button"
            className="button primary"
            onClick={() => onAddProject(currentFolderId)}
          >
            <Plus size={15} /> 添加项目
          </button>
        </div>
      </header>

      {bootError && <div className="settings-error">{bootError}</div>}

      <div className="project-toolbar">
        <nav className="project-breadcrumbs" aria-label="文件夹路径">
          <button
            type="button"
            className={`project-crumb ${currentFolderId === null ? 'is-active' : ''} ${
              dragOverFolderId === '__root__' ? 'is-drop-target' : ''
            }`}
            onClick={() => setCurrentFolderId(null)}
            onDragOver={(event) => {
              event.preventDefault()
              setDragOverFolderId('__root__')
            }}
            onDragLeave={() => {
              if (dragOverFolderId === '__root__') setDragOverFolderId(null)
            }}
            onDrop={(event) => handleDropOnFolder(event, null)}
          >
            <Folder size={14} />
            <span>全部项目</span>
            <small>{workspaces.length}</small>
          </button>

          {breadcrumbs.map((crumb) => {
            const active = crumb.id === currentFolderId
            const accent = resolveFolderColor(crumb.color)
            return (
              <span key={crumb.id} className="project-crumb-wrap">
                <ChevronRight size={13} className="project-crumb-sep" />
                <button
                  type="button"
                  className={`project-crumb ${active ? 'is-active' : ''} ${
                    dragOverFolderId === crumb.id ? 'is-drop-target' : ''
                  }`}
                  onClick={() => setCurrentFolderId(crumb.id)}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragOverFolderId(crumb.id)
                  }}
                  onDragLeave={() => {
                    if (dragOverFolderId === crumb.id) setDragOverFolderId(null)
                  }}
                  onDrop={(event) => handleDropOnFolder(event, crumb.id)}
                >
                  <span
                    className="project-crumb-dot"
                    style={{ background: accent }}
                  />
                  <span data-i18n-skip>{crumb.name}</span>
                </button>
              </span>
            )
          })}
        </nav>

        <div className="project-search">
          <Search size={15} />
          <input
            value={query}
            placeholder="搜索所有文件夹与项目路径…"
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              type="button"
              className="icon-button"
              title="清除搜索"
              aria-label="清除搜索"
              onClick={() => setQuery('')}
            >
              <X size={13} />
            </button>
          )}
          {loading && <span className="spinner" />}
        </div>
      </div>

      {activeFolder && !term && (
        <div className="project-folder-banner">
          <div className="project-folder-banner-main">
            <span
              className="project-folder-badge"
              style={{
                background: `${resolveFolderColor(activeFolder.color)}1f`,
                color: resolveFolderColor(activeFolder.color)
              }}
            >
              <FolderGlyph icon={activeFolder.icon} size={18} />
            </span>
            <div>
              <strong data-i18n-skip>{activeFolder.name}</strong>
              <small>
                {(folderStats.childFolders.get(activeFolder.id) || []).length} 个子文件夹 ·{' '}
                {(folderStats.directProjects.get(activeFolder.id) || []).length} 个直属项目
              </small>
            </div>
          </div>
          <div className="project-folder-banner-actions">
            <button
              type="button"
              className="mini-button"
              onClick={() => openCreateFolder(activeFolder.id)}
            >
              <FolderPlus size={12} /> 新建子文件夹
            </button>
            <button
              type="button"
              className="mini-button"
              onClick={() => openEditFolder(activeFolder)}
            >
              <Pencil size={12} /> 自定义外观
            </button>
            <button
              type="button"
              className="mini-button"
              onClick={() =>
                setMoveTarget({
                  kind: 'folder',
                  key: activeFolder.id,
                  title: activeFolder.name,
                  currentFolderId: parentOf.get(activeFolder.id) ?? null
                })
              }
            >
              <FolderInput size={12} /> 移动位置
            </button>
            <button
              type="button"
              className="mini-button"
              onClick={() => setDeleteTarget(activeFolder)}
            >
              <Trash2 size={12} /> 删除文件夹
            </button>
          </div>
        </div>
      )}

      <div className="project-grid">
        {visibleFolders.length === 0 && visibleWorkspaces.length === 0 && (
          <div className="project-empty-card">
            <p className="settings-empty">
              {term
                ? '没有匹配的文件夹或项目。'
                : activeFolder
                  ? '这个文件夹还是空的。可以新建子文件夹，或把项目移进来。'
                  : '还没有项目。添加一个项目文件夹或新建收纳文件夹开始。'}
            </p>
            {!term && (
              <div className="project-empty-actions">
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => openCreateFolder(currentFolderId)}
                >
                  <FolderPlus size={12} /> 新建文件夹
                </button>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => onAddProject(currentFolderId)}
                >
                  <Plus size={12} /> 添加项目到此位置
                </button>
              </div>
            )}
          </div>
        )}

        {visibleFolders.map((folder) => {
          const accent = resolveFolderColor(folder.color)
          const stats = folderStats.totals.get(folder.id) || {
            subfolders: 0,
            projects: 0
          }
          const folderTrail = term
            ? buildBreadcrumb(parentOf.get(folder.id) ?? null)
                .map((item) => item.name)
                .join(' / ')
            : ''
          return (
            <div
              key={folder.id}
              className={`project-card project-folder-card ${
                dragOverFolderId === folder.id ? 'is-drop-target' : ''
              }`}
              style={{ ['--folder-accent' as string]: accent }}
              role="button"
              tabIndex={0}
              draggable
              onDragStart={(event) => handleDragStartFolder(event, folder.id)}
              onDragOver={(event) => {
                event.preventDefault()
                setDragOverFolderId(folder.id)
              }}
              onDragLeave={() => {
                if (dragOverFolderId === folder.id) setDragOverFolderId(null)
              }}
              onDrop={(event) => handleDropOnFolder(event, folder.id)}
              onClick={() => {
                setQuery('')
                setCurrentFolderId(folder.id)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setQuery('')
                  setCurrentFolderId(folder.id)
                }
              }}
            >
              <div className="project-card-top">
                <span
                  className="project-card-icon project-folder-icon"
                  style={{
                    background: `${accent}22`,
                    color: accent
                  }}
                >
                  <FolderGlyph icon={folder.icon} size={20} />
                </span>
                <div className="project-card-tools">
                  <button
                    type="button"
                    className="icon-button project-card-action"
                    title="编辑名称、图标和颜色"
                    aria-label="编辑名称、图标和颜色"
                    onClick={(event) => {
                      event.stopPropagation()
                      openEditFolder(folder)
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    className="icon-button project-card-action"
                    title="移动到其他文件夹"
                    aria-label="移动到其他文件夹"
                    onClick={(event) => {
                      event.stopPropagation()
                      setMoveTarget({
                        kind: 'folder',
                        key: folder.id,
                        title: folder.name,
                        currentFolderId: parentOf.get(folder.id) ?? null
                      })
                    }}
                  >
                    <FolderInput size={13} />
                  </button>
                  <button
                    type="button"
                    className="icon-button project-card-action"
                    title="删除文件夹（保留内部所有项目）"
                    aria-label="删除文件夹"
                    onClick={(event) => {
                      event.stopPropagation()
                      setDeleteTarget(folder)
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <strong data-i18n-skip>{folder.name}</strong>
              <small data-i18n-skip>
                {folderTrail ? `位于：${folderTrail}` : '文件夹'}
              </small>
              <em>
                {stats.projects} 个项目
                {stats.subfolders > 0 ? ` · ${stats.subfolders} 个子文件夹` : ''}
              </em>
            </div>
          )
        })}

        {visibleWorkspaces.map((path) => {
          const details = info[path]
          const current = path === currentCwd
          const assignedFolderId = effectiveWorkspaceFolder.get(path) ?? null
          const assignedFolder = assignedFolderId ? byId.get(assignedFolderId) : undefined
          const folderTrail =
            (term || currentFolderId === null) && assignedFolder
              ? buildBreadcrumb(assignedFolder.id)
                  .map((item) => item.name)
                  .join(' / ')
              : ''
          return (
            <div
              key={path}
              className={`project-card ${current ? 'is-current' : ''}`}
              role="button"
              tabIndex={0}
              draggable
              onDragStart={(event) => handleDragStartWorkspace(event, path)}
              onClick={() => onOpenProject(path)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onOpenProject(path)
                }
              }}
            >
              <div className="project-card-top">
                <span className="project-card-icon">
                  <FolderOpen size={20} />
                </span>
                <div className="project-card-tools">
                  <button
                    type="button"
                    className="icon-button project-card-action"
                    title="收纳到文件夹"
                    aria-label="收纳到文件夹"
                    onClick={(event) => {
                      event.stopPropagation()
                      setMoveTarget({
                        kind: 'workspace',
                        key: path,
                        title: basename(path),
                        currentFolderId: assignedFolderId
                      })
                    }}
                  >
                    <FolderInput size={13} />
                  </button>
                  <button
                    type="button"
                    className="icon-button project-card-action"
                    title="从常用项目移除"
                    aria-label="从常用项目移除"
                    onClick={(event) => {
                      event.stopPropagation()
                      onRemoveProject(path)
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <strong data-i18n-skip>{basename(path)}</strong>
              <small title={path} data-i18n-skip>
                {path}
              </small>
              {folderTrail && (
                <span className="project-card-folder-tag" data-i18n-skip>
                  {folderTrail}
                </span>
              )}
              <em>
                {details ? `${details.count} 个会话` : '正在读取…'}
                {details?.lastModified ? ` · 最近 ${relativeTime(details.lastModified)}` : ''}
              </em>
            </div>
          )
        })}
      </div>

      <div className="project-home-footer">
        <button type="button" className="mini-button" onClick={onOpenBackups}>
          打开备份目录
        </button>
        <span>
          支持多层文件夹嵌套与拖拽归类；删除收纳文件夹时，内部项目会自动回到上一级，绝不会丢失路径。
        </span>
      </div>

      {editor && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setEditor(null)}
        >
          <div
            className="dialog folder-editor-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={editor.mode === 'create' ? '新建文件夹' : '自定义文件夹'}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="dialog-close"
              onClick={() => setEditor(null)}
              aria-label="关闭"
            >
              <X size={16} />
            </button>
            <h2>{editor.mode === 'create' ? '新建文件夹' : '自定义文件夹'}</h2>
            <p className="settings-page-sub">
              像 ChatGPT 项目夹一样自定义名称、图标和颜色，并可放入任意上级文件夹实现多层收纳。
            </p>

            <div className="folder-editor-preview">
              <span
                className="folder-editor-preview-icon"
                style={{
                  background: `${resolveFolderColor(editor.color)}22`,
                  color: resolveFolderColor(editor.color)
                }}
              >
                <FolderGlyph icon={editor.icon} size={24} />
              </span>
              <div>
                <strong data-i18n-skip>{editor.name.trim() || '未命名文件夹'}</strong>
                <small>
                  {editor.parentId && byId.has(editor.parentId)
                    ? `上级：${buildBreadcrumb(editor.parentId)
                        .map((item) => item.name)
                        .join(' / ')}`
                    : '位置：根目录（全部项目）'}
                </small>
              </div>
            </div>

            <label className="copy-session-field">
              <span>文件夹名称</span>
              <input
                ref={nameInputRef}
                className="text-input"
                value={editor.name}
                maxLength={50}
                placeholder="例如：前端项目、核心服务、实验"
                onChange={(event) =>
                  setEditor({ ...editor, name: event.target.value })
                }
                onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
                  if (event.key === 'Enter' && editor.name.trim()) {
                    event.preventDefault()
                    void saveFolderEditor()
                  } else if (event.key === 'Escape') {
                    setEditor(null)
                  }
                }}
              />
            </label>

            <label className="copy-session-field">
              <span>所在位置（支持多层嵌套）</span>
              <select
                className="text-input"
                value={editor.parentId || ''}
                onChange={(event) =>
                  setEditor({
                    ...editor,
                    parentId: event.target.value ? event.target.value : null
                  })
                }
              >
                <option value="">根目录（全部项目）</option>
                {flattenedFolders
                  .filter(
                    ({ folder }) =>
                      !editor.folderId ||
                      !isDescendantFolder(folder.id, editor.folderId)
                  )
                  .map(({ folder, pathLabel }) => (
                    <option key={folder.id} value={folder.id}>
                      {pathLabel}
                    </option>
                  ))}
              </select>
            </label>

            <div className="copy-session-field">
              <span>颜色</span>
              <div className="folder-color-picker">
                {FOLDER_COLORS.map((preset) => {
                  const selected =
                    editor.color === preset.id ||
                    editor.color.toLowerCase() === preset.hex.toLowerCase()
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`folder-color-swatch ${selected ? 'is-selected' : ''}`}
                      style={{ background: preset.hex }}
                      title={preset.label}
                      aria-label={preset.label}
                      onClick={() => setEditor({ ...editor, color: preset.id })}
                    />
                  )
                })}
                <label className="folder-color-custom" title="自定义颜色">
                  <input
                    type="color"
                    value={resolveFolderColor(editor.color)}
                    onChange={(event) =>
                      setEditor({ ...editor, color: event.target.value })
                    }
                  />
                  <span>自定义</span>
                </label>
              </div>
            </div>

            <div className="copy-session-field">
              <span>图标</span>
              <div className="folder-icon-picker">
                {FOLDER_ICONS.map(({ id, label, Icon }) => {
                  const selected = editor.icon === id
                  const accent = resolveFolderColor(editor.color)
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`folder-icon-option ${selected ? 'is-selected' : ''}`}
                      style={
                        selected
                          ? {
                              borderColor: accent,
                              color: accent,
                              background: `${accent}18`
                            }
                          : undefined
                      }
                      title={label}
                      aria-label={label}
                      onClick={() => setEditor({ ...editor, icon: id })}
                    >
                      <Icon size={17} />
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="dialog-actions">
              <button
                type="button"
                className="button ghost"
                onClick={() => setEditor(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="button primary"
                disabled={!editor.name.trim()}
                onClick={() => void saveFolderEditor()}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {moveTarget && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setMoveTarget(null)}
        >
          <div
            className="dialog folder-move-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="移动到文件夹"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="dialog-close"
              onClick={() => setMoveTarget(null)}
              aria-label="关闭"
            >
              <X size={16} />
            </button>
            <h2>
              {moveTarget.kind === 'workspace' ? '收纳项目到文件夹' : '移动文件夹位置'}
            </h2>
            <p className="settings-page-sub">
              选择目标位置：<strong data-i18n-skip>{moveTarget.title}</strong>
            </p>

            <div className="folder-move-list">
              <button
                type="button"
                className={`folder-move-item ${
                  moveTarget.currentFolderId === null ? 'is-active' : ''
                }`}
                onClick={() =>
                  moveTarget.kind === 'workspace'
                    ? void moveWorkspaceToFolder(moveTarget.key, null)
                    : void moveFolderToParent(moveTarget.key, null)
                }
              >
                <span className="folder-move-icon">
                  <Folder size={16} />
                </span>
                <span className="folder-move-label">根目录（全部项目）</span>
                {moveTarget.currentFolderId === null && (
                  <small className="folder-move-current">当前位置</small>
                )}
              </button>

              {flattenedFolders
                .filter(
                  ({ folder }) =>
                    moveTarget.kind !== 'folder' ||
                    !isDescendantFolder(folder.id, moveTarget.key)
                )
                .map(({ folder, depth, pathLabel }) => {
                  const accent = resolveFolderColor(folder.color)
                  const active = moveTarget.currentFolderId === folder.id
                  return (
                    <button
                      key={folder.id}
                      type="button"
                      className={`folder-move-item ${active ? 'is-active' : ''}`}
                      style={{ paddingLeft: `${12 + depth * 16}px` }}
                      onClick={() =>
                        moveTarget.kind === 'workspace'
                          ? void moveWorkspaceToFolder(moveTarget.key, folder.id)
                          : void moveFolderToParent(moveTarget.key, folder.id)
                      }
                    >
                      <span
                        className="folder-move-icon"
                        style={{
                          background: `${accent}22`,
                          color: accent
                        }}
                      >
                        <FolderGlyph icon={folder.icon} size={15} />
                      </span>
                      <span className="folder-move-label" data-i18n-skip>
                        {pathLabel}
                      </span>
                      {active && <small className="folder-move-current">当前位置</small>}
                    </button>
                  )
                })}
            </div>

            <div className="dialog-actions">
              <button
                type="button"
                className="button ghost"
                onClick={() => setMoveTarget(null)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label="删除文件夹"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>删除文件夹</h2>
            <p className="settings-page-sub">
              确定要删除文件夹「<strong data-i18n-skip>{deleteTarget.name}</strong>」吗？
              该文件夹内的所有子文件夹和项目路径都会自动移回上一级目录，不会删除任何项目或会话。
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="button ghost"
                onClick={() => setDeleteTarget(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => void confirmDeleteFolder(deleteTarget)}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
