import type { ModelOption, ModelPricing } from '../../../shared/types'
import type { TokenUsage } from '../types'

export interface UsageSummary {
  costUsd: number
  hasEstimate: boolean
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  totalTokens: number
}

export function isPeakNow(pricing?: ModelPricing, date = new Date()): boolean {
  if (!pricing?.peakWindowsUtc || pricing.peakWindowsUtc.length === 0) return false
  const day = date.getUTCDay()
  const hour = date.getUTCHours()
  return pricing.peakWindowsUtc.some(
    (window) =>
      window.days.includes(day) && hour >= window.startHour && hour < window.endHour
  )
}

export function findModel(models: ModelOption[], id?: string): ModelOption | undefined {
  if (!id) return undefined
  return models.find(
    (model) => model.id === id || model.name === id || model.id === id.split('/').at(-1)
  )
}

export function mergeUsage(
  base: Record<string, TokenUsage> | undefined,
  addition: Record<string, TokenUsage> | undefined
): Record<string, TokenUsage> | undefined {
  if (!base && !addition) return undefined
  const merged: Record<string, TokenUsage> = {}
  for (const source of [base, addition]) {
    if (!source) continue
    for (const [modelId, item] of Object.entries(source)) {
      const current = merged[modelId] || {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0
      }
      current.inputTokens += item.inputTokens || 0
      current.outputTokens += item.outputTokens || 0
      current.cacheReadInputTokens += item.cacheReadInputTokens || 0
      current.cacheCreationInputTokens += item.cacheCreationInputTokens || 0
      if (item.costUSD !== undefined) {
        current.costUSD = (current.costUSD || 0) + item.costUSD
      }
      current.contextWindow = item.contextWindow ?? current.contextWindow
      current.canonicalModel = item.canonicalModel ?? current.canonicalModel
      current.provider = item.provider ?? current.provider
      merged[modelId] = current
    }
  }
  return merged
}

export function summarizeUsage(
  usage: Record<string, TokenUsage> | undefined,
  models: ModelOption[]
): UsageSummary {
  const summary: UsageSummary = {
    costUsd: 0,
    hasEstimate: false,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0
  }
  if (!usage) return summary

  for (const [modelId, item] of Object.entries(usage)) {
    summary.inputTokens += item.inputTokens || 0
    summary.outputTokens += item.outputTokens || 0
    summary.cacheReadTokens += item.cacheReadInputTokens || 0
    summary.totalTokens +=
      (item.inputTokens || 0) +
      (item.outputTokens || 0) +
      (item.cacheReadInputTokens || 0) +
      (item.cacheCreationInputTokens || 0)

    const model = findModel(models, item.canonicalModel || modelId)
    const pricing = model?.pricing
    if (!pricing) {
      summary.costUsd += item.costUSD || 0
      summary.hasEstimate = true
      continue
    }
    const multiplier =
      isPeakNow(pricing) && pricing.peakMultiplier ? pricing.peakMultiplier : 1
    const cacheReadPrice = pricing.cacheReadPerMillion ?? pricing.inputPerMillion
    summary.costUsd +=
      ((item.inputTokens || 0) * pricing.inputPerMillion +
        (item.outputTokens || 0) * pricing.outputPerMillion +
        (item.cacheReadInputTokens || 0) * cacheReadPrice +
        (item.cacheCreationInputTokens || 0) * pricing.inputPerMillion) /
      1_000_000 *
      multiplier
  }
  return summary
}

export function modelPricingLabel(pricing?: ModelPricing): string {
  if (!pricing) return '价格未知'
  const peak = pricing.peakMultiplier && pricing.peakMultiplier !== 1
    ? ` · 高峰 ×${pricing.peakMultiplier}`
    : ''
  return `$${pricing.inputPerMillion}/M 输入 · $${pricing.outputPerMillion}/M 输出${peak}`
}
