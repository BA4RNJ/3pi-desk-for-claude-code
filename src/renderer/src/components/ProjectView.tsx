import {
  ArrowLeft,
  Copy,
  FolderOpen,
  MessageSquarePlus,
  RefreshCw,
  Search
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ApiProfile,
  Attachment,
  AttachmentFailure,
  EffortSetting,
  FileEntry,
  ModelOption,
  PermissionMode,
  SessionInfo
} from '../../../shared/types'
import { FALLBACK_COMMANDS } from '../../../shared/ui-options'
import { basename, relativeTime, truncate } from '../lib/format'
import { Composer } from './Composer'
import { ComposerControls } from './ComposerControls'

interface ProjectViewProps {
  cwd: string
  hiddenSessions: string[]
  onOpenSession: (session: SessionInfo) => void
  onSendMessage: (text: string, attachments: Attachment[]) => void
  onSearchFiles: (query: string) => Promise<FileEntry[]>
  initialText: string
  onTextChange: (text: string) => void
  attachments: Attachment[]
  attachmentError: AttachmentFailure[]
  onAttachmentsChange: (attachments: Attachment[]) => void
  onAttachmentErrorChange: (errors: AttachmentFailure[]) => void
  model: string
  models: ModelOption[]
  effort: EffortSetting
  permissionMode: PermissionMode
  webSearchEnabled: boolean
  profiles: ApiProfile[]
  activeProfileId?: string
  onModelChange: (model: string) => void
  onEffortChange: (effort: EffortSetting) => void
  onPermissionModeChange: (mode: PermissionMode) => void
  onToggleWebSearch: () => void
  onSelectProfile: (id: string) => void
  onManageProfiles: () => void
  onBackHome: () => void
  onOpenFolder: () => void
  onOpenSearch: () => void
  onCopySession: (session: SessionInfo) => void
  onRelocate: (newPath: string) => Promise<void>
}

const PAGE_SIZE = 60

export function ProjectView({
  cwd,
  hiddenSessions,
  onOpenSession,
  onSendMessage,
  onSearchFiles,
  initialText,
  onTextChange,
  attachments,
  attachmentError,
  onAttachmentsChange,
  onAttachmentErrorChange,
  model,
  models,
  effort,
  permissionMode,
  webSearchEnabled,
  profiles,
  activeProfileId,
  onModelChange,
  onEffortChange,
  onPermissionModeChange,
  onToggleWebSearch,
  onSelectProfile,
  onManageProfiles,
  onBackHome,
  onOpenFolder,
  onOpenSearch,
  onCopySession,
  onRelocate
}: ProjectViewProps) {
  const [query, setQuery] = useState('')
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [missing, setMissing] = useState(false)
  const [relocating, setRelocating] = useState(false)
  const [relocateError, setRelocateError] = useState('')
  const offset = useRef(0)
  const requestId = useRef(0)
  const hiddenKey = hiddenSessions.join('|')

  const checkMissing = useCallback(async (): Promise<void> => {
    try {
      setMissing(!(await window.desk.workspaceExists(cwd)))
    } catch {
      setMissing(false)
    }
  }, [cwd])

  useEffect(() => {
    void checkMissing()
  }, [checkMissing])

  const relocate = async (): Promise<void> => {
    // The old path no longer exists; start the picker at its parent so the
    // renamed sibling is easy to find.
    const parent = cwd.replace(/[\\/][^\\/]*$/, '')
    const directory = await window.desk.pickDirectory(parent || undefined)
    if (!directory || directory === cwd) return
    setRelocating(true)
    setRelocateError('')
    try {
      await onRelocate(directory)
    } catch (error) {
      setRelocateError(error instanceof Error ? error.message : String(error))
    } finally {
      setRelocating(false)
    }
  }

  const load = useCallback(
    async (reset: boolean): Promise<void> => {
      const request = ++requestId.current
      if (reset) {
        setLoading(true)
        setSessions([])
        offset.current = 0
      } else {
        setLoadingMore(true)
      }
      try {
        const raw = await window.desk.listSessions(cwd, offset.current, PAGE_SIZE)
        if (request !== requestId.current) return
        offset.current += raw.length
        const hidden = new Set(hiddenSessions)
        const visible = raw.filter((session) => !hidden.has(session.sessionId))
        setSessions((previous) => {
          if (reset) return visible
          const seen = new Set(previous.map((item) => item.sessionId))
          return [...previous, ...visible.filter((item) => !seen.has(item.sessionId))]
        })
        setHasMore(raw.length >= PAGE_SIZE)
      } catch {
        if (reset) setSessions([])
        setHasMore(false)
      } finally {
        if (request === requestId.current) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [cwd, hiddenKey]
  )

  useEffect(() => {
    void load(true)
  }, [load])

  const term = query.trim().toLowerCase()
  const filtered = sessions.filter((session) => {
    if (!term) return true
    return [session.customTitle, session.summary, session.firstPrompt, session.tag, session.gitBranch]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term))
  })

  const submit = (text: string, files: Attachment[]): void => {
    if (!text.trim() && files.length === 0) return
    onSendMessage(text, files)
  }

  return (
    <section className="project-view">
      {missing && (
        <div className="project-missing" role="alert">
          <div className="project-missing-copy">
            <strong>项目文件夹不存在</strong>
            <p data-i18n-skip>{cwd}</p>
            <small>
              文件夹可能已被重命名或移动。重新定位后会复制旧会话到新位置，原记录仍保留在本机。
            </small>
          </div>
          <button
            type="button"
            className="button primary"
            disabled={relocating}
            onClick={() => void relocate()}
          >
            {relocating ? '正在迁移…' : '重新定位文件夹'}
          </button>
        </div>
      )}
      {relocateError && <div className="settings-error">{relocateError}</div>}
      <header className="project-view-head">
        <button
          type="button"
          className="icon-button project-back"
          onClick={onBackHome}
          title="返回项目目录"
          aria-label="返回项目目录"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="project-view-title">
          <h1 data-i18n-skip>{basename(cwd) || '项目'}</h1>
          <p title={cwd} data-i18n-skip>{cwd}</p>
        </div>
        <div className="project-view-actions">
          <button
            type="button"
            className="button ghost"
            onClick={onOpenSearch}
            title="搜索项目文件内容"
          >
            <Search size={14} /> 搜索文件
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onOpenFolder}
            title="在系统中打开项目文件夹"
            aria-label="在系统中打开项目文件夹"
          >
            <FolderOpen size={15} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              void checkMissing()
              void load(true)
            }}
            title="刷新会话"
            aria-label="刷新会话"
          >
            <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
          </button>
        </div>
      </header>

      <div className="project-composer-card">
        <div className="project-composer-label">
          <span>新对话</span> · <strong data-i18n-skip>{basename(cwd) || '项目'}</strong>
        </div>
        <Composer
          running={false}
          connecting={false}
          initialText={initialText}
          onTextChange={onTextChange}
          attachments={attachments}
          onAttachmentsChange={onAttachmentsChange}
          attachmentError={attachmentError}
          onAttachmentErrorChange={onAttachmentErrorChange}
          onSend={submit}
          onStop={() => undefined}
          onSearchFiles={onSearchFiles}
          commands={FALLBACK_COMMANDS}
          slashMenuPlacement="below"
          placeholder="问点什么，或描述要在这个项目中完成的任务…"
        />
        <ComposerControls
          model={model}
          models={models}
          effort={effort}
          permissionMode={permissionMode}
          viewMode="detail"
          userOnly={false}
          webSearchEnabled={webSearchEnabled}
          profiles={profiles}
          activeProfileId={activeProfileId}
          dropdownDirection="down"
          dropdownAlign="left"
          showViewControls={false}
          onModelChange={onModelChange}
          onEffortChange={onEffortChange}
          onPermissionModeChange={onPermissionModeChange}
          onToggleWebSearch={onToggleWebSearch}
          onSelectProfile={onSelectProfile}
          onManageProfiles={onManageProfiles}
          onViewModeChange={() => undefined}
          onUserOnlyChange={() => undefined}
        />
      </div>

      <div className="project-history-head">
        <h2>历史对话</h2>
        <span className="project-session-count">
          {filtered.length}
          {hasMore ? '+' : ''} 个会话
        </span>
      </div>

      <div className="project-session-toolbar">
        <div className="project-search">
          <Search size={15} />
          <input
            value={query}
            placeholder="搜索这个项目的会话…"
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <div className="project-session-list">
        {loading && sessions.length === 0 && (
          <p className="settings-empty">正在加载…</p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="settings-empty">
            {term ? '没有匹配的会话。' : '这个项目还没有会话，从上面的输入框开始吧。'}
          </p>
        )}
        {filtered.map((session) => (
          <div
            key={session.sessionId}
            className="project-session-row"
            role="button"
            tabIndex={0}
            onClick={() => onOpenSession(session)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onOpenSession(session)
              }
            }}
          >
            <span className="project-session-icon">
              <MessageSquarePlus size={15} />
            </span>
            <div className="project-session-copy">
              <strong data-i18n-skip>
                {truncate(
                  session.customTitle || session.summary || session.firstPrompt || '未命名会话',
                  80
                )}
              </strong>
              <small>
                {relativeTime(session.lastModified)}
                {session.gitBranch ? ` · ${session.gitBranch}` : ''}
                {session.tag ? ` · ${session.tag}` : ''}
              </small>
              {session.firstPrompt && session.firstPrompt !== session.summary && (
                <em data-i18n-skip>{truncate(session.firstPrompt, 120)}</em>
              )}
            </div>
            <button
              type="button"
              className="mini-button project-session-copy-action"
              title="复制或迁移到其他项目"
              onClick={(event) => {
                event.stopPropagation()
                onCopySession(session)
              }}
            >
              <Copy size={12} /> 复制/迁移
            </button>
          </div>
        ))}
        {hasMore && (
          <button
            type="button"
            className="session-load-more"
            disabled={loadingMore}
            onClick={() => void load(false)}
          >
            {loadingMore ? '正在加载…' : '加载更多会话'}
          </button>
        )}
      </div>
    </section>
  )
}
