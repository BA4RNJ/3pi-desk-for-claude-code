import { ChevronDown, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import type { PermissionRequestPayload } from '../../../shared/types'
import { formatJson, truncate } from '../lib/format'
import { Markdown } from './Markdown'

interface PermissionBarProps {
  request: PermissionRequestPayload
  queued: number
  tabTitle?: string
  planPreview?: string
  onRespond: (
    request: PermissionRequestPayload,
    decision: 'allow' | 'deny',
    always?: boolean
  ) => void
  onSwitchTab?: () => void
}

const TOOL_LABELS: Record<string, string> = {
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
  ExitPlanMode: '确认执行计划'
}

function toolLabel(name: string): string {
  if (TOOL_LABELS[name]) return TOOL_LABELS[name]
  if (name.startsWith('mcp__')) return `调用 ${name.replace(/^mcp__/, '')}`
  return `使用 ${name}`
}

function field(input: Record<string, unknown>, key: string): string {
  return typeof input[key] === 'string' ? String(input[key]) : ''
}

function summary(request: PermissionRequestPayload): string {
  const { toolName, input } = request
  if (toolName === 'Bash') return field(input, 'command')
  if (['Edit', 'MultiEdit', 'Write', 'Read'].includes(toolName)) {
    return field(input, 'file_path') || field(input, 'path')
  }
  if (toolName === 'WebFetch') return field(input, 'url')
  if (toolName === 'Grep') return field(input, 'pattern')
  if (toolName === 'Glob') return field(input, 'pattern')
  return ''
}

export function PermissionBar({
  request,
  queued,
  tabTitle,
  planPreview,
  onRespond,
  onSwitchTab
}: PermissionBarProps) {
  const [expanded, setExpanded] = useState(false)
  const detail = summary(request) || formatJson(request.input)
  const isPlan = request.kind === 'plan'

  return (
    <div className="permission-bar-wrap">
      <div className={`permission-bar ${isPlan ? 'is-plan' : ''}`}>
        <div className="permission-bar-head">
          <span className="permission-bar-icon">
            <ShieldAlert size={17} />
          </span>
          <div className="permission-bar-copy">
            <strong>
              {isPlan ? '计划已准备好，等待你的批准' : `需要确认：${toolLabel(request.toolName)}`}
            </strong>
            <small>
              {request.description || request.title || (isPlan ? '已完成规划，批准后将开始执行。' : '执行前需要你的许可。')}
              {tabTitle && <> · <span data-i18n-skip>{tabTitle}</span></>}
              {queued > 0 ? ` · 还有 ${queued} 个请求` : ''}
            </small>
          </div>
          {onSwitchTab && tabTitle && (
            <button type="button" className="permission-switch" onClick={onSwitchTab}>
              切换
            </button>
          )}
        </div>

        {isPlan && planPreview ? (
          <div className={`permission-bar-plan ${expanded ? 'is-open' : ''}`}>
            {expanded ? (
              <Markdown>{planPreview}</Markdown>
            ) : (
              <p>{truncate(planPreview, 220)}</p>
            )}
            <button type="button" onClick={() => setExpanded((value) => !value)}>
              <ChevronDown size={13} className={expanded ? 'is-open' : ''} />
              {expanded ? '收起计划' : '展开完整计划'}
            </button>
          </div>
        ) : (
          <div className={`permission-bar-preview ${expanded ? 'is-open' : ''}`}>
            <code>{expanded ? detail : truncate(detail.split('\n')[0], 180)}</code>
            {detail.length > 180 && (
              <button type="button" onClick={() => setExpanded((value) => !value)}>
                <ChevronDown size={12} className={expanded ? 'is-open' : ''} />
                {expanded ? '收起' : '详情'}
              </button>
            )}
          </div>
        )}

        <div className="permission-bar-actions">
          <button
            type="button"
            className="button ghost"
            onClick={() => onRespond(request, 'deny')}
          >
            {isPlan ? '继续规划' : '拒绝'}
          </button>
          {!isPlan && (
            <button
              type="button"
              className="button secondary"
              onClick={() => onRespond(request, 'allow')}
            >
              允许一次
            </button>
          )}
          {!isPlan && request.allowAlways && !request.defaultToNo && (
            <button
              type="button"
              className="button primary"
              onClick={() => onRespond(request, 'allow', true)}
            >
              本会话允许
            </button>
          )}
          {isPlan && (
            <button
              type="button"
              className="button primary"
              onClick={() => onRespond(request, 'allow')}
            >
              批准并执行
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
