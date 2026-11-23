import {
  AlertTriangle,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FolderOpen,
  ListOrdered,
  RefreshCw,
  Search,
  Upload,
  X
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent
} from 'react'
import type { ApiProfile } from '../../../shared/types'
import type { UIMessage, UserMessage } from '../types'
import { basename, greeting, truncate } from '../lib/format'
import { MessageView } from './MessageView'
import { AppMark } from './AppMark'

interface ChatViewProps {
  messages: UIMessage[]
  cwd: string
  running: boolean
  pendingTurns?: number
  connecting: boolean
  loadingHistory: boolean
  modelName: string
  error?: string
  profiles?: ApiProfile[]
  activeProfileId?: string
  onSwitchProfileAndRetry?: (profileId: string) => void
  onRetryLastTurn?: () => void
  viewMode: 'detail' | 'compact'
  userOnly: boolean
  onUserOnlyChange: (value: boolean) => void
  onQuickPrompt: (prompt: string) => void
  onChooseFolder: () => void
  onFilesDropped: (files: File[]) => void
  onRewind: (messageId: string) => void
  onEdit: (messageId: string) => void
  onWithdraw: (messageId: string) => void
  onBranch: (messageId: string) => void
  onRegenerate: (messageId: string) => void
  onOpenFile: (path: string) => void
}

const QUICK_PROMPTS = [
  '介绍一下这个项目的结构和用途',
  '帮我找出代码里的一个潜在问题并修复',
  '为当前项目补充必要的测试'
]

/**
 * Model output for the turn that started at the last user message. Thinking
 * tokens arrive before visible text, so any thinking content means the first
 * token has already reached the client.
 */
function currentTurnActivity(messages: UIMessage[]): {
  turnKey: string
  thinking: boolean
  output: boolean
} {
  let userIndex = -1
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'user') {
      userIndex = index
      break
    }
  }

  let thinking = false
  let output = false
  for (let index = userIndex + 1; index < messages.length; index += 1) {
    const message = messages[index]
    if (message.role !== 'assistant') continue
    for (const block of message.blocks) {
      if (block.kind === 'thinking') {
        if (block.text.trim()) thinking = true
      } else if (block.kind === 'tool') {
        output = true
      } else if (block.text.trim()) {
        output = true
      }
    }
  }

  return {
    turnKey: userIndex >= 0 ? messages[userIndex].id : '',
    thinking,
    output
  }
}

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
  pendingTurns = 0,
  connecting,
  loadingHistory,
  modelName,
  error,
  profiles = [],
  activeProfileId,
  onSwitchProfileAndRetry,
  onRetryLastTurn,
  viewMode,
  userOnly,
  onUserOnlyChange,
  onQuickPrompt,
  onChooseFolder,
  onFilesDropped,
  onRewind,
  onEdit,
  onWithdraw,
  onBranch,
  onRegenerate,
  onOpenFile
}: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [atBottom, setAtBottom] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [pendingJumpId, setPendingJumpId] = useState<string | null>(null)
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [findIndex, setFindIndex] = useState(0)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [selectedProfileId, setSelectedProfileId] = useState(activeProfileId || '')
  const dragDepth = useRef(0)
  const prevUserOnly = useRef(userOnly)
  const prevViewMode = useRef(viewMode)
  const atBottomRef = useRef(true)
  const scrollAnchor = useRef<{ id: string; offset: number } | null>(null)
  const userOnlyRef = useRef(userOnly)
  const userOnlyAnchor = useRef<string | null>(null)
  userOnlyRef.current = userOnly

  useEffect(() => {
    if (activeProfileId) setSelectedProfileId(activeProfileId)
    else if (profiles[0]?.id) setSelectedProfileId(profiles[0].id)
  }, [activeProfileId, profiles])

  const allUserTurns = useMemo(
    () => messages.filter((message): message is UserMessage => message.role === 'user'),
    [messages]
  )

  const matchedMessageIds = useMemo(() => {
    const needle = findQuery.trim().toLowerCase()
    if (!needle) return []
    const hits: string[] = []
    for (const message of messages) {
      if (message.role === 'user') {
        if (message.text.toLowerCase().includes(needle)) hits.push(message.id)
      } else if (message.role === 'notice') {
        if (message.text.toLowerCase().includes(needle)) hits.push(message.id)
      } else if (message.role === 'assistant') {
        const hit = message.blocks.some((block) => {
          if (block.kind === 'text' || block.kind === 'thinking') {
            return block.text.toLowerCase().includes(needle)
          }
          if (block.kind === 'tool') {
            return (
              block.name.toLowerCase().includes(needle) ||
              (block.result && block.result.toLowerCase().includes(needle)) ||
              JSON.stringify(block.input || {}).toLowerCase().includes(needle)
            )
          }
          return false
        })
        if (hit) hits.push(message.id)
      }
    }
    return hits
  }, [findQuery, messages])

  const jumpToMessageInView = useCallback((messageId: string) => {
    const element = scrollRef.current
    if (!element) return
    const target = element.querySelector<HTMLElement>(
      `[data-message-id="${CSS.escape(messageId)}"]`
    )
    if (target) {
      atBottomRef.current = false
      setAtBottom(false)
      target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    if (matchedMessageIds.length === 0) {
      setFindIndex(0)
      return
    }
    const safeIdx = Math.min(findIndex, matchedMessageIds.length - 1)
    if (safeIdx !== findIndex) setFindIndex(safeIdx)
    jumpToMessageInView(matchedMessageIds[safeIdx])
  }, [findIndex, jumpToMessageInView, matchedMessageIds])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'f'
      ) {
        if (document.querySelector('.modal-backdrop')) return
        event.preventDefault()
        setFindOpen(true)
        window.setTimeout(() => searchInputRef.current?.focus(), 20)
      } else if (event.key === 'Escape' && findOpen) {
        setFindOpen(false)
        setFindQuery('')
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [findOpen])

  const [turnSeconds, setTurnSeconds] = useState(0)
  const turn = currentTurnActivity(messages)
  // With several turns queued, the newest user message is not the turn the
  // model is working on yet, so do not report first-token latency for it.
  const turnQueued = pendingTurns > 1
  const waitingForFirstToken = running && !turnQueued && !turn.thinking && !turn.output
  const thinkingOnly = running && !turnQueued && turn.thinking && !turn.output

  useEffect(() => {
    if (!running) {
      setTurnSeconds(0)
      return
    }
    const startedAt = Date.now()
    setTurnSeconds(0)
    const timer = window.setInterval(() => {
      setTurnSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running, turn.turnKey, turnQueued])

  const userMessages = useMemo(
    () =>
      userOnly
        ? messages.filter((message): message is UserMessage => message.role === 'user')
        : [],
    [messages, userOnly]
  )

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth'): void => {
    const element = scrollRef.current
    if (!element) return
    atBottomRef.current = true
    element.scrollTo({ top: element.scrollHeight, behavior })
  }

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const onScroll = (): void => {
      const containerTop = element.getBoundingClientRect().top
      const distance = element.scrollHeight - element.scrollTop - element.clientHeight
      const bottom = distance < 100
      atBottomRef.current = bottom
      setAtBottom(bottom)
      const visible = Array.from(
        element.querySelectorAll<HTMLElement>('[data-message-id]')
      ).find((node) => node.getBoundingClientRect().bottom > containerTop)
      if (visible?.dataset.messageId) {
        scrollAnchor.current = {
          id: visible.dataset.messageId,
          offset: visible.getBoundingClientRect().top - containerTop
        }
      }
      if (userOnlyRef.current) {
        const outline = Array.from(
          element.querySelectorAll<HTMLElement>('.user-outline-item')
        ).find((node) => node.getBoundingClientRect().bottom > containerTop)
        if (outline?.dataset.messageId) {
          userOnlyAnchor.current = outline.dataset.messageId
        }
      }
    }
    element.addEventListener('scroll', onScroll, { passive: true })
    return () => element.removeEventListener('scroll', onScroll)
  }, [])

  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element) return

    // Switching compact/detailed mode changes every message height. Keep the
    // user at the bottom when they were there, otherwise preserve the first
    // visible message instead of jumping to the top of the transcript.
    if (prevViewMode.current !== viewMode) {
      prevViewMode.current = viewMode
      if (atBottomRef.current) {
        scrollToBottom('auto')
        setAtBottom(true)
      } else {
        const anchor = scrollAnchor.current
        if (anchor) {
          const target = element.querySelector<HTMLElement>(
            `[data-message-id="${CSS.escape(anchor.id)}"]`
          )
          if (target) {
            const delta =
              target.getBoundingClientRect().top -
              element.getBoundingClientRect().top -
              anchor.offset
            element.scrollTop += delta
          }
        }
      }
      return
    }

    // Jumping out of the user-only view: scroll to the chosen message, and
    // keep that position when the model replies are shown again.
    if (pendingJumpId) {
      const target = element.querySelector<HTMLElement>(
        `[data-message-id="${CSS.escape(pendingJumpId)}"]`
      )
      setAtBottom(false)
      atBottomRef.current = false
      if (target) target.scrollIntoView({ block: 'start', behavior: 'auto' })
      setPendingJumpId(null)
      prevUserOnly.current = userOnly
      return
    }

    // Entering/leaving the user-only view must not force a scroll to bottom.
    if (prevUserOnly.current !== userOnly) {
      const leavingOutline = prevUserOnly.current
      prevUserOnly.current = userOnly
      setAtBottom(false)
      atBottomRef.current = false
      if (!userOnly && leavingOutline) {
        const anchorId = userOnlyAnchor.current
        const target = anchorId
          ? element.querySelector<HTMLElement>(
              `[data-message-id="${CSS.escape(anchorId)}"]`
            )
          : null
        if (target) {
          target.scrollIntoView({ block: 'start', behavior: 'auto' })
          return
        }
        // No usable outline anchor: returning to the full transcript should
        // not dump the user at the very top.
        scrollToBottom('auto')
        setAtBottom(true)
      }
      return
    }

    if (atBottom) scrollToBottom('auto')
  }, [messages, atBottom, userOnly, pendingJumpId, viewMode])

  const jumpToUserMessage = (messageId: string): void => {
    setAtBottom(false)
    atBottomRef.current = false
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

  const activeFindMessageId =
    findOpen && matchedMessageIds.length > 0
      ? matchedMessageIds[Math.min(findIndex, matchedMessageIds.length - 1)]
      : undefined

  return (
    <div
      className="chat-wrap"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      {messages.length > 0 && (
        <div className="chat-floating-tools">
          {findOpen ? (
            <div className="chat-find-bar" role="search" aria-label="会话内搜索">
              <Search size={14} />
              <input
                ref={searchInputRef}
                type="text"
                className="chat-find-input"
                placeholder="在当前对话中搜索（Enter 下一个）…"
                value={findQuery}
                onChange={(event) => {
                  setFindQuery(event.target.value)
                  setFindIndex(0)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && matchedMessageIds.length > 0) {
                    event.preventDefault()
                    setFindIndex((current) =>
                      event.shiftKey
                        ? (current - 1 + matchedMessageIds.length) % matchedMessageIds.length
                        : (current + 1) % matchedMessageIds.length
                    )
                  }
                }}
              />
              <span className="chat-find-count">
                {findQuery.trim()
                  ? matchedMessageIds.length > 0
                    ? `${findIndex + 1}/${matchedMessageIds.length}`
                    : '0/0'
                  : ''}
              </span>
              <button
                type="button"
                className="icon-button"
                disabled={matchedMessageIds.length === 0}
                onClick={() =>
                  setFindIndex(
                    (current) =>
                      (current - 1 + matchedMessageIds.length) % matchedMessageIds.length
                  )
                }
                title="上一个匹配"
                aria-label="上一个匹配"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                className="icon-button"
                disabled={matchedMessageIds.length === 0}
                onClick={() =>
                  setFindIndex((current) => (current + 1) % matchedMessageIds.length)
                }
                title="下一个匹配"
                aria-label="下一个匹配"
              >
                <ChevronDown size={14} />
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  setFindOpen(false)
                  setFindQuery('')
                }}
                title="关闭搜索"
                aria-label="关闭搜索"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="chat-tool-pill"
              onClick={() => {
                setFindOpen(true)
                window.setTimeout(() => searchInputRef.current?.focus(), 20)
              }}
              title="会话内搜索（Ctrl/Cmd + F）"
            >
              <Search size={13} />
              <span>搜索对话</span>
            </button>
          )}

          {allUserTurns.length > 1 && !userOnly && (
            <div className="chat-timeline-wrap">
              <button
                type="button"
                className={`chat-tool-pill ${timelineOpen ? 'is-active' : ''}`}
                onClick={() => setTimelineOpen((open) => !open)}
                title="提问目录导航"
              >
                <ListOrdered size={13} />
                <span>提问目录 ({allUserTurns.length})</span>
              </button>
              {timelineOpen && (
                <div className="chat-timeline-popover">
                  <div className="chat-timeline-head">
                    <strong>本会话提问目录</strong>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setTimelineOpen(false)}
                      aria-label="关闭"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <div className="chat-timeline-list">
                    {allUserTurns.map((turnItem, idx) => (
                      <button
                        key={turnItem.id}
                        type="button"
                        className="chat-timeline-item"
                        onClick={() => {
                          jumpToMessageInView(turnItem.id)
                          setTimelineOpen(false)
                        }}
                      >
                        <span className="user-outline-index">{idx + 1}</span>
                        <span className="chat-timeline-text">
                          {truncate(turnItem.text || '（附件消息）', 56)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="chat-scroll" ref={scrollRef}>
        <div className={`chat-inner ${viewMode === 'compact' ? 'is-compact' : ''}`}>
          {error && (
            <div className="error-banner">
              <div className="error-banner-main">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
              {!running && (profiles.length > 1 || onRetryLastTurn) && (
                <div className="error-failover-bar">
                  {profiles.length > 1 && onSwitchProfileAndRetry && (
                    <>
                      <select
                        className="text-input failover-select"
                        value={selectedProfileId}
                        onChange={(event) => setSelectedProfileId(event.target.value)}
                        aria-label="选择备用配置档案"
                      >
                        {profiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.name} ({profile.model})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="mini-button"
                        onClick={() => {
                          if (selectedProfileId) onSwitchProfileAndRetry(selectedProfileId)
                        }}
                      >
                        <RefreshCw size={12} /> 切换配置并重试
                      </button>
                    </>
                  )}
                  {onRetryLastTurn && (
                    <button
                      type="button"
                      className="mini-button"
                      onClick={onRetryLastTurn}
                    >
                      <RefreshCw size={12} /> 直接重试
                    </button>
                  )}
                </div>
              )}
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
                    data-message-id={message.id}
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
              <div
                key={message.id}
                className={
                  activeFindMessageId === message.id
                    ? 'chat-message-slot is-find-active'
                    : findOpen && matchedMessageIds.includes(message.id)
                      ? 'chat-message-slot is-find-match'
                      : 'chat-message-slot'
                }
              >
                <MessageView
                  message={message}
                  revision={message.revision}
                  compact={viewMode === 'compact'}
                  actions={{ onRewind, onEdit, onWithdraw, onBranch, onRegenerate, onOpenFile }}
                />
              </div>
            ))
          )}

          {running && messages.length > 0 && (
            <div className="running-hint">
              <span className="pulse-dot" />
              {waitingForFirstToken
                ? `正在等待模型首 token… ${turnSeconds}s（上游响应慢时可继续等待或按停止）`
                : thinkingOnly
                  ? `模型正在思考… ${turnSeconds}s`
                  : `${modelName} 正在工作，按停止按钮可中断`}
              {pendingTurns > 1 ? ` · ${pendingTurns - 1} 条消息排队` : ''}
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
