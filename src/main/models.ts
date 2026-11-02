import type {
  ApiAuthMode,
  ApiSettingsPatch,
  EffortLevel,
  ModelOption,
  ModelPricing,
  TestApiResult
} from '../shared/types'
import { getApiCredentials, getApiSettings, getCustomModels } from './settings'
import { findProviderPreset } from '../shared/providers'

const FALLBACK_MODELS: ModelOption[] = [
  {
    id: 'deepseek-v4.1-flash',
    name: 'DeepSeek V4.1 Flash',
    description: 'DeepSeek V4.1 Flash model for reasoning and agentic coding',
    contextWindow: 1_000_000,
    maxOutput: 384_000,
    effortLevels: ['low', 'high', 'max'],
    supportsImages: true,
    pricing: {
      inputPerMillion: 0.15,
      outputPerMillion: 0.6,
      cacheReadPerMillion: 0.003,
      peakMultiplier: 2,
      peakWindowsUtc: [
        { days: [1, 2, 3, 4, 5], startHour: 1, endHour: 4 },
        { days: [1, 2, 3, 4, 5], startHour: 6, endHour: 10 }
      ]
    }
  },
  {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    description: 'DeepSeek V4 Pro model for harder reasoning and coding tasks',
    contextWindow: 1_000_000,
    maxOutput: 384_000,
    effortLevels: ['low', 'high', 'max'],
    supportsImages: true,
    pricing: {
      inputPerMillion: 0.66,
      outputPerMillion: 1.98,
      cacheReadPerMillion: 0.022,
      peakMultiplier: 2,
      peakWindowsUtc: [
        { days: [1, 2, 3, 4, 5], startHour: 1, endHour: 4 },
        { days: [1, 2, 3, 4, 5], startHour: 6, endHour: 10 }
      ]
    }
  }
]

let cache: { at: number; models: ModelOption[]; credentials: string } | null = null

function trimBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

function modelsUrlCandidates(baseUrl: string): string[] {
  const trimmed = trimBaseUrl(baseUrl)
  if (!trimmed) return []
  const candidates = new Set<string>()
  if (trimmed.endsWith('/anthropic')) {
    const root = trimmed.slice(0, -'/anthropic'.length)
    candidates.add(`${root}/v1/models`)
    candidates.add(`${root}/models`)
    candidates.add(`${trimmed}/v1/models`)
  } else if (trimmed.endsWith('/v1/messages')) {
    candidates.add(`${trimmed.slice(0, -'/messages'.length)}/models`)
  } else if (trimmed.endsWith('/v1')) {
    candidates.add(`${trimmed}/models`)
  } else {
    candidates.add(`${trimmed}/v1/models`)
    candidates.add(`${trimmed}/models`)
  }
  return [...candidates]
}

function messagesUrl(baseUrl: string): string {
  const trimmed = trimBaseUrl(baseUrl)
  if (trimmed.endsWith('/v1/messages')) return trimmed
  if (trimmed.endsWith('/v1')) return `${trimmed}/messages`
  return `${trimmed}/v1/messages`
}

type AuthMode = 'key' | 'bearer'

function authHeaders(token: string, mode: AuthMode): Record<string, string> {
  return {
    Accept: 'application/json',
    ...(token
      ? mode === 'bearer'
        ? { Authorization: `Bearer ${token}` }
        : { 'x-api-key': token }
      : {}),
    'anthropic-version': '2023-06-01'
  }
}

function toApiAuthMode(mode: AuthMode): ApiAuthMode {
  return mode === 'bearer' ? 'bearer' : 'apiKey'
}

function authModes(token: string, preferred?: ApiAuthMode): AuthMode[] {
  if (!token) return ['key']
  if (preferred === 'apiKey') return ['key', 'bearer']
  if (preferred === 'bearer') return ['bearer', 'key']
  return ['key', 'bearer']
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const DAY_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
}

function parseHour(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined
  const match = value.match(/^(\d{1,2}):/)
  return match ? Number(match[1]) : undefined
}

function parsePeakWindows(
  multipliers: unknown
): Array<{ days: number[]; startHour: number; endHour: number }> | undefined {
  if (!Array.isArray(multipliers) || multipliers.length === 0) return undefined
  const first = multipliers[0] as Record<string, any>
  const windows: Array<{ days: number[]; startHour: number; endHour: number }> = []
  const daysRaw = first?.when?.utc_days?.in
  const days = Array.isArray(daysRaw)
    ? daysRaw
        .map((day) => DAY_INDEX[String(day).toLowerCase()])
        .filter((day): day is number => day !== undefined)
    : [1, 2, 3, 4, 5]
  const any = first?.when?.any
  if (Array.isArray(any)) {
    for (const entry of any) {
      const all = entry?.all
      if (!Array.isArray(all)) continue
      let startHour: number | undefined
      let endHour: number | undefined
      for (const condition of all) {
        const start = parseHour(condition?.utc_hours?.gte)
        const end = parseHour(condition?.utc_hours?.lt)
        if (start !== undefined) startHour = start
        if (end !== undefined) endHour = end
      }
      if (startHour !== undefined && endHour !== undefined) {
        windows.push({ days, startHour, endHour })
      }
    }
  }
  return windows.length > 0 ? windows : undefined
}

function parseModel(raw: Record<string, any>): ModelOption {
  const effort = raw.capabilities?.reasoning?.effort
  const pricing = raw.cost?.text
  const pricingData: ModelPricing | undefined = pricing
    ? {
        inputPerMillion: Number(pricing.input?.price ?? 0),
        outputPerMillion: Number(pricing.output?.price ?? 0),
        cacheReadPerMillion:
          pricing.input?.cache?.read !== undefined
            ? Number(pricing.input.cache.read)
            : undefined,
        peakMultiplier:
          Array.isArray(raw.cost?.multipliers) && raw.cost.multipliers[0]?.factor
            ? Number(raw.cost.multipliers[0].factor)
            : undefined,
        peakWindowsUtc: parsePeakWindows(raw.cost?.multipliers)
      }
    : undefined

  const contextWindow =
    raw.limit?.context ??
    raw.context_length ??
    raw.context_window ??
    raw.max_context_length ??
    raw.top_provider?.context_length
  const maxOutput =
    raw.limit?.output ??
    raw.max_output_tokens ??
    raw.max_completion_tokens ??
    raw.top_provider?.max_completion_tokens
  const inputModalities = Array.isArray(raw.modalities?.input)
    ? raw.modalities.input
    : Array.isArray(raw.architecture?.input_modalities)
      ? raw.architecture.input_modalities
      : undefined

  return {
    id: String(raw.id),
    name: String(raw.name || raw.display_name || raw.id),
    description: raw.description
      ? String(raw.description)
      : raw.owned_by
        ? `By ${String(raw.owned_by)}`
        : undefined,
    contextWindow: contextWindow ? Number(contextWindow) : undefined,
    maxOutput: maxOutput ? Number(maxOutput) : undefined,
    effortLevels: Array.isArray(effort)
      ? (effort.filter((level) =>
          ['low', 'medium', 'high', 'xhigh', 'max'].includes(String(level))
        ) as EffortLevel[])
      : undefined,
    supportsImages: Array.isArray(inputModalities)
      ? inputModalities.some(
          (type: string) =>
            String(type).startsWith('image/') || String(type) === 'image'
        )
      : undefined,
    pricing: pricingData
  }
}

async function requestModels(
  baseUrl: string,
  token: string,
  preferredAuthMode?: ApiAuthMode
): Promise<{ models: ModelOption[]; status: number; authMode: ApiAuthMode }> {
  let lastError: unknown = null
  let lastStatus = 0
  for (const url of modelsUrlCandidates(baseUrl)) {
    for (const mode of authModes(token, preferredAuthMode)) {
      try {
        const response = await fetch(url, {
          headers: authHeaders(token, mode),
          signal: AbortSignal.timeout(20_000)
        })
        lastStatus = response.status
        if (!response.ok) {
          lastError = new Error(`HTTP ${response.status} from ${url}`)
          if (
            response.status === 404 ||
            response.status === 405 ||
            response.status >= 500
          ) {
            break
          }
          continue
        }
        const body = (await response.json()) as Record<string, any>
        const rawList = Array.isArray(body)
          ? body
          : Array.isArray(body.data)
            ? body.data
            : Array.isArray(body.models)
              ? body.models
              : Array.isArray(body.data?.models)
                ? body.data.models
                : []
        const models = rawList
          .filter((item: any) => item?.id)
          .map((item: any) => parseModel(item))
          .sort((a: ModelOption, b: ModelOption) => a.name.localeCompare(b.name))
        return {
          models,
          status: response.status,
          authMode: toApiAuthMode(mode)
        }
      } catch (error) {
        lastError = error
      }
    }
  }
  const error =
    lastError instanceof Error ? lastError : new Error('Model list request failed.')
  ;(error as Error & { status?: number }).status = lastStatus
  throw error
}

async function probeModel(
  baseUrl: string,
  token: string,
  model: string,
  preferredAuthMode?: ApiAuthMode,
  timeoutMs = 30_000
): Promise<{
  ok: boolean
  status: number
  error?: string
  authMode?: ApiAuthMode
}> {
  if (!model) return { ok: false, status: 0, error: 'No model ID to test.' }
  let last: {
    ok: boolean
    status: number
    error?: string
    authMode?: ApiAuthMode
  } = {
    ok: false,
    status: 0,
    error: 'Request failed.'
  }
  for (const mode of authModes(token, preferredAuthMode)) {
    try {
      const response = await fetch(messagesUrl(baseUrl), {
        method: 'POST',
        headers: {
          ...authHeaders(token, mode),
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model,
          max_tokens: 16,
          messages: [{ role: 'user', content: 'ping' }]
        }),
        signal: AbortSignal.timeout(timeoutMs)
      })
      if (response.ok) {
        return {
          ok: true,
          status: response.status,
          authMode: toApiAuthMode(mode)
        }
      }
      const text = (await response.text().catch(() => '')).trim().slice(0, 300)
      last = {
        ok: false,
        status: response.status,
        error: `HTTP ${response.status}${text ? `: ${text}` : ''}`
      }
      if (response.status === 404 || response.status >= 500) break
    } catch (error) {
      last = { ok: false, status: 0, error: errorMessage(error) }
    }
  }
  return last
}

export async function findModelContextWindow(
  modelId?: string
): Promise<number | undefined> {
  const id = modelId || getApiSettings().model
  if (!id) return undefined
  const models = await getModels()
  const match = models.find(
    (model) =>
      model.id === id ||
      model.name === id ||
      model.id === id.split('/').at(-1)
  )
  return match?.contextWindow
}

export async function getModels(force = false): Promise<ModelOption[]> {
  const { baseUrl, token, model } = getApiCredentials()
  const providerId = getApiSettings().providerId || 'custom'
  const custom = getCustomModels().filter(
    (entry) => !entry.providerId || entry.providerId === providerId
  )
  const customKey = custom
    .map((entry) => `${entry.id}:${entry.name || ''}:${entry.contextWindow || ''}`)
    .join('|')
  const credentials = `${baseUrl}\n${token}\n${providerId}\n${customKey}`
  if (
    !force &&
    cache &&
    cache.credentials === credentials &&
    Date.now() - cache.at < 5 * 60_000
  ) {
    return cache.models
  }
  const isDefaultProvider =
    providerId === 'opencode-go' || findProviderPreset(baseUrl)?.id === 'opencode-go'
  let models: ModelOption[]
  try {
    const result = await requestModels(baseUrl, token)
    models =
      result.models.length > 0
        ? result.models
        : isDefaultProvider
          ? [...FALLBACK_MODELS]
          : []
  } catch {
    models = isDefaultProvider ? [...FALLBACK_MODELS] : []
  }
  if (model && !models.some((item) => item.id === model)) {
    const fallback = FALLBACK_MODELS.find((item) => item.id === model)
    models = [
      fallback || {
        id: model,
        name: model,
        description: 'Custom model'
      },
      ...models
    ]
  }
  for (const entry of custom) {
    const index = models.findIndex((item) => item.id === entry.id)
    if (index >= 0) {
      models[index] = {
        ...models[index],
        name: entry.name || models[index].name,
        contextWindow: entry.contextWindow ?? models[index].contextWindow
      }
    } else {
      models.push({
        id: entry.id,
        name: entry.name || entry.id,
        contextWindow: entry.contextWindow
      })
    }
  }
  cache = { at: Date.now(), models, credentials }
  return models
}

export async function testApi(patch?: ApiSettingsPatch): Promise<TestApiResult> {
  const current = getApiSettings()
  const baseUrl = trimBaseUrl(patch?.baseUrl || current.baseUrl)
  const environment = getApiCredentials()
  const token = patch?.token?.trim() || environment.token
  const model = patch?.model?.trim() || current.model
  if (!baseUrl) return { ok: false, error: 'Base URL is required.' }
  const localProvider = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(
    baseUrl
  )
  if (!token && !localProvider) {
    return { ok: false, error: 'No API token configured yet.' }
  }

  let models: ModelOption[] = []
  let listStatus = 0
  let listAuthMode: ApiAuthMode | undefined
  let listError: TestApiResult | null = null
  try {
    const result = await requestModels(baseUrl, token, patch?.authMode)
    models = result.models
    listStatus = result.status
    listAuthMode = result.authMode
  } catch (error) {
    const status = (error as Error & { status?: number }).status || 0
    if (status === 401 || status === 403) {
      return { ok: false, status, error: errorMessage(error) }
    }
    listError = { ok: false, status, error: errorMessage(error) }
  }

  const preset = findProviderPreset(baseUrl)
  const knownPreset = Boolean(preset && preset.id !== 'custom')

  if (models.length > 0 && (knownPreset || !model)) {
    return {
      ok: true,
      status: listStatus,
      modelCount: models.length,
      models,
      via: 'models',
      authMode: listAuthMode
    }
  }

  if (!model) {
    if (listError && !listError.status) return listError
    let lastProbe: {
      ok: boolean
      status: number
      error?: string
      authMode?: ApiAuthMode
    } = {
      ok: false,
      status: listStatus || listError?.status || 0,
      error: listError?.error
    }
    for (const candidate of preset?.suggestedModels || []) {
      const probe = await probeModel(
        baseUrl,
        token,
        candidate,
        patch?.authMode,
        15_000
      )
      if (probe.ok) {
        return {
          ok: true,
          status: probe.status,
          modelCount: 0,
          models: [],
          via: 'messages',
          authMode: probe.authMode || listAuthMode,
          discoveredModel: candidate
        }
      }
      lastProbe = probe
    }
    return {
      ok: false,
      status: lastProbe.status || listStatus || listError?.status,
      error:
        lastProbe.error ||
        listError?.error ||
        'Could not detect a model automatically. Enter a model ID from the provider documentation.'
    }
  }

  const probe = await probeModel(baseUrl, token, model, patch?.authMode)
  if (probe.ok) {
    return {
      ok: true,
      status: probe.status,
      modelCount: models.length,
      models,
      via: models.length > 0 ? 'models' : 'messages',
      authMode: probe.authMode || listAuthMode
    }
  }

  for (const candidate of preset?.suggestedModels || []) {
    if (candidate === model) continue
    const fallback = await probeModel(
      baseUrl,
      token,
      candidate,
      patch?.authMode,
      15_000
    )
    if (fallback.ok) {
      return {
        ok: true,
        status: fallback.status,
        modelCount: models.length,
        models,
        via: models.length > 0 ? 'models' : 'messages',
        authMode: fallback.authMode || listAuthMode,
        discoveredModel: candidate
      }
    }
  }

  return {
    ok: false,
    status: probe.status || listStatus || listError?.status,
    error: probe.error || listError?.error
  }
}
