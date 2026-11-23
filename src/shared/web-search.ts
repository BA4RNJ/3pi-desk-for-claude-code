import type { WebSearchProvider, WebSearchResult } from './types'

export interface WebSearchRuntimeConfig {
  provider: WebSearchProvider
  endpoint: string
  apiKey: string
  maxResults: number
  enabled?: boolean
}

const DEFAULT_MAX_RESULTS = 6

function clampResults(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return DEFAULT_MAX_RESULTS
  return Math.min(10, Math.max(1, Math.round(number)))
}

export function isWebSearchConfigured(config: WebSearchRuntimeConfig): boolean {
  if (config.enabled === false) return false
  if (config.provider === 'duckduckgo' || config.provider === 'bing' || config.provider === 'baidu') {
    return true
  }
  if (config.provider === 'searxng') return Boolean(config.endpoint.trim())
  return Boolean(config.apiKey.trim())
}

export function resolveWebSearchConfig(input: {
  provider?: WebSearchProvider
  endpoint?: string
  apiKey?: string
  maxResults?: number
  enabled?: boolean
}): WebSearchRuntimeConfig {
  return {
    provider: input.provider || 'duckduckgo',
    endpoint: (input.endpoint || '').trim(),
    apiKey: (input.apiKey || '').trim(),
    maxResults: clampResults(input.maxResults),
    enabled: input.enabled !== false
  }
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  middot: '·',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  copy: '©',
  reg: '®',
  trade: '™',
  '#39': "'",
  '#x27': "'"
}

export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, (match, entity: string) => {
    const key = entity.toLowerCase()
    if (NAMED_ENTITIES[key]) return NAMED_ENTITIES[key]
    if (key.startsWith('#x')) {
      const code = Number.parseInt(key.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    if (key.startsWith('#')) {
      const code = Number.parseInt(key.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return match
  })
}

export function stripTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

export function decodeDuckDuckGoUrl(href: string): string {
  let value = decodeHtmlEntities(href.trim())
  if (value.startsWith('//')) value = `https:${value}`
  try {
    const parsed = new URL(value)
    if (/(^|\.)duckduckgo\.com$/i.test(parsed.hostname) && parsed.pathname.startsWith('/l/')) {
      const target = parsed.searchParams.get('uddg')
      if (target) return target
    }
    return value
  } catch {
    return value
  }
}

function pushResult(
  results: WebSearchResult[],
  seen: Set<string>,
  title: string,
  url: string,
  snippet: string,
  limit: number
): void {
  const cleanTitle = stripTags(title)
  const cleanSnippet = stripTags(snippet)
  const cleanUrl = decodeDuckDuckGoUrl(url)
  if (!cleanTitle || !cleanUrl) return
  if (!/^https?:\/\//i.test(cleanUrl)) return
  if (seen.has(cleanUrl)) return
  seen.add(cleanUrl)
  results.push({ title: cleanTitle, url: cleanUrl, snippet: cleanSnippet })
  if (results.length >= limit) return
}

/**
 * Parses the result markup served by html.duckduckgo.com. This is a
 * best-effort fallback that does not require an API key; users who need
 * guaranteed quota can select SearXNG, Tavily, or Brave in Settings.
 */
export function parseDuckDuckGoHtml(
  html: string,
  limit = DEFAULT_MAX_RESULTS
): WebSearchResult[] {
  const max = clampResults(limit)
  const results: WebSearchResult[] = []
  const seen = new Set<string>()
  const snippets = new Map<number, string>()
  const anchors: Array<{ index: number; href: string; text: string; kind: 'result' | 'snippet' }> = []
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi

  for (const match of html.matchAll(anchorPattern)) {
    const attrs = match[1] || ''
    const className = (attrs.match(/\bclass="([^"]*)"/i) || [])[1] || ''
    const href = (attrs.match(/\bhref="([^"]*)"/i) || [])[1] || ''
    const kind = /\b(result__a|result-link)\b/i.test(className)
      ? 'result'
      : /\b(result__snippet|result-snippet)\b/i.test(className)
        ? 'snippet'
        : null
    if (!kind) continue
    const index = match.index ?? 0
    if (kind === 'snippet') snippets.set(index, match[2] || '')
    else anchors.push({ index, href, text: match[2] || '', kind })
  }
  const snippetIndexes = [...snippets.keys()].sort((a, b) => a - b)

  for (const anchor of anchors) {
    if (results.length >= max) break
    const next = snippetIndexes.find((position) => position > anchor.index)
    const snippet = next !== undefined ? snippets.get(next) || '' : ''
    pushResult(results, seen, anchor.text, anchor.href, snippet, max)
  }
  return results
}

/**
 * Parses Bing's organic result list. Bing is reachable in networks where
 * DuckDuckGo is blocked and needs no API key. The markup is intentionally
 * matched conservatively so layout experiments on Bing degrade to fewer
 * results rather than broken links.
 */
export function parseBingHtml(
  html: string,
  limit = DEFAULT_MAX_RESULTS
): WebSearchResult[] {
  const max = clampResults(limit)
  const results: WebSearchResult[] = []
  const seen = new Set<string>()
  const blockPattern = /<li\b[^>]*\bclass="[^"]*\bb_algo\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi

  for (const block of html.matchAll(blockPattern)) {
    if (results.length >= max) break
    const body = block[1] || ''
    const title = body.match(
      /<h2\b[^>]*>[\s\S]*?<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i
    )
    if (!title) continue
    const snippet =
      body.match(
        /<p\b[^>]*\bclass="[^"]*\bb_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/i
      ) ||
      body.match(
        /<div\b[^>]*\bclass="[^"]*\bb_caption\b[^"]*"[^>]*>[\s\S]*?<p\b[^>]*>([\s\S]*?)<\/p>/i
      )
    pushResult(
      results,
      seen,
      title[2] || '',
      title[1] || '',
      snippet?.[1] || '',
      max
    )
  }
  return results
}

/**
 * Parses Baidu's mobile organic results. The mobile page embeds direct result
 * URLs in `dataUrl` metadata and keeps the visible card markup after it.
 */
export function parseBaiduHtml(
  html: string,
  limit = DEFAULT_MAX_RESULTS
): WebSearchResult[] {
  const max = clampResults(limit)
  const results: WebSearchResult[] = []
  const seen = new Set<string>()
  const urls = [...html.matchAll(/dataUrl&quot;:&quot;([\s\S]*?)&quot;/gi)]

  for (let index = 0; index < urls.length && results.length < max; index += 1) {
    const urlMatch = urls[index]
    const start = (urlMatch.index ?? 0) + urlMatch[0].length
    const next = urls[index + 1]
    const end = next?.index ?? Math.min(html.length, start + 12_000)
    const chunk = html.slice(start, end)
    const heading = chunk.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)
    if (!heading) continue
    let body = chunk.slice((heading.index ?? 0) + heading[0].length)
    const cardEnd = body.search(/<article\b|\brl-node="true"|<\/section>/i)
    if (cardEnd >= 0) body = body.slice(0, cardEnd)
    const snippet = stripTags(body.replace(/<!--[\s\S]*?-->/g, ' ')).slice(0, 300)
    pushResult(
      results,
      seen,
      heading[1] || '',
      decodeHtmlEntities(urlMatch[1] || ''),
      snippet,
      max
    )
  }
  return results
}

function objectArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    : []
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function parseSearxngJson(
  payload: unknown,
  limit = DEFAULT_MAX_RESULTS
): WebSearchResult[] {
  const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const results: WebSearchResult[] = []
  const seen = new Set<string>()
  for (const item of objectArray(root.results)) {
    if (results.length >= clampResults(limit)) break
    pushResult(
      results,
      seen,
      stringValue(item.title),
      stringValue(item.url),
      stringValue(item.content) || stringValue(item.snippet),
      clampResults(limit)
    )
  }
  return results
}

export function parseTavilyJson(
  payload: unknown,
  limit = DEFAULT_MAX_RESULTS
): WebSearchResult[] {
  const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const results: WebSearchResult[] = []
  const seen = new Set<string>()
  for (const item of objectArray(root.results)) {
    if (results.length >= clampResults(limit)) break
    pushResult(
      results,
      seen,
      stringValue(item.title),
      stringValue(item.url),
      stringValue(item.content),
      clampResults(limit)
    )
  }
  return results
}

export function parseBraveJson(
  payload: unknown,
  limit = DEFAULT_MAX_RESULTS
): WebSearchResult[] {
  const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const web = root.web && typeof root.web === 'object' ? (root.web as Record<string, unknown>) : {}
  const results: WebSearchResult[] = []
  const seen = new Set<string>()
  for (const item of objectArray(web.results)) {
    if (results.length >= clampResults(limit)) break
    pushResult(
      results,
      seen,
      stringValue(item.title),
      stringValue(item.url),
      stringValue(item.description),
      clampResults(limit)
    )
  }
  return results
}

export function formatSearchResults(results: WebSearchResult[]): string {
  if (results.length === 0) return 'No web results were returned.'
  return results
    .map((result, index) => {
      const snippet = result.snippet ? `\n${result.snippet}` : ''
      return `${index + 1}. ${result.title}\n${result.url}${snippet}`
    })
    .join('\n\n')
}
