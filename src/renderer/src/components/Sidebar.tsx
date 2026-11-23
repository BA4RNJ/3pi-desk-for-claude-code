import {
  Copy,
  Download,
  FolderOpen,
  GitFork,
  Home,
  Monitor,
  Moon,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sun,
  Tag,
  Trash2,
  X
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { SessionInfo } from '../../../shared/types'
import type { ThemeMode } from '../types'
import { basename, relativeTime, truncate } from '../lib/format'
import { AppMark } from './AppMark'

interface SidebarProps {
  cwd: string
  sessions: SessionInfo[]
  activeSessionId?: string
  connecting: boolean
  theme: ThemeMode
  pinnedSessions: string[]
  hiddenSessions: string[]
  onNew: () => void
  onOpenHome: () => void
  onSelect: (session: SessionInfo) => void
  onChooseFolder: () => void
  onRename: (session: SessionInfo) => void
  onTag: (session: SessionInfo) => void
  onExport: (session: SessionInfo) => void
  onCopy: (session: SessionInfo) => void
  onFork: (session: SessionInfo) => void
  onPin: (sessionId: string) => void
  onDelete: (session: SessionInfo) => void
  onRefresh: () => void
  hasMoreSessions: boolean
  loadingMoreSessions: boolean
  onLoadMoreSessions: () => void
  onThemeChange: (theme: ThemeMode) => void
  onOpenSettings: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

function ThemeIcon({ theme }: { theme: ThemeMode }) {
  if (theme === 'light') return <Sun size={16} />
  if (theme === 'dark') return <Moon size={16} />
  return <Monitor size={16} />
}

function nextTheme(theme: ThemeMode): ThemeMode {
  if (theme === 'light') return 'dark'
  if (theme === 'dark') return 'system'
  return 'light'
}

const THEME_LABEL: Record<ThemeMode, string> = {
  light: '浅色主题',
  dark: '深色主题',
  system: '跟随系统'
}

export function Sidebar({
  cwd,
  sessions,
  activeSessionId,
  connecting,
  theme,
  pinnedSessions,
  hiddenSessions,
  onNew,
  onOpenHome,
  onSelect,
  onChooseFolder,
  onRename,
  onTag,
  onExport,
  onCopy,
  onFork,
  onPin,
  onDelete,
  onRefresh,
  hasMoreSessions,
  loadingMoreSessions,
  onLoadMoreSessions,
  onThemeChange,
  onOpenSettings,
  mobileOpen = false,
  onMobileClose
}: SidebarProps) {
  const closeMobile = (): void => onMobileClose?.()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SessionInfo[]>([])
  const [searchLimit, setSearchLimit] = useState(200)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const pinned = new Set(pinnedSessions)

  useEffect(() => {
    setSearchLimit(200)
  }, [query])

  useEffect(() => {
    const term = query.trim()
    if (!term) {
      setSearchResults([])
      return
    }
    const timer = window.setTimeout(() => {
      window.desk
        .listAllSessions(searchLimit, 0)
        .then((list) => {
          const lower = term.toLowerCase()
          const hidden = new Set(hiddenSessions)
          setSearchResults(
            list.filter(
              (session) =>
                !hidden.has(session.sessionId) &&
                [session.summary, session.customTitle, session.firstPrompt, session.cwd, session.tag]
                  .filter(Boolean)
                  .some((value) => String(value).toLowerCase().includes(lower))
            )
          )
        })
        .catch(() => setSearchResults([]))
    }, 220)
    return () => window.clearTimeout(timer)
  }, [hiddenSessions, query, searchLimit])

  useEffect(() => {
    if (!menuFor) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as HTMLElement
      if (target.closest('.session-menu') || target.closest('.session-more')) return
      setMenuFor(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [menuFor])

  const source = query.trim() ? searchResults : sessions
  const ordered = [...source].sort((a, b) => {
    const aPinned = pinned.has(a.sessionId) ? 1 : 0
    const bPinned = pinned.has(b.sessionId) ? 1 : 0
    if (aPinned !== bPinned) return bPinned - aPinned
    return b.lastModified - a.lastModified
  })

  const run = (action: () => void): void => {
    setMenuFor(null)
    action()
  }

  return (
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <button
        type="button"
        className="icon-button sidebar-mobile-close"
        onClick={closeMobile}
        aria-label="关闭菜单"
      >
        <X size={18} />
      </button>
      <button
        type="button"
        className="brand brand-button"
        onClick={() => {
          closeMobile()
          onOpenHome()
        }}
        title="项目目录"
      >
        <AppMark size={34} className="brand-mark" />
        <div className="brand-text">
          <strong>3PI Desk</strong>
          <span>项目目录</span>
        </div>
      </button>

      <button
        type="button"
        className="projects-nav"
        onClick={() => {
          closeMobile()
          onOpenHome()
        }}
      >
        <Home size={15} />
        <span>项目主页</span>
      </button>

      <button
        type="button"
        className="new-chat"
        onClick={() => {
          closeMobile()
          onNew()
        }}
      >
        <Plus size={16} />
        <span>新建对话</span>
      </button>

      <button
        type="button"
        className="folder-card"
        onClick={() => {
          closeMobile()
          onChooseFolder()
        }}
        title={cwd}
      >
        <span className="folder-card-icon">
          <FolderOpen size={17} />
        </span>
        <span className="folder-card-text">
          <small>工作目录</small>
          <strong>{cwd ? basename(cwd) : '选择文件夹'}</strong>
          <em>{cwd}</em>
        </span>
      </button>

      <div className="sidebar-section">
        <span>{query.trim() ? '搜索结果' : '最近会话'}</span>
        <button
          type="button"
          className="icon-button"
          onClick={onRefresh}
          title="刷新会话列表"
          aria-label="刷新会话列表"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="session-search">
        <Search size={13} />
        <input
          value={query}
          placeholder="搜索所有会话…"
          spellCheck={false}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="清空搜索">
            <X size={12} />
          </button>
        )}
      </div>

      <div className="session-list">
        {ordered.length === 0 && !connecting && (
          <p className="session-empty">
            {query.trim() ? '没有匹配的会话' : '这个目录还没有会话'}
          </p>
        )}
        {ordered.map((session) => {
          const active = session.sessionId === activeSessionId
          const isPinned = pinned.has(session.sessionId)
          return (
            <div
              key={session.sessionId}
              role="button"
              tabIndex={0}
              className={`session-item ${active ? 'is-active' : ''}`}
              onClick={() => {
                closeMobile()
                onSelect(session)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  closeMobile()
                  onSelect(session)
                }
              }}
            >
              <div className="session-copy">
                <span className="session-summary">
                  {isPinned && <Pin size={10} className="pin-icon" />}
                  {truncate(session.customTitle || session.summary || '未命名会话', 60)}
                </span>
                <span className="session-meta">
                  {relativeTime(session.lastModified)}
                  {query.trim() && session.cwd ? ` · ${basename(session.cwd)}` : ''}
                  {session.gitBranch ? ` · ${session.gitBranch}` : ''}
                  {session.tag ? ` · ${session.tag}` : ''}
                </span>
              </div>
              <div className="session-actions">
                <button
                  type="button"
                  className={`icon-button session-more ${isPinned ? 'is-pinned' : ''}`}
                  title="会话操作"
                  aria-label="会话操作"
                  onClick={(event) => {
                    event.stopPropagation()
                    setMenuFor(menuFor === session.sessionId ? null : session.sessionId)
                  }}
                >
                  <MoreHorizontal size={14} />
                </button>
              </div>
              {menuFor === session.sessionId && (
                <div className="session-menu" onClick={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => run(() => onRename(session))}>
                    <Pencil size={13} /> 重命名
                  </button>
                  <button type="button" onClick={() => run(() => onTag(session))}>
                    <Tag size={13} /> 设置标签
                  </button>
                  <button type="button" onClick={() => run(() => onExport(session))}>
                    <Download size={13} /> 导出 Markdown
                  </button>
                  <button type="button" onClick={() => run(() => onCopy(session))}>
                    <Copy size={13} /> 复制/迁移
                  </button>
                  <button type="button" onClick={() => run(() => onFork(session))}>
                    <GitFork size={13} /> 创建分支
                  </button>
                  <button type="button" onClick={() => run(() => onPin(session.sessionId))}>
                    <Pin size={13} /> {isPinned ? '取消置顶' : '置顶会话'}
                  </button>
                  <button
                    type="button"
                    className="danger-text"
                    onClick={() => run(() => onDelete(session))}
                  >
                    <Trash2 size={13} /> 删除会话
                  </button>
                </div>
              )}
            </div>
          )
        })}
        {!query.trim() && hasMoreSessions && (
          <button
            type="button"
            className="session-load-more"
            disabled={loadingMoreSessions}
            onClick={onLoadMoreSessions}
          >
            {loadingMoreSessions ? '正在加载…' : '加载更多会话'}
          </button>
        )}
        {query.trim() && searchResults.length >= searchLimit && (
          <button
            type="button"
            className="session-load-more"
            onClick={() => setSearchLimit((limit) => limit + 200)}
          >
            加载更多搜索结果
          </button>
        )}
      </div>

      <div className="sidebar-footer">
        <button
          type="button"
          className="footer-button"
          onClick={() => onThemeChange(nextTheme(theme))}
          title={THEME_LABEL[theme]}
        >
          <ThemeIcon theme={theme} />
          <span>{THEME_LABEL[theme]}</span>
        </button>
        <button
          type="button"
          className="footer-button"
          onClick={() => {
            closeMobile()
            onOpenSettings()
          }}
        >
          <Settings size={16} />
          <span>设置</span>
        </button>
      </div>
    </aside>
  )
}
