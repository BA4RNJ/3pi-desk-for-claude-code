import { Calendar, ExternalLink, Folder, Gauge, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type {
  AppPreferences,
  ModelOption,
  UsageHistorySnapshot
} from '../../../shared/types'
import { findProviderPreset } from '../../../shared/providers'
import type { TabView } from '../types'
import { basename, formatCost, formatTokens } from '../lib/format'
import { findModel, modelPricingLabel, summarizeUsage } from '../lib/usage'

interface UsagePanelProps {
  tab?: TabView
  models: ModelOption[]
  preferences: AppPreferences
  providerId?: string
  onOpenConsole: () => void
}

export function UsagePanel({
  tab,
  models,
  preferences,
  providerId,
  onOpenConsole
}: UsagePanelProps) {
  const [history, setHistory] = useState<UsageHistorySnapshot>({ days: [] })

  useEffect(() => {
    let disposed = false
    window.desk
      .getUsageHistory()
      .then((snap) => {
        if (!disposed) setHistory(snap)
      })
      .catch(() => undefined)
    return () => {
      disposed = true
    }
  }, [tab?.usage])

  const recent7Days = useMemo(() => history.days.slice(0, 7), [history.days])
  const todayStats = useMemo(() => {
    const d = new Date()
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`
    return history.days.find((item) => item.date === key)
  }, [history.days])

  const aggregate7d = useMemo(() => {
    let costUsd = 0
    let tokens = 0
    let turns = 0
    const byModel = new Map<string, { costUsd: number; tokens: number }>()
    const byWorkspace = new Map<string, { costUsd: number; tokens: number }>()

    for (const day of recent7Days) {
      costUsd += day.costUsd || 0
      tokens +=
        (day.inputTokens || 0) + (day.outputTokens || 0) + (day.cacheReadTokens || 0)
      turns += day.turns || 0
      for (const [m, info] of Object.entries(day.byModel || {})) {
        const prev = byModel.get(m) || { costUsd: 0, tokens: 0 }
        byModel.set(m, {
          costUsd: prev.costUsd + (info.costUsd || 0),
          tokens:
            prev.tokens +
            (info.inputTokens || 0) +
            (info.outputTokens || 0) +
            (info.cacheReadTokens || 0)
        })
      }
      for (const [ws, info] of Object.entries(day.byWorkspace || {})) {
        const prev = byWorkspace.get(ws) || { costUsd: 0, tokens: 0 }
        byWorkspace.set(ws, {
          costUsd: prev.costUsd + (info.costUsd || 0),
          tokens:
            prev.tokens +
            (info.inputTokens || 0) +
            (info.outputTokens || 0) +
            (info.cacheReadTokens || 0)
        })
      }
    }

    return {
      costUsd,
      tokens,
      turns,
      topModels: [...byModel.entries()]
        .sort((a, b) => b[1].costUsd - a[1].costUsd || b[1].tokens - a[1].tokens)
        .slice(0, 5),
      topWorkspaces: [...byWorkspace.entries()]
        .sort((a, b) => b[1].costUsd - a[1].costUsd || b[1].tokens - a[1].tokens)
        .slice(0, 5)
    }
  }, [recent7Days])

  const summary = summarizeUsage(tab?.usage, models)
  const selectedModel = findModel(models, tab?.state.model)
  const provider = findProviderPreset(providerId)
  const context = tab?.state.context
  const contextPercent = context?.percentage
    ? Math.round(context.percentage)
    : context?.max
      ? Math.round((context.used / context.max) * 100)
      : 0

  return (
    <div className="usage-panel">
      {tab ? (
        <>
          <div className="usage-grid">
            <div className="usage-card">
              <span className="usage-label">本会话估算费用</span>
              <strong>{formatCost(summary.costUsd) || '$0.00'}</strong>
              <small>
                {summary.hasEstimate
                  ? '部分模型未匹配价格，仅供参考'
                  : '按模型单价与高峰倍率估算'}
              </small>
            </div>
            <div className="usage-card">
              <span className="usage-label">本会话 Token 用量</span>
              <strong>{formatTokens(summary.totalTokens) || '0'}</strong>
              <small>
                ↑{formatTokens(summary.inputTokens) || '0'} · ↓
                {formatTokens(summary.outputTokens) || '0'} · 缓存读{' '}
                {formatTokens(summary.cacheReadTokens) || '0'}
              </small>
            </div>
          </div>

          <div className="usage-context">
            <div className="usage-context-head">
              <span>
                <Gauge size={14} /> 上下文
              </span>
              <strong>
                {context ? `${formatTokens(context.used)} / ${formatTokens(context.max)}` : '—'}
              </strong>
            </div>
            <div className="context-bar">
              <span
                className={`context-fill ${contextPercent > 85 ? 'is-warn' : ''}`}
                style={{ width: `${Math.min(100, Math.max(0, contextPercent))}%` }}
              />
            </div>
            <small>{contextPercent}% 已使用</small>
          </div>

          <div className="usage-model">
            <div className="usage-model-head">
              <span>当前模型</span>
              <strong>{selectedModel?.name || tab.state.model}</strong>
            </div>
            <div className="settings-rows">
              <div className="settings-row">
                <span>单价</span>
                <strong>{modelPricingLabel(selectedModel?.pricing)}</strong>
              </div>
              <div className="settings-row">
                <span>上下文窗口</span>
                <strong>
                  {selectedModel?.contextWindow
                    ? formatTokens(selectedModel.contextWindow)
                    : context?.max
                      ? formatTokens(context.max)
                      : '未知'}
                </strong>
              </div>
              <div className="settings-row">
                <span>最大输出</span>
                <strong>
                  {selectedModel?.maxOutput ? formatTokens(selectedModel.maxOutput) : '未知'}
                </strong>
              </div>
              <div className="settings-row">
                <span>思考强度</span>
                <strong>
                  {selectedModel?.effortLevels?.length
                    ? selectedModel.effortLevels.join(' / ')
                    : '默认'}
                </strong>
              </div>
              <div className="settings-row">
                <span>会话预算上限</span>
                <strong>
                  {preferences.maxBudgetUsd ? formatCost(preferences.maxBudgetUsd) : '未设置'}
                </strong>
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="settings-empty">当前没有打开的会话；下方显示本机累计历史用量。</p>
      )}

      <div className="usage-model">
        <div className="usage-model-head">
          <span>
            <Calendar size={14} /> 本机累计用量看板（近 7 天）
          </span>
          {history.days.length > 0 && (
            <button
              type="button"
              className="mini-button"
              onClick={() => {
                void window.desk
                  .clearUsageHistory()
                  .then((snap) => setHistory(snap))
                  .catch(() => undefined)
              }}
            >
              <Trash2 size={12} /> 清空统计
            </button>
          )}
        </div>

        <div className="usage-grid" style={{ marginTop: 8 }}>
          <div className="usage-card">
            <span className="usage-label">今日估算费用 / Token</span>
            <strong>{formatCost(todayStats?.costUsd || 0) || '$0.00'}</strong>
            <small>
              {formatTokens(
                (todayStats?.inputTokens || 0) +
                  (todayStats?.outputTokens || 0) +
                  (todayStats?.cacheReadTokens || 0)
              ) || '0'}{' '}
              tokens · {todayStats?.turns || 0} 轮对话
            </small>
          </div>
          <div className="usage-card">
            <span className="usage-label">近 7 天累计费用 / Token</span>
            <strong>{formatCost(aggregate7d.costUsd) || '$0.00'}</strong>
            <small>
              {formatTokens(aggregate7d.tokens) || '0'} tokens · {aggregate7d.turns} 轮对话
            </small>
          </div>
        </div>

        {recent7Days.length > 0 ? (
          <div className="settings-rows" style={{ marginTop: 10 }}>
            {recent7Days.map((day) => (
              <div className="settings-row" key={day.date}>
                <span>
                  {day.date}（{day.turns} 轮）
                </span>
                <strong>
                  {formatCost(day.costUsd) || '$0.00'} ·{' '}
                  {formatTokens(
                    day.inputTokens + day.outputTokens + day.cacheReadTokens
                  ) || '0'}{' '}
                  tok
                </strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="settings-note" style={{ marginTop: 8 }}>
            暂无历史统计。每完成一轮对话后会自动按天、按模型、按项目累加到本地。
          </p>
        )}

        {aggregate7d.topModels.length > 0 && (
          <div className="settings-rows" style={{ marginTop: 10 }}>
            <div className="settings-row">
              <span>
                <Sparkles size={12} /> 模型排行（近 7 天）
              </span>
              <strong>费用 · Token</strong>
            </div>
            {aggregate7d.topModels.map(([modelId, stat]) => (
              <div className="settings-row" key={modelId}>
                <span>{findModel(models, modelId)?.name || modelId}</span>
                <strong>
                  {formatCost(stat.costUsd) || '$0.00'} · {formatTokens(stat.tokens) || '0'}
                </strong>
              </div>
            ))}
          </div>
        )}

        {aggregate7d.topWorkspaces.length > 0 && (
          <div className="settings-rows" style={{ marginTop: 10 }}>
            <div className="settings-row">
              <span>
                <Folder size={12} /> 项目排行（近 7 天）
              </span>
              <strong>费用 · Token</strong>
            </div>
            {aggregate7d.topWorkspaces.map(([ws, stat]) => (
              <div className="settings-row" key={ws}>
                <span title={ws}>{basename(ws) || ws}</span>
                <strong>
                  {formatCost(stat.costUsd) || '$0.00'} · {formatTokens(stat.tokens) || '0'}
                </strong>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="settings-note">
        实际限额、账单和扣费以供应商控制台为准；这里显示的是本地按 token 与模型单价计算的估算值。
      </p>
      {provider?.consoleUrl && (
        <button type="button" className="button secondary" onClick={onOpenConsole}>
          <ExternalLink size={14} />
          在供应商控制台查看用量与限额
        </button>
      )}
    </div>
  )
}
