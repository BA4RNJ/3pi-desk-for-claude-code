import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Menu } from 'lucide-react'
import type {
  Attachment,
  AttachmentFailure,
  EffortSetting,
  PermissionMode,
  SessionInfo
} from '../../shared/types'
import type { TodoItem } from './types'
import { basename } from './lib/format'
import { fileToAttachment } from './lib/files'
import { setI18nLanguage, startI18n } from './i18n'
import { useDesk } from './hooks/useDesk'
import { findModel } from './lib/usage'
import { ChatView } from './components/ChatView'
import { ClaudeCliBanner } from './components/ClaudeCliBanner'
import {
  CommandPalette,
  type CommandPaletteAction
} from './components/CommandPalette'
import { Composer } from './components/Composer'
import { ComposerControls, type ChatViewMode } from './components/ComposerControls'
import { ConfirmDialog } from './components/ConfirmDialog'
import { CopySessionDialog } from './components/CopySessionDialog'
import { FilePanel } from './components/FilePanel'
import { FilePreviewDialog } from './components/FilePreviewDialog'
import { HomeView } from './components/HomeView'
import { PermissionBar } from './components/PermissionBar'
import { ProjectView } from './components/ProjectView'
import { QuestionBar } from './components/QuestionBar'
import { RenameDialog } from './components/RenameDialog'
import { RewindDialog } from './components/RewindDialog'
import { SettingsDialog, type SettingsTab } from './components/SettingsDialog'
import { Sidebar } from './components/Sidebar'
import { AppMark } from './components/AppMark'
import { TabBar } from './components/TabBar'
import { TagDialog } from './components/TagDialog'
import { TopBar } from './components/TopBar'
import {
  WorkspaceSearchDialog,
  type SearchMode
} from './components/WorkspaceSearchDialog'

export default function App() {
  const desk = useDesk()
  const activeTab = desk.activeTab
  const activeTabId = activeTab?.id || ''
  const composerTexts = useRef<Record<string, string>>({})
  const [composerAttachments, setComposerAttachments] = useState<
    Record<string, { attachments: Attachment[]; errors: AttachmentFailure[] }>
  >({})
  const [composerFocusTokens, setComposerFocusTokens] = useState<
    Record<string, number>
  >({})
  const projectComposerTexts = useRef<Record<string, string>>({})
  const lastRemoteActivityAt = useRef(0)
  const [projectComposerAttachments, setProjectComposerAttachments] = useState<
    Record<string, { attachments: Attachment[]; errors: AttachmentFailure[] }>
  >({})
  const updateProjectComposerAttachments = useCallback(
    (
      cwd: string,
      patch: Partial<{ attachments: Attachment[]; errors: AttachmentFailure[] }>
    ) => {
      setProjectComposerAttachments((previous) => ({
        ...previous,
        [cwd]: {
          ...(previous[cwd] || { attachments: [], errors: [] }),
          ...patch
        }
      }))
    },
    []
  )
  const activeComposer = composerAttachments[activeTabId] || {
    attachments: [],
    errors: []
  }
  const updateComposerAttachments = useCallback(
    (patch: Partial<{ attachments: Attachment[]; errors: AttachmentFailure[] }>) => {
      if (!activeTabId) return
      setComposerAttachments((previous) => ({
        ...previous,
        [activeTabId]: {
          ...(previous[activeTabId] || { attachments: [], errors: [] }),
          ...patch
        }
      }))
    },
    [activeTabId]
  )
  const [viewMode, setViewMode] = useState<ChatViewMode>(() =>
    localStorage.getItem('3pi-chat-view') === 'compact' ? 'compact' : 'detail'
  )
  const [userOnly, setUserOnly] = useState(
    () => localStorage.getItem('3pi-user-only') === 'true'
  )
  const [deskView, setDeskView] = useState<
    { kind: 'home' } | { kind: 'project'; cwd: string } | { kind: 'chat' }
  >({ kind: 'home' })
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general')
  const [rewindTarget, setRewindTarget] = useState<string | null>(null)
  const [tagTarget, setTagTarget] = useState<SessionInfo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SessionInfo | null>(null)
  const [withdrawTarget, setWithdrawTarget] = useState<string | null>(null)
  const [filePanelOpen, setFilePanelOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState<string | null>(null)
  const [previewLine, setPreviewLine] = useState<number | undefined>(undefined)
  const [previewInitialView, setPreviewInitialView] = useState<'edit' | 'diff'>('edit')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchMode, setSearchMode] = useState<SearchMode>('content')
  const [commandOpen, setCommandOpen] = useState(false)
  const [copyTarget, setCopyTarget] = useState<SessionInfo | null>(null)
  const [projectModel, setProjectModel] = useState('')
  const activeApiProfileId =
    desk.settings?.api.profileId ||
    desk.settings?.profiles.find(
      (profile) =>
        profile.baseUrl === desk.settings?.api.baseUrl &&
        profile.model === desk.settings?.api.model
    )?.id
  const [projectEffort, setProjectEffort] = useState<EffortSetting>('default')
  const [projectPermission, setProjectPermission] = useState<PermissionMode>('default')
  const projectSettingsInitialized = useRef(false)
  useLayoutEffect(() => {
    startI18n(desk.language)
    document.documentElement.lang = desk.language
    // Start once; language changes use setI18nLanguage below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useLayoutEffect(() => {
    setI18nLanguage(desk.language)
    document.documentElement.lang = desk.language
  }, [desk.language])

  useEffect(() => {
    const ids = new Set(desk.tabOrder)
    for (const id of Object.keys(composerTexts.current)) {
      if (!ids.has(id)) delete composerTexts.current[id]
    }
    setComposerAttachments((previous) => {
      const next = Object.fromEntries(
        Object.entries(previous).filter(([id]) => ids.has(id))
      )
      return Object.keys(next).length === Object.keys(previous).length ? previous : next
    })
    setComposerFocusTokens((previous) => {
      const next = Object.fromEntries(
        Object.entries(previous).filter(([id]) => ids.has(id))
      )
      return Object.keys(next).length === Object.keys(previous).length ? previous : next
    })
  }, [desk.tabOrder])

  useEffect(() => {
    if (projectSettingsInitialized.current || !desk.settings) return
    const last = desk.settings.preferences.lastChatSettings
    setProjectModel(last.model || desk.settings.api.model || '')
    setProjectEffort(last.effort || 'default')
    setProjectPermission(last.permissionMode || 'default')
    projectSettingsInitialized.current = true
  }, [desk.settings])

  useEffect(() => {
    if (deskView.kind === 'chat' && !activeTab) {
      setDeskView(desk.cwd ? { kind: 'project', cwd: desk.cwd } : { kind: 'home' })
    }
  }, [activeTab, desk.cwd, deskView.kind])

  useEffect(() => {
    localStorage.setItem('3pi-chat-view', viewMode)
  }, [viewMode])

  useEffect(() => {
    localStorage.setItem('3pi-user-only', userOnly ? 'true' : 'false')
  }, [userOnly])

  useEffect(() => {
    const title =
      deskView.kind === 'home'
        ? `${desk.language === 'zh' ? '项目' : 'Projects'} · 3PI Desk`
        : deskView.kind === 'project'
          ? `${basename(deskView.cwd)} · 3PI Desk`
          : activeTab?.title
            ? `${activeTab.title} · 3PI Desk`
            : '3PI Desk'
    document.title = title
  }, [activeTab?.title, desk.language, deskView])

  useEffect(
    () =>
      window.desk.onNewTabRequest(() => {
        setDeskView({ kind: 'chat' })
        desk.newChat()
      }),
    [desk.newChat]
  )

  useEffect(
    () => window.desk.onOpenSettingsRequest(() => desk.setSettingsOpen(true)),
    [desk.setSettingsOpen]
  )

  // Follow the other client: when the phone sends a message, bring the same
  // tab into view on the desktop so the streaming progress is visible.
  useEffect(() => {
    const activity = desk.remoteActivity
    if (!activity || activity.at === lastRemoteActivityAt.current) return
    lastRemoteActivityAt.current = activity.at
    setDeskView({ kind: 'chat' })
    desk.activateTab(activity.tabId)
  }, [desk.activateTab, desk.remoteActivity])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        startChatHere()
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 't') {
        event.preventDefault()
        startChatHere()
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen((open) => !open)
      }
      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === 'f'
      ) {
        event.preventDefault()
        setSearchMode('content')
        setSearchOpen(true)
      }
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'p'
      ) {
        event.preventDefault()
        setSearchMode('files')
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [desk])

  const handleFilesDropped = async (files: File[]): Promise<void> => {
    const next: Attachment[] = []
    const failures: AttachmentFailure[] = []
    for (const file of files) {
      const result = await fileToAttachment(file)
      if (result.attachment) next.push(result.attachment)
      else failures.push({ name: file.name || '附件', reason: result.reason || 'unreadable' })
    }
    updateComposerAttachments({
      attachments:
        next.length > 0
          ? [...activeComposer.attachments, ...next]
          : activeComposer.attachments,
      errors: failures
    })
  }

  const openChatView = (): void => setDeskView({ kind: 'chat' })
  const startChat = (cwd?: string): void => {
    setDeskView({ kind: 'chat' })
    desk.newChat(cwd)
  }
  const startChatHere = (): void =>
    startChat(deskView.kind === 'project' ? deskView.cwd : desk.cwd || undefined)
  const sendInProject = (
    cwd: string,
    text: string,
    attachments: Attachment[]
  ): void => {
    startChat(cwd)
    void (async () => {
      if (projectModel) await desk.setModel(projectModel)
      await desk.setEffort(projectEffort)
      await desk.setPermissionMode(projectPermission)
      await desk.sendMessage(text, attachments)
    })()
  }
  const openHome = (): void => setDeskView({ kind: 'home' })
  const openCurrentProject = (): void => {
    if (desk.cwd) openProject(desk.cwd)
    else openHome()
  }
  const openProject = (path: string): void => {
    setDeskView({ kind: 'project', cwd: path })
    void desk.openProject(path)
  }
  const openSession = (session: SessionInfo, cwd?: string): void => {
    setDeskView({ kind: 'chat' })
    void desk.selectSession(session.sessionId, cwd || session.cwd)
  }

  if (!desk.booted) {
    return (
      <div className="app-loading">
        <AppMark size={66} className="app-loading-mark" />
        <span className="spinner" />
        <p>正在准备 3PI Desk…</p>
      </div>
    )
  }

  const activeSessionId = activeTab?.sessionId
  const activeModelName = activeTab
    ? findModel(desk.models, activeTab.state.model)?.name || activeTab.state.model
    : ''
  // The global request is only used for the cross-view notification toast.
  // Inline prompts must belong to the conversation that is on screen.
  const permission = desk.currentPermission
  const permissionTab = permission ? desk.tabs[permission.tabId] : undefined
  const activePermission = activeTab?.permissions[0]
  const todos: TodoItem[] = (() => {
    if (!activeTab) return []
    for (let index = activeTab.messages.length - 1; index >= 0; index -= 1) {
      const message = activeTab.messages[index]
      if (message.role !== 'assistant') continue
      for (const block of message.blocks) {
        if (block.kind !== 'tool' || block.name !== 'TodoWrite') continue
        const raw = block.input.todos
        if (!Array.isArray(raw)) continue
        return raw
          .filter((item): item is Record<string, any> => Boolean(item && typeof item === 'object'))
          .map((item) => ({
            content: String(item.content || ''),
            status:
              item.status === 'completed'
                ? 'completed'
                : item.status === 'in_progress'
                  ? 'in_progress'
                  : 'pending'
          }))
      }
    }
    return []
  })()
  const planPreview = activeTab
    ? [...activeTab.messages]
        .reverse()
        .filter((message) => message.role === 'assistant')
        .flatMap((message) =>
          message.role === 'assistant'
            ? message.blocks
                .filter((block) => block.kind === 'text')
                .map((block) => (block.kind === 'text' ? block.text : ''))
            : []
        )
        .join('\n\n')
    : ''

  const commandActions: CommandPaletteAction[] = [
    {
      id: 'new-chat',
      label: '新建对话',
      hint: 'Ctrl/Cmd + N',
      run: startChatHere
    },
    {
      id: 'projects',
      label: '打开项目目录',
      run: openHome
    },
    {
      id: 'search-content',
      label: '搜索文件内容',
      hint: 'Ctrl/Cmd + Shift + F',
      run: () => {
        setSearchMode('content')
        setSearchOpen(true)
      }
    },
    {
      id: 'search-files',
      label: '搜索文件名',
      hint: 'Ctrl/Cmd + P',
      run: () => {
        setSearchMode('files')
        setSearchOpen(true)
      }
    },
    {
      id: 'toggle-files',
      label: filePanelOpen ? '关闭文件面板' : '打开文件面板',
      run: () => setFilePanelOpen((open) => !open)
    },
    {
      id: 'settings',
      label: '打开设置',
      run: () => {
        setSettingsTab('general')
        desk.setSettingsOpen(true)
      }
    },
    {
      id: 'extensions',
      label: '打开扩展设置',
      run: () => {
        setSettingsTab('extensions')
        desk.setSettingsOpen(true)
      }
    },
    {
      id: 'theme',
      label: `切换主题（当前：${desk.theme}）`,
      run: () =>
        desk.setTheme(
          desk.theme === 'light' ? 'dark' : desk.theme === 'dark' ? 'system' : 'light'
        )
    },
    {
      id: 'language',
      label: desk.language === 'zh' ? 'Switch to English' : '切换到中文',
      run: () => desk.setLanguage(desk.language === 'zh' ? 'en' : 'zh')
    },
    {
      id: 'export',
      label: '导出当前对话为 Markdown',
      run: () => void desk.exportTab()
    },
    {
      id: 'backups',
      label: '打开会话备份目录',
      run: () => void desk.openBackupDir()
    },
    {
      id: 'refresh-models',
      label: '刷新模型列表',
      run: () => void desk.reloadModels()
    }
  ]

  return (
    <div
      className={`app ${
        deskView.kind === 'chat' && activeTab && filePanelOpen ? 'has-files' : ''
      }`}
    >
      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'is-open' : ''}`}
        role="presentation"
        onClick={() => setSidebarOpen(false)}
      />
      <Sidebar
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
        cwd={activeTab?.cwd || desk.cwd}
        sessions={desk.sessions}
        activeSessionId={activeSessionId}
        connecting={Boolean(activeTab?.state.connecting)}
        theme={desk.theme}
        pinnedSessions={desk.settings?.preferences.pinnedSessions || []}
        hiddenSessions={desk.settings?.preferences.hiddenSessions || []}
        onNew={startChatHere}
        onOpenHome={openHome}
        onSelect={(session) => openSession(session)}
        onChooseFolder={openCurrentProject}
        onRename={(session) => desk.setRenameTarget(session)}
        onTag={(session) => setTagTarget(session)}
        onExport={(session) => void desk.exportSessionById(session)}
        onCopy={(session) => setCopyTarget(session)}
        onFork={(session) => {
          openChatView()
          void desk.forkSession(session.sessionId, session.cwd)
        }}
        onPin={(sessionId) => void desk.pinSession(sessionId)}
        onDelete={(session) => setDeleteTarget(session)}
        onRefresh={() =>
          void desk.refreshSessions(
            deskView.kind === 'project' ? deskView.cwd : undefined
          )
        }
        hasMoreSessions={desk.sessionsHasMore}
        loadingMoreSessions={desk.sessionsLoadingMore}
        onLoadMoreSessions={() =>
          void desk.loadMoreSessions(
            deskView.kind === 'project' ? deskView.cwd : undefined
          )
        }
        onThemeChange={desk.setTheme}
        onOpenSettings={() => {
          setSettingsTab('general')
          desk.setSettingsOpen(true)
        }}
      />

      <main className="main">
        <button
          type="button"
          className="mobile-menu-button"
          onClick={() => setSidebarOpen(true)}
          aria-label="打开菜单"
        >
          <Menu size={18} />
        </button>
        {deskView.kind === 'chat' && activeTab && (
          <TopBar
            title={activeTab.title}
            cwd={activeTab?.cwd || desk.cwd}
            models={desk.models}
            stats={activeTab.state.stats}
            workElapsedMs={activeTab.workElapsedMs}
            workStartedAt={activeTab.workStartedAt}
            context={activeTab.state.context}
            usage={activeTab.usage}
            tokenRate={activeTab.tokenRate}
            tasks={activeTab.tasks}
            todos={todos}
            running={activeTab.state.running}
            onOpenHome={openHome}
            onOpenUsage={() => {
              setSettingsTab('usage')
              desk.setSettingsOpen(true)
            }}
            onToggleFiles={() => setFilePanelOpen((open) => !open)}
            onOpenSearch={() => {
              setSearchMode('content')
              setSearchOpen(true)
            }}
            filesOpen={filePanelOpen}
            onOpenPath={(path) => void desk.openPath(path)}
            onStopTask={(taskId) => void desk.stopTask(taskId)}
          />
        )}

        <TabBar
          tabs={desk.tabs}
          tabOrder={desk.tabOrder}
          activeTabId={desk.activeTabId}
          onActivate={(id) => {
            openChatView()
            desk.activateTab(id)
          }}
          onClose={desk.closeTab}
          onNew={startChatHere}
        />

        <ClaudeCliBanner
          status={desk.claudeCli}
          onDownload={desk.downloadClaudeCli}
          onPick={desk.pickClaudeCli}
          onRefresh={desk.refreshClaudeCli}
          onOpenSettings={() => {
            setSettingsTab('general')
            desk.setSettingsOpen(true)
          }}
        />

        {deskView.kind === 'home' && (
          <HomeView
            workspaces={desk.settings?.preferences.recentWorkspaces || []}
            projectFolders={desk.settings?.preferences.projectFolders || []}
            workspaceFolderMap={desk.settings?.preferences.workspaceFolderMap || {}}
            hiddenSessions={desk.settings?.preferences.hiddenSessions || []}
            currentCwd={desk.cwd}
            bootError={desk.bootError}
            onOpenProject={openProject}
            onAddProject={(folderId) => {
              void desk.pickProject().then(async (path) => {
                if (!path) return
                if (folderId) {
                  const currentMap =
                    desk.settings?.preferences.workspaceFolderMap || {}
                  await desk
                    .savePreferences({
                      workspaceFolderMap: { ...currentMap, [path]: folderId }
                    })
                    .catch(() => undefined)
                }
                setDeskView({ kind: 'project', cwd: path })
              })
            }}
            onRemoveProject={(path) => void desk.removeRecentWorkspace(path)}
            onSavePreferences={desk.savePreferences}
            onOpenBackups={() => void desk.openBackupDir()}
          />
        )}

        {deskView.kind === 'project' && (
          <ProjectView
            key={deskView.cwd}
            cwd={deskView.cwd}
            hiddenSessions={desk.settings?.preferences.hiddenSessions || []}
            onOpenSession={(session) => openSession(session, session.cwd || deskView.cwd)}
            onSendMessage={(text, files) =>
              sendInProject(deskView.cwd, text, files)
            }
            onSearchFiles={desk.searchFiles}
            initialText={projectComposerTexts.current[deskView.cwd] || ''}
            onTextChange={(text) => {
              projectComposerTexts.current[deskView.cwd] = text
            }}
            attachments={
              projectComposerAttachments[deskView.cwd]?.attachments || []
            }
            attachmentError={
              projectComposerAttachments[deskView.cwd]?.errors || []
            }
            onAttachmentsChange={(attachments) =>
              updateProjectComposerAttachments(deskView.cwd, { attachments })
            }
            onAttachmentErrorChange={(errors) =>
              updateProjectComposerAttachments(deskView.cwd, { errors })
            }
            model={projectModel}
            models={desk.models}
            effort={projectEffort}
            permissionMode={projectPermission}
            webSearchEnabled={desk.settings?.webSearch.enabled ?? true}
            profiles={desk.settings?.profiles || []}
            activeProfileId={activeApiProfileId}
            onSelectProfile={(id) => {
              void desk
                .applyApiProfile(id, false)
                .then((api) => {
                  if (api.model) setProjectModel(api.model)
                })
                .catch(() => undefined)
            }}
            onManageProfiles={() => {
              setSettingsTab('api')
              desk.setSettingsOpen(true)
            }}
            onModelChange={setProjectModel}
            onEffortChange={setProjectEffort}
            onPermissionModeChange={setProjectPermission}
            onToggleWebSearch={() =>
              void desk.saveWebSearch({
                enabled: !(desk.settings?.webSearch.enabled ?? true)
              })
            }
            onBackHome={openHome}
            onOpenFolder={() => void desk.openPath(deskView.cwd)}
            onOpenSearch={() => {
              setSearchMode('content')
              setSearchOpen(true)
            }}
            onCopySession={(session) => setCopyTarget(session)}
            onRelocate={async (newPath) => {
              const oldPath = deskView.cwd
              await desk.relocateWorkspace(oldPath, newPath)
              const draft = projectComposerTexts.current[oldPath]
              if (draft !== undefined) {
                projectComposerTexts.current[newPath] = draft
                delete projectComposerTexts.current[oldPath]
              }
              setProjectComposerAttachments((previous) => {
                const current = previous[oldPath]
                if (!current) return previous
                const next = { ...previous, [newPath]: current }
                delete next[oldPath]
                return next
              })
              openProject(newPath)
            }}
          />
        )}

        {deskView.kind === 'chat' && activeTab && (
          <>

            <ChatView
              key={activeTab.id}
              messages={activeTab.messages}
              cwd={activeTab?.cwd || desk.cwd}
              running={activeTab.state.running}
              pendingTurns={activeTab.state.pendingTurns || 0}
              connecting={activeTab.state.connecting}
              loadingHistory={activeTab.loadingHistory}
              modelName={activeModelName}
              error={activeTab.state.error}
              profiles={desk.settings?.profiles || []}
              activeProfileId={activeApiProfileId}
              onSwitchProfileAndRetry={(profileId) => {
                void (async () => {
                  try {
                    await desk.applyApiProfile(profileId)
                    const lastUser = [...activeTab.messages]
                      .reverse()
                      .find((msg) => msg.role === 'user')
                    if (lastUser && lastUser.role === 'user') {
                      await desk.sendMessage(lastUser.text, lastUser.attachments || [])
                    }
                  } catch {
                    // notice already pushed by applyApiProfile
                  }
                })()
              }}
              onRetryLastTurn={() => {
                const lastUser = [...activeTab.messages]
                  .reverse()
                  .find((msg) => msg.role === 'user')
                if (lastUser && lastUser.role === 'user') {
                  void desk.sendMessage(lastUser.text, lastUser.attachments || [])
                }
              }}
              viewMode={viewMode}
              userOnly={userOnly}
              onUserOnlyChange={setUserOnly}
              onQuickPrompt={(prompt) => void desk.sendMessage(prompt, [])}
              onChooseFolder={openHome}
              onFilesDropped={(files) => void handleFilesDropped(files)}
              onRewind={(messageId) => setRewindTarget(messageId)}
              onEdit={(messageId) => {
                void desk.beginEditMessage(messageId).then((draft) => {
                  if (draft) {
                    const tabId = activeTab.id
                    composerTexts.current[tabId] = draft.text
                    setComposerAttachments((previous) => ({
                      ...previous,
                      [tabId]: { attachments: draft.attachments, errors: [] }
                    }))
                    setComposerFocusTokens((previous) => ({
                      ...previous,
                      [tabId]: Date.now()
                    }))
                  }
                })
              }}
              onWithdraw={(messageId) => setWithdrawTarget(messageId)}
              onBranch={(messageId) => void desk.forkAtMessage(messageId)}
              onRegenerate={(messageId) => void desk.regenerate(messageId)}
              onOpenFile={(path) => {
                setPreviewLine(undefined)
                setPreviewInitialView('edit')
                setPreviewFile(path)
              }}
            />

            <div className="composer-region">
              {activePermission && activePermission.kind === 'question' && (
                <QuestionBar
                  key={activePermission.id}
                  request={activePermission}
                  onRespond={(request, decision, answers) =>
                    void desk.respondPermission(
                      activeTab.id,
                      request,
                      decision,
                      false,
                      answers
                    )
                  }
                />
              )}
              {activePermission && activePermission.kind !== 'question' && (
                <PermissionBar
                  key={activePermission.id}
                  request={activePermission}
                  queued={activeTab.permissions.length - 1}
                  planPreview={planPreview}
                  onRespond={(request, decision, always) =>
                    void desk.respondPermission(
                      activeTab.id,
                      request,
                      decision,
                      always
                    )
                  }
                />
              )}
              <div className="composer-context">
                <span>{activeTab.cwd ? basename(activeTab.cwd) : '未选择目录'}</span>
              </div>
              <Composer
                key={activeTab.id}
                running={activeTab.state.running}
                pendingTurns={activeTab.state.pendingTurns || 0}
                connecting={activeTab.state.connecting || activeTab.loadingHistory}
                initialText={composerTexts.current[activeTab.id] || ''}
                onTextChange={(text) => {
                  composerTexts.current[activeTab.id] = text
                }}
                attachments={activeComposer.attachments}
                focusToken={composerFocusTokens[activeTab.id]}
                onFocusConsumed={() => {
                  setComposerFocusTokens((previous) => {
                    if (!(activeTab.id in previous)) return previous
                    const next = { ...previous }
                    delete next[activeTab.id]
                    return next
                  })
                }}
                onAttachmentsChange={(attachments) =>
                  updateComposerAttachments({ attachments })
                }
                attachmentError={activeComposer.errors}
                onAttachmentErrorChange={(errors) =>
                  updateComposerAttachments({ errors })
                }
                onSend={(text, attachments) => {
                  void desk.sendMessage(text, attachments)
                }}
                onStop={() => void desk.stop()}
                onSearchFiles={desk.searchFiles}
                commands={activeTab.commands}
              />
              <ComposerControls
                model={activeTab.state.model}
                models={desk.models}
                effort={activeTab.effort}
                permissionMode={activeTab.state.permissionMode}
                viewMode={viewMode}
                userOnly={userOnly}
                webSearchEnabled={desk.settings?.webSearch.enabled ?? true}
                profiles={desk.settings?.profiles || []}
                activeProfileId={activeApiProfileId}
                onToggleWebSearch={() =>
                  void desk.saveWebSearch({
                    enabled: !(desk.settings?.webSearch.enabled ?? true)
                  })
                }
                onSelectProfile={(id) => {
                  void desk.applyApiProfile(id).catch(() => undefined)
                }}
                onManageProfiles={() => {
                  setSettingsTab('api')
                  desk.setSettingsOpen(true)
                }}
                onModelChange={(model) => void desk.setModel(model)}
                onEffortChange={(effort) => void desk.setEffort(effort)}
                onPermissionModeChange={(mode) => void desk.setPermissionMode(mode)}
                onViewModeChange={setViewMode}
                onUserOnlyChange={setUserOnly}
              />
              <p className="composer-note">AI 可能会出错，请检查重要操作与代码改动。</p>
            </div>
          </>
        )}

        {deskView.kind === 'chat' && !activeTab && (
          <HomeView
            workspaces={desk.settings?.preferences.recentWorkspaces || []}
            projectFolders={desk.settings?.preferences.projectFolders || []}
            workspaceFolderMap={desk.settings?.preferences.workspaceFolderMap || {}}
            hiddenSessions={desk.settings?.preferences.hiddenSessions || []}
            currentCwd={desk.cwd}
            bootError={desk.bootError}
            onOpenProject={openProject}
            onAddProject={(folderId) => {
              void desk.pickProject().then(async (path) => {
                if (!path) return
                if (folderId) {
                  const currentMap =
                    desk.settings?.preferences.workspaceFolderMap || {}
                  await desk
                    .savePreferences({
                      workspaceFolderMap: { ...currentMap, [path]: folderId }
                    })
                    .catch(() => undefined)
                }
                setDeskView({ kind: 'project', cwd: path })
              })
            }}
            onRemoveProject={(path) => void desk.removeRecentWorkspace(path)}
            onSavePreferences={desk.savePreferences}
            onOpenBackups={() => void desk.openBackupDir()}
          />
        )}
      </main>

      {deskView.kind === 'chat' && activeTab && filePanelOpen && (
        <FilePanel
          cwd={activeTab?.cwd || desk.cwd}
          onOpenFile={(path, initialView = 'edit') => {
            setPreviewLine(undefined)
            setPreviewInitialView(initialView)
            setPreviewFile(path)
          }}
          onSendPrompt={(prompt) => {
            void desk.sendMessage(prompt, [])
          }}
          onClose={() => setFilePanelOpen(false)}
        />
      )}



      {desk.settingsOpen && (
        <SettingsDialog
          initialTab={settingsTab}
          theme={desk.theme}
          language={desk.language}
          settings={desk.settings}
          models={desk.models}
          defaults={desk.defaults}
          activeTab={activeTab}
          onThemeChange={desk.setTheme}
          onLanguageChange={desk.setLanguage}
          onClose={() => desk.setSettingsOpen(false)}
          onSaveApi={async (patch) => {
            await desk.saveApi(patch)
          }}
          onSavePreferences={async (patch) => {
            await desk.savePreferences(patch)
          }}
          onTestApi={desk.testApi}
          onSavePermissionRules={desk.savePermissionRules}
          webSearch={desk.settings?.webSearch}
          onSaveWebSearch={desk.saveWebSearch}
          onTestWebSearch={desk.testWebSearch}
          onSaveCustomModel={desk.saveCustomModel}
          onDeleteCustomModel={desk.deleteCustomModel}
          onSaveApiProfile={desk.saveApiProfile}
          onDeleteApiProfile={desk.deleteApiProfile}
          onApplyApiProfile={desk.applyApiProfile}
          onOpenConsole={() => void desk.openConsole()}
          onOpenPath={(path) => void desk.openPath(path)}
          claudeCli={desk.claudeCli}
          onRefreshClaudeCli={desk.refreshClaudeCli}
          onDownloadClaudeCli={desk.downloadClaudeCli}
          onPickClaudeCli={desk.pickClaudeCli}
          onClearClaudeCliPath={() => desk.setClaudeCliPath(null)}
        />
      )}

      {desk.renameTarget && (
        <RenameDialog
          session={desk.renameTarget}
          onSave={(title) =>
            void desk.renameSession(
              desk.renameTarget!.sessionId,
              title,
              desk.renameTarget!.cwd
            )
          }
          onClose={() => desk.setRenameTarget(null)}
        />
      )}

      {copyTarget && (
        <CopySessionDialog
          session={copyTarget}
          workspaces={desk.settings?.preferences.recentWorkspaces || []}
          currentCwd={desk.cwd}
          onCopy={async (targetCwd, mode) => {
            await desk.copySession(copyTarget, targetCwd, mode)
            setDeskView({ kind: 'chat' })
          }}
          onClose={() => setCopyTarget(null)}
        />
      )}

      {deskView.kind !== 'chat' && permission && (
        <button
          type="button"
          className={`permission-toast ${
            permission.request.kind === 'question' ? 'is-question' : ''
          }`}
          onClick={() => {
            openChatView()
            desk.activateTab(permission.tabId)
          }}
        >
          <span className="status-dot" />
          {permissionTab?.title || '对话'}{' '}
          {permission.request.kind === 'question' ? '需要你的回答' : '需要你的确认'}
        </button>
      )}

      {tagTarget && (
        <TagDialog
          session={tagTarget}
          onSave={(tag) => void desk.tagSessionById(tagTarget, tag)}
          onClose={() => setTagTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="删除会话"
          message={`确定删除「${deleteTarget.customTitle || deleteTarget.summary}」吗？删除前会在本机保留一份备份。`}
          confirmLabel="删除"
          danger
          onConfirm={() => void desk.deleteSessionById(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {withdrawTarget && (
        <ConfirmDialog
          title="撤回消息"
          message="撤回后，这条消息及其后的回复会从当前对话中移除。仅回退对话，不会自动撤销文件修改。旧对话记录仍保留在本机，但不再显示在会话列表中。"
          confirmLabel="撤回"
          danger
          onConfirm={() => void desk.withdrawMessage(withdrawTarget)}
          onClose={() => setWithdrawTarget(null)}
        />
      )}

      {commandOpen && (
        <CommandPalette
          actions={commandActions}
          onClose={() => setCommandOpen(false)}
        />
      )}

      {searchOpen && (
        <WorkspaceSearchDialog
          cwd={deskView.kind === 'project' ? deskView.cwd : activeTab?.cwd || desk.cwd}
          initialMode={searchMode}
          onOpenFile={(path, line) => {
            setPreviewInitialView('edit')
            setPreviewFile(path)
            setPreviewLine(line)
          }}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {previewFile && (
        <FilePreviewDialog
          cwd={deskView.kind === 'project' ? deskView.cwd : activeTab?.cwd || desk.cwd}
          path={previewFile}
          line={previewLine}
          initialView={previewInitialView}
          onClose={() => {
            setPreviewFile(null)
            setPreviewLine(undefined)
            setPreviewInitialView('edit')
          }}
        />
      )}

      {rewindTarget && (
        <RewindDialog
          messageId={rewindTarget}
          cwd={activeTab?.cwd || desk.cwd}
          messages={activeTab?.messages || []}
          onPreview={desk.previewRewind}
          onApply={desk.applyRewind}
          onClose={() => setRewindTarget(null)}
        />
      )}
    </div>
  )
}
