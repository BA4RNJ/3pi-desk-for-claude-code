import { ArrowUp, Command, FileText, Paperclip, Square, X } from 'lucide-react'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent
} from 'react'
import type {
  Attachment,
  AttachmentFailure,
  FileEntry,
  SlashCommandInfo
} from '../../../shared/types'
import { failureText } from '../../../shared/attachments'
import { fileToAttachment } from '../lib/files'

interface ComposerProps {
  running: boolean
  pendingTurns?: number
  connecting: boolean
  initialText: string
  onTextChange: (value: string) => void
  attachments: Attachment[]
  focusToken?: number
  onFocusConsumed?: () => void
  onAttachmentsChange: (attachments: Attachment[]) => void
  attachmentError: AttachmentFailure[]
  onAttachmentErrorChange: (errors: AttachmentFailure[]) => void
  onSend: (text: string, attachments: Attachment[]) => void
  onStop: () => void
  onSearchFiles: (query: string) => Promise<FileEntry[]>
  commands: SlashCommandInfo[]
  placeholder?: string
  slashMenuPlacement?: 'above' | 'below'
}

interface MentionState {
  start: number
  end: number
  query: string
}

export function Composer({
  running,
  pendingTurns = 0,
  connecting,
  initialText,
  onTextChange,
  attachments,
  focusToken,
  onFocusConsumed,
  onAttachmentsChange,
  attachmentError,
  onAttachmentErrorChange,
  onSend,
  onStop,
  onSearchFiles,
  commands,
  placeholder = '输入消息…  输入 / 查看命令 · @ 引用文件',
  slashMenuPlacement = 'above'
}: ComposerProps) {
  const [value, setValue] = useState(initialText)
  const [mention, setMention] = useState<MentionState | null>(null)
  const [results, setResults] = useState<FileEntry[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [slashDismissed, setSlashDismissed] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const slashMenuRef = useRef<HTMLDivElement>(null)
  const mentionTimer = useRef<number | null>(null)

  const updateValue = (next: string): void => {
    setValue(next)
    onTextChange(next)
  }

  useEffect(() => {
    if (!focusToken) return
    const next = initialText
    setValue(next)
    onTextChange(next)
    setMention(null)
    setSlashDismissed(false)
    requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    })
    onFocusConsumed?.()
    // The token is the trigger; initialText is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken])

  const slashQuery =
    !slashDismissed && value.startsWith('/') && !value.includes(' ')
      ? value.slice(1).toLowerCase()
      : null
  const slashResults =
    slashQuery !== null
      ? commands
          .filter((command) => {
            if (!slashQuery) return true
            return (
              command.name.toLowerCase().includes(slashQuery) ||
              command.aliases?.some((alias) => alias.toLowerCase().includes(slashQuery)) ||
              command.description.toLowerCase().includes(slashQuery)
            )
          })
      : []

  useLayoutEffect(() => {
    const menu = slashMenuRef.current
    if (!menu) return
    const item = menu.querySelector<HTMLElement>(`[data-slash-index="${selectedIndex}"]`)
    if (!item) return
    const menuRect = menu.getBoundingClientRect()
    const itemRect = item.getBoundingClientRect()
    if (itemRect.top < menuRect.top) {
      menu.scrollTop -= menuRect.top - itemRect.top
    } else if (itemRect.bottom > menuRect.bottom) {
      menu.scrollTop += itemRect.bottom - menuRect.bottom
    }
  }, [selectedIndex, slashQuery])

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`
  }, [value])

  useEffect(() => {
    if (!mention || mention.query.length === 0) {
      setResults([])
      return
    }
    if (mentionTimer.current !== null) window.clearTimeout(mentionTimer.current)
    mentionTimer.current = window.setTimeout(() => {
      onSearchFiles(mention.query)
        .then((files) => {
          setResults(files.slice(0, 8))
          setSelectedIndex(0)
        })
        .catch(() => setResults([]))
    }, 140)
    return () => {
      if (mentionTimer.current !== null) window.clearTimeout(mentionTimer.current)
    }
  }, [mention, onSearchFiles])

  const addFiles = async (files: FileList | File[]): Promise<void> => {
    const next: Attachment[] = []
    const failures: AttachmentFailure[] = []
    for (const file of Array.from(files)) {
      const result = await fileToAttachment(file)
      if (result.attachment) next.push(result.attachment)
      else failures.push({ name: file.name || '附件', reason: result.reason || 'unreadable' })
    }
    if (next.length > 0) onAttachmentsChange([...attachments, ...next])
    onAttachmentErrorChange(failures)
  }

  const submit = (): void => {
    const text = value.trim()
    if (!text && attachments.length === 0) return
    onSend(text, attachments)
    updateValue('')
    onAttachmentsChange([])
    onAttachmentErrorChange([])
    setMention(null)
    textareaRef.current?.focus()
  }

  const pickFiles = async (): Promise<void> => {
    const picked = await window.desk.pickFiles()
    if (picked.attachments.length > 0) {
      onAttachmentsChange([...attachments, ...picked.attachments])
    }
    onAttachmentErrorChange(picked.errors)
  }

  const selectCommand = (command: SlashCommandInfo): void => {
    updateValue(`/${command.name} `)
    setSlashDismissed(true)
    requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.focus()
      const cursor = command.name.length + 2
      textarea.setSelectionRange(cursor, cursor)
    })
  }

  const selectMention = (file: FileEntry): void => {
    if (!mention) return
    const before = value.slice(0, mention.start)
    const after = value.slice(mention.end)
    const next = `${before}@${file.relativePath} ${after}`
    updateValue(next)
    setMention(null)
    requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      const cursor = before.length + 1 + file.relativePath.length + 1
      textarea.focus()
      textarea.setSelectionRange(cursor, cursor)
    })
  }

  const updateMention = (nextValue: string, caret: number): void => {
    const before = nextValue.slice(0, caret)
    const match = before.match(/(^|\s)@([^\s@]*)$/)
    if (!match) {
      setMention(null)
      return
    }
    const query = match[2]
    setMention({
      start: caret - query.length - 1,
      end: caret,
      query
    })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (slashResults.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((index) => (index + 1) % slashResults.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((index) => (index - 1 + slashResults.length) % slashResults.length)
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        selectCommand(slashResults[selectedIndex] || slashResults[0])
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setSlashDismissed(true)
        return
      }
    }
    if (mention && results.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((index) => (index + 1) % results.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((index) => (index - 1 + results.length) % results.length)
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        selectMention(results[selectedIndex])
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setMention(null)
        return
      }
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>): void => {
    if (event.clipboardData.files.length === 0) return
    event.preventDefault()
    void addFiles(event.clipboardData.files)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    if (event.dataTransfer.files.length === 0) return
    event.preventDefault()
    event.stopPropagation()
    void addFiles(event.dataTransfer.files)
  }

  return (
    <div className="composer-wrap" onDrop={handleDrop} onDragOver={(event) => event.preventDefault()}>
      {(attachments.length > 0 || attachmentError.length > 0) && (
        <div className="attachment-box">
          {attachments.length > 0 && (
            <div className="attachment-strip">
              {attachments.map((attachment, index) => (
                <div key={`${attachment.name}-${index}`} className="attachment-chip">
                  {attachment.kind === 'image' ? (
                    <img
                      className="attachment-thumb"
                      src={`data:${attachment.mediaType};base64,${attachment.data}`}
                      alt={attachment.name}
                    />
                  ) : (
                    <span className="attachment-icon">
                      <FileText size={14} />
                    </span>
                  )}
                  <span className="attachment-name">{attachment.name}</span>
                  <button
                    type="button"
                    className="attachment-remove"
                    aria-label="移除附件"
                    onClick={() =>
                      onAttachmentsChange(attachments.filter((_, item) => item !== index))
                    }
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {attachmentError.length > 0 && (
            <div className="attachment-error" role="alert">
              {attachmentError.map((failure, index) => (
                <span key={`${failure.name}-${index}`} className="attachment-error-item">
                  {failure.name}：{failureText(failure.reason)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={`composer ${running ? 'is-running' : ''}`}>
        {slashResults.length > 0 && (
          <div
            ref={slashMenuRef}
            className={`mention-menu slash-menu ${slashMenuPlacement === 'below' ? 'is-below' : ''}`}
          >
            {slashResults.map((command, index) => (
              <button
                key={`${command.name}-${index}`}
                type="button"
                data-slash-index={index}
                className={`mention-item slash-item ${index === selectedIndex ? 'is-selected' : ''}`}
                onMouseDown={(event) => {
                  event.preventDefault()
                  selectCommand(command)
                }}
              >
                <Command size={13} />
                <span className="slash-name">/{command.name}</span>
                <small>{command.description}</small>
                {command.argumentHint && <em>{command.argumentHint}</em>}
              </button>
            ))}
          </div>
        )}
        {mention && results.length > 0 && (
          <div className="mention-menu">
            {results.map((file, index) => (
              <button
                key={file.path}
                type="button"
                className={`mention-item ${index === selectedIndex ? 'is-selected' : ''}`}
                onMouseDown={(event) => {
                  event.preventDefault()
                  selectMention(file)
                }}
              >
                <FileText size={13} />
                <span>{file.relativePath}</span>
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          placeholder={placeholder}
          spellCheck={false}
          onChange={(event) => {
            const next = event.target.value
            updateValue(next)
            setSlashDismissed(false)
            setSelectedIndex(0)
            updateMention(next, event.target.selectionStart)
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onClick={(event) =>
            updateMention(value, event.currentTarget.selectionStart)
          }
        />
        <div className="composer-footer">
          <div className="composer-tools">
            <button
              type="button"
              className="composer-icon-button"
              onClick={() => void pickFiles()}
              title="添加图片、PDF 或文本文件"
              aria-label="添加图片、PDF 或文本文件"
            >
              <Paperclip size={15} />
            </button>
            <span className="composer-hint">
              {connecting
                ? '正在连接…'
                : running
                  ? pendingTurns > 1
                    ? `运行中 · ${pendingTurns - 1} 条排队`
                    : '运行中 · 发送将排队'
                  : 'Enter 发送 · Shift+Enter 换行'}
            </span>
          </div>
          <div className="composer-actions">
            {running && (
              <button
                type="button"
                className="send-button stop-button"
                onClick={onStop}
                aria-label="停止生成"
                title="停止生成"
              >
                <Square size={14} fill="currentColor" />
              </button>
            )}
            <button
              type="button"
              className="send-button"
              disabled={!value.trim() && attachments.length === 0}
              onClick={submit}
              aria-label={running ? '排队发送' : '发送消息'}
              title={running ? '排队发送' : '发送'}
            >
              <ArrowUp size={17} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
