import { FolderTree, Gauge, ListChecks, ListTodo } from 'lucide-react'
import type { ContextUsage, ModelOption, TurnStats } from '../../../shared/types'
import type { TabTask, TodoItem, TokenUsage } from '../types'
import { basename, formatCost, formatTokens, truncate } from '../lib/format'
import { summarizeUsage } from '../lib/usage'
import { Dropdown } from './Dropdown'

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
  context?: ContextUsage
  usage?: Record<string, TokenUsage>
  tasks: TabTask[]
  todos: TodoItem[]
  running: boolean
  onOpenUsage: () => void
  onToggleFiles: () => void
  filesOpen: boolean
  onOpenPath: (path: string) => void
}

export function TopBar({
  title,
  cwd,
  models,
  stats,
  context,
  usage,
  tasks,
  todos,
  running,
  onOpenUsage,
  onToggleFiles,
  filesOpen,
  onOpenPath
}: TopBarProps) {
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
