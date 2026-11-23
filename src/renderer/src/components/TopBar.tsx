import { Clock, FolderTree, Gauge, Home, ListChecks, ListTodo, Search, Square, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ContextUsage, ModelOption, TurnStats } from '../../../shared/types'
import type { TabTask, TodoItem, TokenUsage } from '../types'
import type { TokenRateSnapshot } from '../lib/token-rate'
import { basename, formatCost, formatTokens, truncate } from '../lib/format'
import { formatTokenRate } from '../lib/token-rate'
import { summarizeUsage } from '../lib/usage'
import { Dropdown } from './Dropdown'

function formatWorkTime(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (ms > 0 && seconds === 0) return '<1s'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${seconds % 60}s`
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
  models: ModelOption[]
  stats?: TurnStats
  workElapsedMs?: number
  workStartedAt?: number
  context?: ContextUsage
  usage?: Record<string, TokenUsage>
  tokenRate?: TokenRateSnapshot
  tasks: TabTask[]
  todos: TodoItem[]
  running: boolean
  onOpenHome: () => void
  onOpenUsage: () => void
  onToggleFiles: () => void
  onOpenSearch: () => void
  filesOpen: boolean
  onOpenPath: (path: string) => void
  onStopTask: (taskId: string) => void
}

export function TopBar({
  title,
  cwd,
  models,
  stats,
  workElapsedMs = 0,
  workStartedAt,
  context,
  usage,
  tokenRate,
  tasks,
  todos,
  running,
  onOpenHome,
  onOpenUsage,
  onToggleFiles,
  onOpenSearch,
  filesOpen,
  onOpenPath,
  onStopTask
}: TopBarProps) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!running) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [running])
  const workMs = Math.max(
    0,
    workElapsedMs + (workStartedAt ? now - workStartedAt : 0)
  )
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
          className="icon-button topbar-icon"
          onClick={onOpenHome}
          title="返回项目主页"
          aria-label="返回项目主页"
        >
          <Home size={15} />
        </button>
        <button
          type="button"
          className="icon-button topbar-icon"
          onClick={onOpenSearch}
          title="搜索工作区（Ctrl/Cmd + Shift + F）"
          aria-label="搜索工作区"
        >
          <Search size={15} />
        </button>
        <button
          type="button"
          className={`icon-button topbar-icon ${filesOpen ? 'is-active' : ''}`}
          onClick={onToggleFiles}
          title="文件面板"
          aria-label="文件面板"
        >
          <FolderTree size={15} />
        </button>
        <button
          type="button"
          className="stats-chip stats-button"
          onClick={onOpenUsage}
          title="查看用量与限额"
        >
          {(usageSummary.inputTokens > 0 || usageSummary.outputTokens > 0) && (
            <span>
              ↑{formatTokens(usageSummary.inputTokens)} ↓{formatTokens(usageSummary.outputTokens)}
            </span>
          )}
          {tokenRate && formatTokenRate(tokenRate.tokensPerSecond) && (
            <span className="token-rate" title="实时输出速率">
              <Zap size={12} />
              {tokenRate.estimated ? '≈' : ''}
              {formatTokenRate(tokenRate.tokensPerSecond)} tok/s
            </span>
          )}
          {usageSummary.costUsd > 0 && <span>{formatCost(usageSummary.costUsd)}</span>}
          {contextPercent !== undefined && (
            <span className={contextPercent > 85 ? 'stats-warn' : ''}>
              <Gauge size={12} /> {contextPercent}%
            </span>
          )}
          {(running || workMs > 0 || stats?.durationMs !== undefined) && (
            <span className="work-timer" title="AI 工作时长">
              <Clock size={12} />
              {formatWorkTime(workMs || stats?.durationMs || 0)}
            </span>
          )}
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
                      {task.status === 'running' && (
                        <button
                          type="button"
                          className="mini-button task-stop-button"
                          onClick={() => onStopTask(task.id)}
                          title="停止这个任务"
                        >
                          <Square size={10} fill="currentColor" /> 停止
                        </button>
                      )}
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
