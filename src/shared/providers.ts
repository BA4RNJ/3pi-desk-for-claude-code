import type { ApiAuthMode } from './types'

export interface ProviderPreset {
  id: string
  name: string
  baseUrl: string
  defaultModel?: string
  consoleUrl?: string
  description?: string
  authMode?: ApiAuthMode
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'opencode-go',
    name: 'OpenCode Go',
    baseUrl: 'https://opencode.ai/inference/go/anthropic',
    defaultModel: 'deepseek-v4.1-flash',
    consoleUrl: 'https://opencode.ai/console/go',
    description: '多模型网关，兼容 Anthropic Messages API'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    consoleUrl: 'https://console.anthropic.com/',
    description: 'Anthropic 官方 API',
    authMode: 'apiKey'
  },
  {
    id: 'zai',
    name: 'Z.ai (GLM)',
    baseUrl: 'https://api.z.ai/api/anthropic',
    defaultModel: 'glm-5.2',
    description: 'GLM 系列，Anthropic 兼容端点'
  },
  {
    id: 'moonshot',
    name: 'Moonshot (Kimi)',
    baseUrl: 'https://api.moonshot.ai/anthropic',
    defaultModel: 'kimi-k3',
    description: 'Kimi 系列，Anthropic 兼容端点'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/anthropic',
    description: 'DeepSeek 官方 Anthropic 兼容端点'
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    baseUrl: 'https://api.minimax.io/anthropic',
    defaultModel: 'MiniMax-M3',
    description: 'MiniMax 系列，Anthropic 兼容端点'
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434',
    description: '本地模型，需要 Ollama 提供 Anthropic 兼容接口'
  },
  {
    id: 'custom',
    name: 'Custom / Other',
    baseUrl: '',
    description: '任何兼容 Anthropic Messages API 的服务'
  }
]

export function findProviderPreset(idOrBaseUrl?: string): ProviderPreset | undefined {
  if (!idOrBaseUrl) return undefined
  const value = idOrBaseUrl.trim().replace(/\/+$/, '')
  return PROVIDER_PRESETS.find(
    (preset) => preset.id === value || preset.baseUrl.replace(/\/+$/, '') === value
  )
}

export function providerDisplayName(idOrBaseUrl?: string): string {
  return findProviderPreset(idOrBaseUrl)?.name || '自定义供应商'
}

export function providerConsoleUrl(idOrBaseUrl?: string): string | undefined {
  return findProviderPreset(idOrBaseUrl)?.consoleUrl
}
