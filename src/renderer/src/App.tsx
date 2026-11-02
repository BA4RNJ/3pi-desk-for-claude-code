import { useEffect, useLayoutEffect, useState } from 'react'
import type { Attachment, AttachmentFailure, SessionInfo } from '../../shared/types'
import type { ComposerDraft, TodoItem } from './types'
import { basename } from './lib/format'
import { fileToAttachment } from './lib/files'
import { setI18nLanguage, startI18n } from './i18n'
import { useDesk } from './hooks/useDesk'
import { findModel } from './lib/usage'
import { ChatView } from './components/ChatView'
import { Composer } from './components/Composer'
import { ComposerControls, type ChatViewMode } from './components/ComposerControls'
import { ConfirmDialog } from './components/ConfirmDialog'
import { FilePanel } from './components/FilePanel'
import { FilePreviewDialog } from './components/FilePreviewDialog'
import { PermissionBar } from './components/PermissionBar'
import { QuestionBar } from './components/QuestionBar'
import { RenameDialog } from './components/RenameDialog'
import { RewindDialog } from './components/RewindDialog'
import { SettingsDialog, type SettingsTab } from './components/SettingsDialog'
import { Sidebar } from './components/Sidebar'
import { AppMark } from './components/AppMark'
import { TabBar } from './components/TabBar'
import { TagDialog } from './components/TagDialog'
import { WorkspaceManager } from './components/WorkspaceManager'
import { TopBar } from './components/TopBar'

export default function App() {
  const desk = useDesk()
  const activeTab = desk.activeTab
  const [composerAttachments, setComposerAttachments] = useState<Attachment[]>([])
  const [composerDraft, setComposerDraft] = useState<ComposerDraft | null>(null)
  const [attachmentError, setAttachmentError] = useState<AttachmentFailure[]>([])
  const [viewMode, setViewMode] = useState<ChatViewMode>(() =>
    localStorage.getItem('3pi-chat-view') === 'compact' ? 'compact' : 'detail'
  )
  const [userOnly, setUserOnly] = useState(
    () => localStorage.getItem('3pi-user-only') === 'true'
  )
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general')
  const [rewindTarget, setRewindTarget] = useState<string | null>(null)
  const [tagTarget, setTagTarget] = useState<SessionInfo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SessionInfo | null>(null)
  const [withdrawTarget, setWithdrawTarget] = useState<string | null>(null)
  const [filePanelOpen, setFilePanelOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState<string | null>(null)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)

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
    setComposerAttachments([])
    setComposerDraft(null)
  }, [desk.activeTabId])

  useEffect(() => {
    localStorage.setItem('3pi-chat-view', viewMode)
  }, [viewMode])

  useEffect(() => {
    localStorage.setItem('3pi-user-only', userOnly ? 'true' : 'false')
  }, [userOnly])

  useEffect(() => {
    document.title = activeTab?.title ? `${activeTab.title} · 3PI Desk` : '3PI Desk'
  }, [activeTab?.title])

  useEffect(() => window.desk.onNewTabRequest(() => desk.newChat()), [desk.newChat])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        desk.newChat()
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 't') {
        event.preventDefault()
        desk.newChat()
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
    if (next.length > 0) {
      setComposerAttachments((current) => [...current, ...next])
    }
    setAttachmentError(failures)
  }

  if (!desk.booted || !activeTab) {
    return (
      <div className="app-loading">
        <AppMark size={66} className="app-loading-mark" />
        <span className="spinner" />
        <p>正在准备 3PI Desk…</p>
      </div>
    )
  }

  const activeSessionId = activeTab.sessionId
  const activeModelName =
    findModel(desk.models, activeTab.state.model)?.name || activeTab.state.model
  const permission = desk.currentPermission
  const permissionTab = permission ? desk.tabs[permission.tabId] : undefined
  const todos: TodoItem[] = (() => {
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
  const planPreview = permissionTab
    ? [...permissionTab.messages]
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

  return (
    <div className={`app ${filePanelOpen ? 'has-files' : ''}`}>
      <Sidebar
        cwd={activeTab.cwd || desk.cwd}
        sessions={desk.sessions}
        activeSessionId={activeSessionId}
        connecting={activeTab.state.connecting}
        theme={desk.theme}
        pinnedSessions={desk.settings?.preferences.pinnedSessions || []}
        hiddenSessions={desk.settings?.preferences.hiddenSessions || []}
        onNew={() => desk.newChat()}
        onSelect={(session) => void desk.selectSession(session.sessionId, session.cwd)}
        onChooseFolder={() => setWorkspaceOpen(true)}
        onRename={(session) => desk.setRenameTarget(session)}
        onTag={(session) => setTagTarget(session)}
        onExport={(session) => void desk.exportSessionById(session)}
        onFork={(sessionId) => void desk.forkSession(sessionId)}
        onPin={(sessionId) => void desk.pinSession(sessionId)}
        onDelete={(session) => setDeleteTarget(session)}
        onRefresh={() => void desk.refreshSessions()}
        onThemeChange={desk.setTheme}
        onOpenSettings={() => {
          setSettingsTab('general')
          desk.setSettingsOpen(true)
        }}
      />

      <main className="main">
        <TopBar
          title={activeTab.title}
          cwd={activeTab.cwd || desk.cwd}
          models={desk.models}
          stats={activeTab.state.stats}
          context={activeTab.state.context}
          usage={activeTab.usage}
          tasks={activeTab.tasks}
          todos={todos}
          running={activeTab.state.running}
          onOpenUsage={() => {
            setSettingsTab('usage')
            desk.setSettingsOpen(true)
          }}
          onToggleFiles={() => setFilePanelOpen((open) => !open)}
          filesOpen={filePanelOpen}
          onOpenPath={(path) => void desk.openPath(path)}
        />

        <TabBar
          tabs={desk.tabs}
          tabOrder={desk.tabOrder}
          activeTabId={desk.activeTabId}
          onActivate={desk.activateTab}
          onClose={desk.closeTab}
          onNew={() => desk.newChat()}
        />

        <ChatView
          messages={activeTab.messages}
          cwd={activeTab.cwd || desk.cwd}
          running={activeTab.state.running}
          connecting={activeTab.state.connecting}
          loadingHistory={activeTab.loadingHistory}
          modelName={activeModelName}
          error={activeTab.state.error}
          viewMode={viewMode}
          userOnly={userOnly}
          onUserOnlyChange={setUserOnly}
          onQuickPrompt={(prompt) => void desk.sendMessage(prompt, [])}
          onChooseFolder={() => setWorkspaceOpen(true)}
          onFilesDropped={(files) => void handleFilesDropped(files)}
          onRewind={(messageId) => setRewindTarget(messageId)}
          onEdit={(messageId) => {
            void desk.beginEditMessage(messageId).then((draft) => {
              if (draft) setComposerDraft({ ...draft, token: Date.now() })
            })
          }}
          onWithdraw={(messageId) => setWithdrawTarget(messageId)}
          onBranch={(messageId) => void desk.forkAtMessage(messageId)}
          onRegenerate={(messageId) => void desk.regenerate(messageId)}
          onOpenFile={(path) => setPreviewFile(path)}
        />

        <div className="composer-region">
          {permission && permission.request.kind === 'question' && (
            <QuestionBar
              request={permission.request}
              tabTitle={permission.tabTitle}
              onSwitchTab={
                permission.tabId !== desk.activeTabId
                  ? () => desk.activateTab(permission.tabId)
                  : undefined
              }
              onRespond={(request, decision, answers) =>
                void desk.respondPermission(
                  permission.tabId,
                  request,
                  decision,
                  false,
                  answers
                )
              }
            />
          )}
          {permission && permission.request.kind !== 'question' && (
            <PermissionBar
              request={permission.request}
              queued={Object.values(desk.tabs).reduce(
                (total, tab) => total + tab.permissions.length,
                0
              ) - 1}
              tabTitle={permission.tabTitle}
              planPreview={planPreview}
              onSwitchTab={
                permission.tabId !== desk.activeTabId
                  ? () => desk.activateTab(permission.tabId)
                  : undefined
              }
              onRespond={(request, decision, always) =>
                void desk.respondPermission(
                  permission.tabId,
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
            running={activeTab.state.running}
            connecting={activeTab.state.connecting || activeTab.loadingHistory}
            attachments={composerAttachments}
            draft={composerDraft}
            onAttachmentsChange={setComposerAttachments}
            attachmentError={attachmentError}
            onAttachmentErrorChange={setAttachmentError}
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
            onModelChange={(model) => void desk.setModel(model)}
            onEffortChange={(effort) => void desk.setEffort(effort)}
            onPermissionModeChange={(mode) => void desk.setPermissionMode(mode)}
            onViewModeChange={setViewMode}
            onUserOnlyChange={setUserOnly}
          />
          <p className="composer-note">AI 可能会出错，请检查重要操作与代码改动。</p>
        </div>
      </main>

      {filePanelOpen && (
        <FilePanel
          cwd={activeTab.cwd || desk.cwd}
          onOpenFile={(path) => setPreviewFile(path)}
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
          onSaveCustomModel={desk.saveCustomModel}
          onDeleteCustomModel={desk.deleteCustomModel}
          onSaveApiProfile={desk.saveApiProfile}
          onDeleteApiProfile={desk.deleteApiProfile}
          onApplyApiProfile={desk.applyApiProfile}
          onOpenConsole={() => void desk.openConsole()}
          onOpenPath={(path) => void desk.openPath(path)}
        />
      )}

      {desk.renameTarget && (
        <RenameDialog
          session={desk.renameTarget}
          onSave={(title) => void desk.renameSession(desk.renameTarget!.sessionId, title)}
          onClose={() => desk.setRenameTarget(null)}
        />
      )}

      {workspaceOpen && (
        <WorkspaceManager
          currentCwd={activeTab.cwd || desk.cwd}
          workspaces={desk.settings?.preferences.recentWorkspaces || []}
          onOpen={(path) => {
            desk.openWorkspace(path)
            setWorkspaceOpen(false)
          }}
          onAdd={() => {
            void desk.chooseFolder()
            setWorkspaceOpen(false)
          }}
          onRemove={(path) => void desk.removeRecentWorkspace(path)}
          onOpenBackups={() => void desk.openBackupDir()}
          onClose={() => setWorkspaceOpen(false)}
        />
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

      {previewFile && (
        <FilePreviewDialog
          cwd={activeTab.cwd || desk.cwd}
          path={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}

      {rewindTarget && (
        <RewindDialog
          messageId={rewindTarget}
          onPreview={desk.previewRewind}
          onApply={desk.applyRewind}
          onClose={() => setRewindTarget(null)}
        />
      )}
    </div>
  )
}
