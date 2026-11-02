import {
  Copy,
  FileText,
  GitBranch,
  Pencil,
  RefreshCw,
  RotateCcw,
  Sparkles
} from 'lucide-react'
import { useState } from 'react'
import type { AssistantMessage, UIMessage, UserMessage } from '../types'
import { Markdown } from './Markdown'
import { Starburst } from './Starburst'
import { ToolCard } from './ToolCard'

function ThinkingBlockView({ text, streaming }: { text: string; streaming: boolean }) {
  const [open, setOpen] = useState(streaming)

  return (
    <div className={`thinking ${open ? 'is-open' : ''}`}>
      <button type="button" className="thinking-toggle" onClick={() => setOpen((v) => !v)}>
        <ChevronIcon />
        <Sparkles size={14} />
        <span>{streaming ? '正在思考…' : '思考过程'}</span>
      </button>
      {open && <div className="thinking-text">{text}</div>}
    </div>
  )
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="thinking-chevron">
      <path
        d="M9 18l6-6-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface MessageActions {
  onRewind: (messageId: string) => void
  onEdit: (messageId: string) => void
  onBranch: (messageId: string) => void
  onRegenerate: (messageId: string) => void
  onOpenFile: (path: string) => void
}

function copyText(text: string): void {
  void navigator.clipboard.writeText(text).catch(() => undefined)
}

function AssistantView({
  message,
  actions
}: {
  message: AssistantMessage
  actions: MessageActions
}) {
  const plainText = message.blocks
    .map((block) => (block.kind === 'text' ? block.text : ''))
    .filter(Boolean)
    .join('\n\n')
  return (
    <div className="message message-assistant">
      <div className="avatar">
        <Starburst size={17} />
      </div>
      <div className="message-body">
        {message.parentToolUseId && <span className="subagent-badge">子代理</span>}
        {message.blocks.map((block, index) => {
          if (block.kind === 'text') {
            return <Markdown key={`text-${index}`}>{block.text}</Markdown>
          }
          if (block.kind === 'thinking') {
            return (
              <ThinkingBlockView
                key={`thinking-${index}`}
                text={block.text}
                streaming={message.streaming}
              />
            )
          }
          return (
            <ToolCard
              key={`tool-${block.id}`}
              tool={block}
              onOpenFile={actions.onOpenFile}
            />
          )
        })}
        {message.streaming && message.blocks.length === 0 && (
          <div className="thinking-placeholder">
            <span className="pulse-dot" />
            <span className="pulse-dot" />
            <span className="pulse-dot" />
          </div>
        )}
        {!message.streaming && (
          <div className="message-actions">
            {plainText && (
              <button type="button" onClick={() => copyText(plainText)} title="复制回复">
                <Copy size={12} /> 复制
              </button>
            )}
            <button
              type="button"
              onClick={() => actions.onRegenerate(message.id)}
              title="重新生成这条回复"
            >
              <RefreshCw size={12} /> 重新生成
            </button>
            {message.transcriptId && (
              <button
                type="button"
                onClick={() => actions.onBranch(message.id)}
                title="从这条回复创建分支"
              >
                <GitBranch size={12} /> 分支
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function UserView({
  message,
  actions
}: {
  message: UserMessage
  actions: MessageActions
}) {
  return (
    <div className="message message-user">
      <div className="user-message-wrap">
        <div className="user-bubble">
          {message.attachments && message.attachments.length > 0 && (
            <div className="user-attachments">
              {message.attachments.map((attachment, index) =>
                attachment.kind === 'image' ? (
                  <img
                    key={`${attachment.name}-${index}`}
                    className="user-image"
                    src={`data:${attachment.mediaType};base64,${attachment.data}`}
                    alt={attachment.name}
                  />
                ) : (
                  <span key={`${attachment.name}-${index}`} className="user-file-chip">
                    <FileText size={12} />
                    {attachment.name}
                  </span>
                )
              )}
            </div>
          )}
          {message.text && <div className="user-text">{message.text}</div>}
        </div>
        <div className="message-actions user-actions">
          {message.rewindId && (
            <button
              type="button"
              onClick={() => actions.onRewind(message.rewindId as string)}
              title="恢复文件到此消息"
            >
              <RotateCcw size={12} /> 恢复文件
            </button>
          )}
          <button type="button" onClick={() => actions.onEdit(message.id)} title="编辑并重发">
            <Pencil size={12} /> 编辑
          </button>
          {message.transcriptId && (
            <button type="button" onClick={() => actions.onBranch(message.id)} title="从这里创建分支">
              <GitBranch size={12} /> 分支
            </button>
          )}
          {message.text && (
            <button type="button" onClick={() => copyText(message.text)} title="复制">
              <Copy size={12} /> 复制
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function MessageView({
  message,
  actions
}: {
  message: UIMessage
  actions: MessageActions
}) {
  if (message.role === 'user') {
    return <UserView message={message} actions={actions} />
  }

  if (message.role === 'notice') {
    return (
      <div className={`notice notice-${message.tone}`}>
        <span>{message.text}</span>
      </div>
    )
  }

  return <AssistantView message={message} actions={actions} />
}
