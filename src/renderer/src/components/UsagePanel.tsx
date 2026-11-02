import { ExternalLink, Gauge } from 'lucide-react'
import type { AppPreferences, ModelOption } from '../../../shared/types'
import { findProviderPreset } from '../../../shared/providers'
import type { TabView } from '../types'
import { formatCost, formatTokens } from '../lib/format'
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
  if (!tab) {
    return <p className="settings-empty">还没有活动会话。</p>
  }

  const summary = summarizeUsage(tab.usage, models)
  const selectedModel = findModel(models, tab.state.model)
  const provider = findProviderPreset(providerId)
  const context = tab.state.context
  const contextPercent = context?.percentage
    ? Math.round(context.percentage)
    : context?.max
      ? Math.round((context.used / context.max) * 100)
      : 0

  return (
    <div className="usage-panel">
      <div className="usage-grid">
        <div className="usage-card">
          <span className="usage-label">本会话估算费用</span>
          <strong>{formatCost(summary.costUsd) || '$0.00'}</strong>
          <small>{summary.hasEstimate ? '部分模型未匹配价格，仅供参考' : '按模型单价与高峰倍率估算'}</small>
        </div>
        <div className="usage-card">
          <span className="usage-label">Token 用量</span>
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
