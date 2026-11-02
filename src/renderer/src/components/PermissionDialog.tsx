import { ShieldAlert, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { PermissionRequestPayload } from '../../../shared/types'
import { formatJson, truncate } from '../lib/format'
import { Markdown } from './Markdown'

interface PermissionDialogProps {
  request: PermissionRequestPayload
  queued: number
  tabTitle?: string
  planPreview?: string
  onRespond: (
    request: PermissionRequestPayload,
    decision: 'allow' | 'deny',
    always?: boolean
  ) => void
}

function toolLabel(name: string): string {
  const labels: Record<string, string> = {
    Bash: '执行终端命令',
    Edit: '编辑文件',
    MultiEdit: '编辑文件',
    Write: '写入文件',
    Read: '读取文件',
    Glob: '查找文件',
    Grep: '搜索内容',
    WebFetch: '访问网页',
    WebSearch: '网页搜索',
    TodoWrite: '更新任务清单',
    Task: '启动子代理',
    Agent: '启动子代理',
    ExitPlanMode: '确认执行计划',
    AskUserQuestion: '向你提问'
  }
  if (labels[name]) return labels[name]
  if (name.startsWith('mcp__')) return `调用 ${name.replace(/^mcp__/, '')}`
  return `使用工具 ${name}`
}

function stringField(input: Record<string, unknown>, key: string): string {
  const value = input[key]
  return typeof value === 'string' ? value : ''
}

function suggestionSummary(suggestions?: unknown[]): string {
  const labels = new Set<string>()
  for (const item of suggestions || []) {
    const suggestion = item as Record<string, any>
    if (
      (suggestion.type === 'addRules' || suggestion.type === 'replaceRules') &&
      Array.isArray(suggestion.rules)
    ) {
      for (const rule of suggestion.rules) {
        labels.add(
          rule.ruleContent ? `${rule.toolName}(${rule.ruleContent})` : String(rule.toolName)
        )
      }
    } else if (suggestion.type === 'addDirectories' && Array.isArray(suggestion.directories)) {
      for (const directory of suggestion.directories) labels.add(`目录 ${directory}`)
    }
  }
  return Array.from(labels).join('、')
}

function InputPreview({ request }: { request: PermissionRequestPayload }) {
  const { toolName, input, blockedPath } = request

  if (toolName === 'Bash') {
    return (
      <div className="permission-preview">
        <span className="preview-label">将运行以下命令</span>
        <pre className="tool-terminal">
          <span className="terminal-prompt">$ </span>
          {stringField(input, 'command')}
        </pre>
      </div>
    )
  }

  if (['Edit', 'MultiEdit', 'Write', 'Read'].includes(toolName)) {
    const path = stringField(input, 'file_path')
    const before = stringField(input, 'old_string')
    const after = stringField(input, 'new_string')
    return (
      <div className="permission-preview">
        <span className="preview-label">文件</span>
        <div className="tool-path">{path || blockedPath || '未知路径'}</div>
        {before && (
          <div className="permission-diff">
            <div className="permission-diff-row removed">− {before.slice(0, 400)}</div>
            <div className="permission-diff-row added">+ {after.slice(0, 400)}</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="permission-preview">
      <span className="preview-label">参数</span>
      <pre className="tool-output tool-args">{formatJson(input).slice(0, 4000)}</pre>
    </div>
  )
}

export function PermissionDialog({
  request,
  queued,
  tabTitle,
  planPreview,
  onRespond
}: PermissionDialogProps) {
  const denyRef = useRef<HTMLButtonElement>(null)
  const scope = suggestionSummary(request.suggestions)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onRespond(request, 'deny')
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onRespond, request])

  useEffect(() => {
    if (request.defaultToNo) denyRef.current?.focus()
  }, [request.defaultToNo, request.id])

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="permission-dialog" role="dialog" aria-modal="true" aria-label="权限确认">
        <button
          type="button"
          className="dialog-close"
          onClick={() => onRespond(request, 'deny')}
          aria-label="拒绝并关闭"
        >
          <X size={16} />
        </button>

        <div className="permission-header">
          <span className="permission-icon">
            <ShieldAlert size={20} />
          </span>
          <div>
            <h2>
              {request.kind === 'plan' ? '计划已准备好' : '需要你的确认'}
            </h2>
            <p>
              {request.kind === 'plan'
                ? `已完成规划，批准后将开始执行${tabTitle ? ` · ${tabTitle}` : ''}`
                : `请求${toolLabel(request.toolName)}${tabTitle ? ` · ${tabTitle}` : ''}`}
              {queued > 0 ? ` · 还有 ${queued} 个请求等待处理` : ''}
            </p>
          </div>
        </div>

        {request.title && request.kind !== 'question' && (
          <div className="permission-title">{request.title}</div>
        )}

        {request.kind === 'plan' && planPreview && (
          <div className="plan-preview">
            <Markdown>{planPreview}</Markdown>
          </div>
        )}
        {request.description && (
          <div className="permission-description">{request.description}</div>
        )}
        {request.decisionReason && (
          <div className="permission-reason">原因：{request.decisionReason}</div>
        )}

        <InputPreview request={request} />

        <div className="permission-actions">
          <button
            ref={denyRef}
            type="button"
            className="button ghost"
            onClick={() => onRespond(request, 'deny')}
          >
            拒绝
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => onRespond(request, 'allow')}
          >
            允许一次
          </button>
          {request.allowAlways && !request.defaultToNo && (
            <button
              type="button"
              className="button primary"
              onClick={() => onRespond(request, 'allow', true)}
            >
              本会话允许
            </button>
          )}
        </div>
        {request.allowAlways && !request.defaultToNo && scope && (
          <p className="permission-scope">
            本会话允许后不再询问：{truncate(scope, 150)}
          </p>
        )}
      </div>
    </div>
  )
}
