import { AlertTriangle, ArrowDown, ChevronRight, FolderOpen, Upload } from 'lucide-react'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent
} from 'react'
import type { UIMessage, UserMessage } from '../types'
import { basename, greeting } from '../lib/format'
import { MessageView } from './MessageView'
import { AppMark } from './AppMark'

interface ChatViewProps {
  messages: UIMessage[]
  cwd: string
  running: boolean
  connecting: boolean
  loadingHistory: boolean
  modelName: string
  error?: string
  viewMode: 'detail' | 'compact'
  userOnly: boolean
  onUserOnlyChange: (value: boolean) => void
  onQuickPrompt: (prompt: string) => void
  onChooseFolder: () => void
  onFilesDropped: (files: File[]) => void
  onRewind: (messageId: string) => void
  onEdit: (messageId: string) => void
  onBranch: (messageId: string) => void
  onRegenerate: (messageId: string) => void
  onOpenFile: (path: string) => void
}

const QUICK_PROMPTS = [
  '介绍一下这个项目的结构和用途',
  '帮我找出代码里的一个潜在问题并修复',
  '为当前项目补充必要的测试'
]

function Welcome({
  cwd,
  onQuickPrompt,
  onChooseFolder
}: Pick<ChatViewProps, 'cwd' | 'onQuickPrompt' | 'onChooseFolder'>) {
  return (
    <div className="welcome">
      <AppMark size={76} className="welcome-mark" />
      <h1>{greeting()}，今天想一起构建什么？</h1>
      <p className="welcome-sub">
        在本地项目中与 AI 协作。所有命令与文件修改都会先征求你的同意。
      </p>
      <button type="button" className="folder-pill" onClick={onChooseFolder}>
        <FolderOpen size={15} />
        <span>{cwd ? basename(cwd) : '选择项目文件夹'}</span>
      </button>
      <div className="quick-prompts">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="quick-prompt"
            onClick={() => onQuickPrompt(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ChatView({
  messages,
  cwd,
  running,
  connecting,
  loadingHistory,
  modelName,
  error,
  viewMode,
  userOnly,
  onUserOnlyChange,
  onQuickPrompt,
  onChooseFolder,
  onFilesDropped,
  onRewind,
  onEdit,
  onBranch,
  onRegenerate,
  onOpenFile
}: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [pendingJumpId, setPendingJumpId] = useState<string | null>(null)
  const dragDepth = useRef(0)
  const prevUserOnly = useRef(userOnly)

  const userMessages = useMemo(
    () => messages.filter((message): message is UserMessage => message.role === 'user'),
    [messages]
  )

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth'): void => {
    const element = scrollRef.current
    if (!element) return
    element.scrollTo({ top: element.scrollHeight, behavior })
  }

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const onScroll = (): void => {
      const distance = element.scrollHeight - element.scrollTop - element.clientHeight
      setAtBottom(distance < 100)
    }
    element.addEventListener('scroll', onScroll, { passive: true })
    return () => element.removeEventListener('scroll', onScroll)
  }, [])

  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element) return

    // Jumping out of the user-only view: scroll to the chosen message, and
    // keep that position when the model replies are shown again.
    if (pendingJumpId) {
      const target = element.querySelector<HTMLElement>(
        `[data-message-id="${CSS.escape(pendingJumpId)}"]`
      )
      setAtBottom(false)
      if (target) target.scrollIntoView({ block: 'start', behavior: 'auto' })
      setPendingJumpId(null)
      return
    }

    // Entering/leaving the user-only view must not force a scroll to bottom.
    if (prevUserOnly.current !== userOnly) {
      prevUserOnly.current = userOnly
      setAtBottom(false)
      return
    }

    if (atBottom) scrollToBottom('auto')
  }, [messages, atBottom, userOnly, pendingJumpId])

  const jumpToUserMessage = (messageId: string): void => {
    setAtBottom(false)
    setPendingJumpId(messageId)
    onUserOnlyChange(false)
  }

  const empty = messages.length === 0 && !loadingHistory

  const handleDragEnter = (event: DragEvent<HTMLDivElement>): void => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>): void => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    dragDepth.current -= 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      setDragging(false)
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    if (event.dataTransfer.files.length === 0) return
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    onFilesDropped(Array.from(event.dataTransfer.files))
  }

  return (
    <div
      className="chat-wrap"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="chat-scroll" ref={scrollRef}>
        <div className={`chat-inner ${viewMode === 'compact' ? 'is-compact' : ''}`}>
          {error && (
            <div className="error-banner">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {loadingHistory && (
            <div className="history-loading">
              <span className="spinner" />
              正在载入会话…
            </div>
          )}

          {empty && !connecting && (
            <Welcome
              cwd={cwd}
              onQuickPrompt={onQuickPrompt}
              onChooseFolder={onChooseFolder}
            />
          )}

          {empty && connecting && (
            <div className="connecting-card">
              <span className="spinner" />
              <div>
                <strong>正在连接模型</strong>
                <span>初始化本地会话与项目上下文…</span>
              </div>
            </div>
          )}

          {userOnly ? (
            userMessages.length > 0 ? (
              <div className="user-outline">
                <p className="user-outline-hint">点击任意消息跳转到完整对话</p>
                {userMessages.map((message, index) => (
                  <button
                    key={message.id}
                    type="button"
                    className="user-outline-item"
                    onClick={() => jumpToUserMessage(message.id)}
                  >
                    <span className="user-outline-index">{index + 1}</span>
                    <span className="user-outline-body">
                      <span className="user-outline-text">
                        {message.text || '（附件消息）'}
                      </span>
                      {message.attachments && message.attachments.length > 0 && (
                        <span className="user-outline-meta">
                          {message.attachments.length} 个附件
                        </span>
                      )}
                    </span>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="user-outline-empty">还没有发送过消息</div>
            )
          ) : (
            messages.map((message) => (
              <MessageView
                key={message.id}
                message={message}
                compact={viewMode === 'compact'}
                actions={{ onRewind, onEdit, onBranch, onRegenerate, onOpenFile }}
              />
            ))
          )}

          {running && messages.length > 0 && (
            <div className="running-hint">
              <span className="pulse-dot" />
              {modelName} 正在工作，按停止按钮可中断
            </div>
          )}
        </div>
      </div>

      {dragging && (
        <div className="drop-overlay">
          <Upload size={26} />
          <strong>松开以添加图片或文件</strong>
        </div>
      )}

      {!atBottom && messages.length > 0 && !userOnly && (
        <button
          type="button"
          className="scroll-bottom"
          onClick={() => scrollToBottom()}
          aria-label="滚动到底部"
        >
          <ArrowDown size={16} />
        </button>
      )}
    </div>
  )
}
