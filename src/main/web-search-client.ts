import type {
  WebSearchResult,
  WebSearchTestResult
} from '../shared/types'
import {
  formatSearchResults,
  parseBaiduHtml,
  parseBingHtml,
  parseBraveJson,
  parseDuckDuckGoHtml,
  parseSearxngJson,
  parseTavilyJson,
  type WebSearchRuntimeConfig
} from '../shared/web-search.ts'

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

const USER_AGENT =
  '3PI-Desk/0.4.3 (+https://github.com/BA4RNJ/3pi-desk-for-claude-code)'
const MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
const MAX_RESPONSE_CHARS = 4 * 1024 * 1024

function timeoutSignal(ms = 15_000): AbortSignal {
  return AbortSignal.timeout(ms)
}

async function responseText(response: Response): Promise<string> {
  const text = await response.text()
  return text.length > MAX_RESPONSE_CHARS ? text.slice(0, MAX_RESPONSE_CHARS) : text
}

function cleanError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/api[_-]?key[=:]\s*\S+/gi, 'api_key=[redacted]')
  }
  return String(error)
}

function requireValue(value: string, label: string): string {
  if (!value.trim()) throw new Error(`${label} is not configured.`)
  return value.trim()
}

function searxngUrl(endpoint: string, query: string): URL {
  const base = requireValue(endpoint, 'SearXNG endpoint')
  const url = new URL(base)
  if (!url.pathname.endsWith('/search')) {
    url.pathname = `${url.pathname.replace(/\/$/, '')}/search`
  }
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('categories', 'general')
  url.searchParams.set('language', 'auto')
  url.searchParams.set('pageno', '1')
  url.searchParams.set('safesearch', '0')
  return url
}

async function searchDuckDuckGo(
  query: string,
  config: WebSearchRuntimeConfig,
  fetchImpl: FetchLike
): Promise<WebSearchResult[]> {
  const endpoints = [
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`
  ]
  let lastError: unknown
  for (const endpoint of endpoints) {
    try {
      const response = await fetchImpl(endpoint, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml'
        },
        signal: timeoutSignal()
      })
      if (!response.ok) {
        lastError = new Error(`DuckDuckGo returned HTTP ${response.status}.`)
        continue
      }
      const results = parseDuckDuckGoHtml(await responseText(response), config.maxResults)
      if (results.length > 0) return results
      lastError = new Error('DuckDuckGo returned no usable results.')
    } catch (error) {
      lastError = error
    }
  }
  throw new Error(`Web search failed: ${cleanError(lastError)}`)
}

async function searchBing(
  query: string,
  config: WebSearchRuntimeConfig,
  fetchImpl: FetchLike
): Promise<WebSearchResult[]> {
  const url = new URL('https://www.bing.com/search')
  url.searchParams.set('q', query)
  url.searchParams.set('count', String(config.maxResults))
  url.searchParams.set('form', 'QBLH')
  const response = await fetchImpl(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    },
    signal: timeoutSignal()
  })
  if (!response.ok) throw new Error(`Bing returned HTTP ${response.status}.`)
  const results = parseBingHtml(await responseText(response), config.maxResults)
  if (results.length === 0) throw new Error('Bing returned no usable results.')
  return results
}

async function searchBaidu(
  query: string,
  config: WebSearchRuntimeConfig,
  fetchImpl: FetchLike
): Promise<WebSearchResult[]> {
  const url = new URL('https://m.baidu.com/s')
  url.searchParams.set('word', query)
  const response = await fetchImpl(url, {
    headers: {
      'User-Agent': MOBILE_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    },
    signal: timeoutSignal()
  })
  if (!response.ok) throw new Error(`Baidu returned HTTP ${response.status}.`)
  const html = await responseText(response)
  if (html.includes('百度安全验证')) {
    throw new Error('Baidu requires a security verification for this network.')
  }
  const results = parseBaiduHtml(html, config.maxResults)
  if (results.length === 0) throw new Error('Baidu returned no usable results.')
  return results
}

async function searchSearxng(
  query: string,
  config: WebSearchRuntimeConfig,
  fetchImpl: FetchLike
): Promise<WebSearchResult[]> {
  const url = searxngUrl(config.endpoint, query)
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json'
  }
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`
  const response = await fetchImpl(url, { headers, signal: timeoutSignal() })
  if (!response.ok) throw new Error(`SearXNG returned HTTP ${response.status}.`)
  let payload: unknown
  try {
    payload = JSON.parse(await responseText(response))
  } catch {
    throw new Error('SearXNG did not return JSON. Enable the JSON format on the instance.')
  }
  return parseSearxngJson(payload, config.maxResults)
}

async function searchTavily(
  query: string,
  config: WebSearchRuntimeConfig,
  fetchImpl: FetchLike
): Promise<WebSearchResult[]> {
  const apiKey = requireValue(config.apiKey, 'Tavily API key')
  const endpoint = config.endpoint.trim() || 'https://api.tavily.com/search'
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: config.maxResults,
      search_depth: 'basic',
      include_answer: false
    }),
    signal: timeoutSignal()
  })
  if (!response.ok) throw new Error(`Tavily returned HTTP ${response.status}.`)
  let payload: unknown
  try {
    payload = JSON.parse(await responseText(response))
  } catch {
    throw new Error('Tavily returned an invalid response.')
  }
  return parseTavilyJson(payload, config.maxResults)
}

async function searchBrave(
  query: string,
  config: WebSearchRuntimeConfig,
  fetchImpl: FetchLike
): Promise<WebSearchResult[]> {
  const apiKey = requireValue(config.apiKey, 'Brave Search API key')
  const base = config.endpoint.trim() || 'https://api.search.brave.com/res/v1/web/search'
  const url = new URL(base)
  url.searchParams.set('q', query)
  url.searchParams.set('count', String(config.maxResults))
  url.searchParams.set('safesearch', 'moderate')
  const response = await fetchImpl(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      'X-Subscription-Token': apiKey
    },
    signal: timeoutSignal()
  })
  if (!response.ok) throw new Error(`Brave Search returned HTTP ${response.status}.`)
  let payload: unknown
  try {
    payload = JSON.parse(await responseText(response))
  } catch {
    throw new Error('Brave Search returned an invalid response.')
  }
  return parseBraveJson(payload, config.maxResults)
}

export async function searchWeb(
  query: string,
  config: WebSearchRuntimeConfig,
  fetchImpl: FetchLike = fetch
): Promise<WebSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  switch (config.provider) {
    case 'bing':
      return searchBing(trimmed, config, fetchImpl)
    case 'baidu':
      return searchBaidu(trimmed, config, fetchImpl)
    case 'searxng':
      return searchSearxng(trimmed, config, fetchImpl)
    case 'tavily':
      return searchTavily(trimmed, config, fetchImpl)
    case 'brave':
      return searchBrave(trimmed, config, fetchImpl)
    case 'duckduckgo':
    default:
      return searchDuckDuckGo(trimmed, config, fetchImpl)
  }
}

export async function testWebSearch(
  query: string,
  config: WebSearchRuntimeConfig,
  fetchImpl: FetchLike = fetch
): Promise<WebSearchTestResult> {
  try {
    const results = await searchWeb(query, config, fetchImpl)
    return {
      ok: results.length > 0,
      provider: config.provider,
      count: results.length,
      results: results.slice(0, 3),
      error: results.length === 0 ? 'The provider returned no results.' : undefined
    }
  } catch (error) {
    return {
      ok: false,
      provider: config.provider,
      error: cleanError(error)
    }
  }
}

export function webSearchResultText(results: WebSearchResult[]): string {
  return formatSearchResults(results)
}
