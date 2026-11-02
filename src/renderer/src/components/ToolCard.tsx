import { diffLines } from 'diff'
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDot,
  FilePen,
  FilePlus2,
  FileText,
  FolderSearch,
  Globe,
  ListTodo,
  NotebookPen,
  Search,
  Terminal,
  Wrench,
  type LucideIcon
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ToolBlock } from '../types'

interface ToolMeta {
  label: string
  icon: LucideIcon
}

const TOOL_META: Record<string, ToolMeta> = {
  Bash: { label: '终端命令', icon: Terminal },
  Edit: { label: '编辑文件', icon: FilePen },
  MultiEdit: { label: '编辑文件', icon: FilePen },
  Write: { label: '写入文件', icon: FilePlus2 },
  Read: { label: '读取文件', icon: FileText },
  Glob: { label: '查找文件', icon: FolderSearch },
  Grep: { label: '搜索内容', icon: Search },
  WebFetch: { label: '获取网页', icon: Globe },
  WebSearch: { label: '网页搜索', icon: Globe },
  TodoWrite: { label: '任务清单', icon: ListTodo },
  Task: { label: '子代理', icon: Bot },
  Agent: { label: '子代理', icon: Bot },
  NotebookEdit: { label: '编辑笔记本', icon: NotebookPen }
}

function metaFor(name: string): ToolMeta {
  if (TOOL_META[name]) return TOOL_META[name]
  if (name.startsWith('mcp__')) return { label: name.replace(/^mcp__/, ''), icon: Wrench }
  return { label: name || '工具', icon: Wrench }
}

function stringField(input: Record<string, unknown>, key: string): string {
  const value = input[key]
  return typeof value === 'string' ? value : ''
}

function summarize(tool: ToolBlock): string {
  const { name, input } = tool
  if (name === 'Bash') return stringField(input, 'command').split('\n')[0] || '执行命令'
  if (name === 'Read' || name === 'Edit' || name === 'MultiEdit' || name === 'Write') {
    return stringField(input, 'file_path') || stringField(input, 'path') || ''
  }
  if (name === 'Glob') {
    const pattern = stringField(input, 'pattern')
    const path = stringField(input, 'path')
    return path ? `${pattern} · ${path}` : pattern
  }
  if (name === 'Grep') return stringField(input, 'pattern')
  if (name === 'WebFetch') return stringField(input, 'url')
  if (name === 'WebSearch') return stringField(input, 'query')
  if (name === 'Task' || name === 'Agent') {
    return stringField(input, 'description') || stringField(input, 'subagent_type')
  }
  if (name === 'TodoWrite') {
    const todos = input.todos
    return Array.isArray(todos) ? `${todos.length} 项任务` : ''
  }
  if (name === 'Skill') return stringField(input, 'skill')
  return ''
}

function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '')
}

function clip(text: string, limit = 12000): string {
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}\n\n…（已截断 ${text.length - limit} 个字符）`
}

const STATUS_TEXT: Record<ToolBlock['status'], string> = {
  pending: '等待确认',
  running: '执行中',
  done: '完成',
  error: '失败'
}

function DiffView({ before, after }: { before: string; after: string }) {
  const parts = useMemo(() => diffLines(before, after), [before, after])
  return (
    <div className="diff-view">
      {parts.map((part, index) => {
        const lines = part.value.replace(/\n$/, '').split('\n')
        const className = part.added ? 'diff-add' : part.removed ? 'diff-del' : 'diff-same'
        const sign = part.added ? '+' : part.removed ? '−' : ' '
        return (
          <div key={index} className={className}>
            {lines.map((line, lineIndex) => (
              <div className="diff-line" key={lineIndex}>
                <span className="diff-sign">{sign}</span>
                <span>{line || ' '}</span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function TodoView({ input }: { input: Record<string, unknown> }) {
  const todos = Array.isArray(input.todos) ? input.todos : []
  return (
    <ul className="todo-list">
      {todos.map((todo, index) => {
        const item = todo as Record<string, unknown>
        const status = String(item.status || 'pending')
        const Icon =
          status === 'completed' ? CheckCircle2 : status === 'in_progress' ? CircleDot : Circle
        return (
          <li key={index} className={`todo-item todo-${status}`}>
            <Icon size={15} />
            <span>{String(item.content || item.activeForm || '')}</span>
          </li>
        )
      })}
    </ul>
  )
}

function ToolBody({ tool, onOpenFile }: { tool: ToolBlock; onOpenFile?: (path: string) => void }) {
  const { name, input, result } = tool
  const output = result ? stripAnsi(result) : ''
  const filePath = stringField(input, 'file_path') || stringField(input, 'path')

  if (name === 'Bash') {
    return (
      <>
        <pre className="tool-terminal">
          <span className="terminal-prompt">$ </span>
          {stringField(input, 'command')}
        </pre>
        {output && <pre className="tool-output">{clip(output)}</pre>}
      </>
    )
  }

  if (name === 'Edit' || name === 'MultiEdit') {
    return (
      <>
        {filePath && (
          <div className="tool-file-head">
            <span className="tool-path">{filePath}</span>
            {onOpenFile && (
              <button type="button" className="mini-button" onClick={() => onOpenFile(filePath)}>
                打开文件
              </button>
            )}
          </div>
        )}
        <DiffView
          before={stringField(input, 'old_string')}
          after={stringField(input, 'new_string')}
        />
        {output && <pre className="tool-output">{clip(output)}</pre>}
      </>
    )
  }

  if (name === 'Write') {
    return (
      <>
        {filePath && (
          <div className="tool-file-head">
            <span className="tool-path">{filePath}</span>
            {onOpenFile && (
              <button type="button" className="mini-button" onClick={() => onOpenFile(filePath)}>
                打开文件
              </button>
            )}
          </div>
        )}
        <pre className="tool-output">{clip(stringField(input, 'content'))}</pre>
      </>
    )
  }

  if (name === 'TodoWrite') {
    return <TodoView input={input} />
  }

  if (name === 'Task' || name === 'Agent') {
    return (
      <>
        {stringField(input, 'prompt') && (
          <pre className="tool-output tool-prompt">{clip(stringField(input, 'prompt'), 4000)}</pre>
        )}
        {output && <pre className="tool-output">{clip(output)}</pre>}
      </>
    )
  }

  const args = Object.keys(input).length > 0 ? JSON.stringify(input, null, 2) : ''
  return (
    <>
      {tool.images && tool.images.length > 0 && (
        <div className="tool-images">
          {tool.images.map((image, index) => (
            <img key={index} src={image} alt="工具结果图片" />
          ))}
        </div>
      )}
      {filePath && onOpenFile && (
        <div className="tool-file-head">
          <span className="tool-path">{filePath}</span>
          <button type="button" className="mini-button" onClick={() => onOpenFile(filePath)}>
            打开文件
          </button>
        </div>
      )}
      {args && <pre className="tool-output tool-args">{clip(args, 4000)}</pre>}
      {output && <pre className="tool-output">{clip(output)}</pre>}
    </>
  )
}

export function ToolCard({
  tool,
  onOpenFile
}: {
  tool: ToolBlock
  onOpenFile?: (path: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const meta = metaFor(tool.name)
  const Icon = meta.icon
  const summary = summarize(tool)

  useEffect(() => {
    if (tool.status === 'error' || tool.status === 'pending') setExpanded(true)
  }, [tool.status])

  return (
    <div className={`tool-card tool-${tool.status}`}>
      <button
        type="button"
        className="tool-header"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span className="tool-icon">
          <Icon size={15} />
        </span>
        <span className="tool-label">{meta.label}</span>
        {summary && <span className="tool-summary">{summary}</span>}
        <span className={`tool-status status-${tool.status}`}>
          <span className="status-dot" />
          {STATUS_TEXT[tool.status]}
          {tool.elapsed ? ` · ${Math.round(tool.elapsed)}s` : ''}
        </span>
        <ChevronDown
          size={15}
          className={`tool-chevron ${expanded ? 'is-open' : ''}`}
        />
      </button>
      {expanded && (
        <div className="tool-body">
          <ToolBody tool={tool} onOpenFile={onOpenFile} />
        </div>
      )}
    </div>
  )
}
