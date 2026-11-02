import {
  ChevronDown,
  FolderTree,
  Gauge,
  ListChecks,
  ListTodo,
  Shield,
  ShieldAlert,
  Sparkles
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type {
  ContextUsage,
  EffortSetting,
  ModelOption,
  PermissionMode,
  TurnStats
} from '../../../shared/types'
import type { TabTask, TodoItem, TokenUsage } from '../types'
import { EFFORT_OPTIONS, PERMISSION_OPTIONS } from '../hooks/useDesk'
import { basename, formatCost, formatTokens, truncate } from '../lib/format'
import { findModel, summarizeUsage } from '../lib/usage'

interface DropdownProps {
  trigger: ReactNode
  children: ReactNode
  align?: 'left' | 'right'
  className?: string
}

function Dropdown({ trigger, children, align = 'right', className }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div className={`dropdown ${className || ''}`} ref={ref}>
      <button type="button" className="chip" onClick={() => setOpen((value) => !value)}>
        {trigger}
        <ChevronDown size={13} className={open ? 'is-open' : ''} />
      </button>
      {open && (
        <div
          className={`dropdown-menu ${align === 'right' ? 'align-right' : 'align-left'}`}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  )
}

const TASK_LABEL: Record<TabTask['status'], string> = {
  running: '运行中',
  completed: '完成',
  failed: '失败',
  stopped: '已停止'
}

interface TopBarProps {
  title: string
  cwd: string
  model: string
  models: ModelOption[]
  effort: EffortSetting
  permissionMode: PermissionMode
  stats?: TurnStats
  context?: ContextUsage
  usage?: Record<string, TokenUsage>
  tasks: TabTask[]
  todos: TodoItem[]
  running: boolean
  onModelChange: (model: string) => void
  onPermissionModeChange: (mode: PermissionMode) => void
  onEffortChange: (effort: EffortSetting) => void
  onOpenUsage: () => void
  onToggleFiles: () => void
  filesOpen: boolean
  onOpenPath: (path: string) => void
}

export function TopBar({
  title,
  cwd,
  model,
  models,
  effort,
  permissionMode,
  stats,
  context,
  usage,
  tasks,
  todos,
  running,
  onModelChange,
  onPermissionModeChange,
  onEffortChange,
  onOpenUsage,
  onToggleFiles,
  filesOpen,
  onOpenPath
}: TopBarProps) {
  const selectedModel = findModel(models, model)
  const modelLabel = selectedModel?.name || model

  const mode = PERMISSION_OPTIONS.find((option) => option.id === permissionMode)
  const ModeIcon = mode?.danger ? ShieldAlert : Shield

  const supportedEfforts = selectedModel?.effortLevels || []
  const effortLabel =
    EFFORT_OPTIONS.find((option) => option.id === effort)?.label || '默认'

  const usageSummary = summarizeUsage(usage, models)
  const contextPercent = context?.percentage
    ? Math.round(context.percentage)
    : context?.max
      ? Math.round((context.used / context.max) * 100)
      : undefined
  const runningTasks = tasks.filter((task) => task.status === 'running').length
  const completedTodos = todos.filter((todo) => todo.status === 'completed').length
  const taskDepth = (task: TabTask): number => {
    let depth = 0
    let parent = task.parentTaskId
    while (parent && depth < 5) {
      depth += 1
      parent = tasks.find((item) => item.id === parent)?.parentTaskId
    }
    return depth
  }

  return (
    <header className="topbar">
      <div className="topbar-title">
        <strong data-i18n-skip={title !== '新对话' ? 'true' : undefined}>{title}</strong>
        <span title={cwd}>{cwd ? basename(cwd) : '未选择目录'}</span>
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          className={`icon-button topbar-icon ${filesOpen ? 'is-active' : ''}`}
          onClick={onToggleFiles}
          title="文件面板"
          aria-label="文件面板"
        >
          <FolderTree size={15} />
        </button>
        <button type="button" className="stats-chip stats-button" onClick={onOpenUsage} title="查看用量与限额">
          {(usageSummary.inputTokens > 0 || usageSummary.outputTokens > 0) && (
            <span>
              ↑{formatTokens(usageSummary.inputTokens)} ↓{formatTokens(usageSummary.outputTokens)}
            </span>
          )}
          {usageSummary.costUsd > 0 && <span>{formatCost(usageSummary.costUsd)}</span>}
          {contextPercent !== undefined && (
            <span className={contextPercent > 85 ? 'stats-warn' : ''}>
              <Gauge size={12} /> {contextPercent}%
            </span>
          )}
          {stats?.durationMs !== undefined && <span>{Math.round(stats.durationMs / 1000)}s</span>}
        </button>

        {(tasks.length > 0 || todos.length > 0) && (
          <Dropdown
            trigger={
              <>
                <ListChecks size={14} />
                <span>
                  任务
                  {runningTasks > 0
                    ? ` ${runningTasks} 运行中`
                    : todos.length > 0
                      ? ` ${completedTodos}/${todos.length}`
                      : ` ${tasks.length}`}
                </span>
              </>
            }
          >
            <div className="task-menu">
              {todos.length > 0 && (
                <div className="task-section">
                  <div className="task-section-title">
                    <ListTodo size={12} /> 任务清单 {completedTodos}/{todos.length}
                  </div>
                  {todos.map((todo, index) => (
                    <div key={index} className={`task-row todo-row todo-${todo.status}`}>
                      <span className="status-dot" />
                      <div>
                        <strong>{truncate(todo.content, 70)}</strong>
                        <small>
                          {todo.status === 'completed'
                            ? '已完成'
                            : todo.status === 'in_progress'
                              ? '进行中'
                              : '待处理'}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {tasks.length > 0 && (
                <div className="task-section">
                  <div className="task-section-title">
                    <ListChecks size={12} /> 后台/子代理
                  </div>
                  {tasks.slice().reverse().map((task) => (
                    <div
                      key={task.id}
                      className={`task-row task-${task.status}`}
                      style={{ paddingLeft: `${8 + taskDepth(task) * 14}px` }}
                    >
                      <span className="status-dot" />
                      <div>
                        <strong>{truncate(task.description, 60)}</strong>
                        <small>
                          {TASK_LABEL[task.status]}
                          {task.subagentType ? ` · ${task.subagentType}` : ''}
                          {task.summary ? ` · ${truncate(task.summary, 70)}` : ''}
                        </small>
                      </div>
                      {task.outputFile && (
                        <button
                          type="button"
                          className="mini-button"
                          onClick={() => onOpenPath(task.outputFile as string)}
                        >
                          日志
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Dropdown>
        )}

        <Dropdown
          trigger={
            <>
              <Sparkles size={14} />
              <span>{modelLabel}</span>
            </>
          }
        >
          {models.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`dropdown-item model-item ${
                option.id === model ? 'is-selected' : ''
              }`}
              onClick={() => onModelChange(option.id)}
              title={option.description}
            >
              <span>{option.name}</span>
              <small>
                {option.description || option.id}
                {option.contextWindow
                  ? ` · 上下文 ${formatTokens(option.contextWindow)}`
                  : ''}
              </small>
            </button>
          ))}
        </Dropdown>

        {supportedEfforts.length > 0 && (
          <Dropdown
            trigger={
              <>
                <Gauge size={14} />
                <span>强度 {effortLabel}</span>
              </>
            }
          >
            {EFFORT_OPTIONS.filter(
              (option) =>
                option.id === 'default' ||
                supportedEfforts.includes(option.id)
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                className={`dropdown-item ${option.id === effort ? 'is-selected' : ''}`}
                onClick={() => onEffortChange(option.id)}
              >
                <span>{option.label}</span>
                <small>
                  {option.id === 'default' ? '由模型自动决定' : `effort=${option.id}`}
                </small>
              </button>
            ))}
          </Dropdown>
        )}

        <Dropdown
          trigger={
            <>
              <ModeIcon size={14} className={mode?.danger ? 'danger-icon' : ''} />
              <span>{mode?.label || '权限模式'}</span>
            </>
          }
        >
          {PERMISSION_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`dropdown-item ${option.id === permissionMode ? 'is-selected' : ''}`}
              onClick={() => onPermissionModeChange(option.id)}
            >
              <span className={option.danger ? 'danger-text' : ''}>{option.label}</span>
              <small>{option.description}</small>
            </button>
          ))}
        </Dropdown>

        {running && (
          <span className="working-chip">
            <span className="status-dot" />
            工作中
          </span>
        )}
      </div>
    </header>
  )
}
