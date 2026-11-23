import test from 'node:test'
import assert from 'node:assert/strict'
import {
  decodeDuckDuckGoUrl,
  decodeHtmlEntities,
  formatSearchResults,
  isWebSearchConfigured,
  parseBaiduHtml,
  parseBingHtml,
  parseBraveJson,
  parseDuckDuckGoHtml,
  parseSearxngJson,
  parseTavilyJson,
  resolveWebSearchConfig,
  stripTags
} from '../src/shared/web-search.ts'
import { searchWeb, testWebSearch } from '../src/main/web-search-client.ts'

const DDG_HTML = `
<div class="result">
  <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa&amp;rut=abc">Example &amp; A</a>
  <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa">Snippet <b>one</b></a>
</div>
<div class="result">
  <a href="https://example.org/b" class="result__a">Second</a>
  <a class="result__snippet">Second snippet</a>
</div>
`

const BAIDU_HTML = `
<div data-log="{&quot;dataUrl&quot;:&quot;https://a.example/1&quot;}">
  <section class="cosc-card-content"><h3 class="title"><span>Baidu &amp; <strong>One</strong></span></h3>
  <p>First&ensp;snippet</p><span>source one</span></section>
</div>
<div data-log="{&quot;dataUrl&quot;:&quot;https://b.example/2&quot;}">
  <section class="cosc-card-content"><h3>Baidu Two</h3>
  <p>Second snippet</p></section>
</div>
`

const BING_HTML = `
<ol id="b_results">
  <li class="b_algo" data-id="1">
    <h2><a href="https://code.example/">Code &amp; <strong>Docs</strong></a></h2>
    <div class="b_caption"><p class="b_lineclamp2">A &ensp; useful &hellip; snippet</p></div>
  </li>
  <li class="b_algo" data-id="2">
    <div class="b_caption"><p>Second snippet</p></div>
    <h2><a href="https://second.example/b">Second result</a></h2>
  </li>
</ol>
`

test('decodes HTML entities and tags', () => {
  assert.equal(decodeHtmlEntities('a &amp; b &#39;c&#39;'), "a & b 'c'")
  assert.equal(stripTags('<b>Hello</b> &amp; <i>world</i>'), 'Hello & world')
  assert.equal(
    decodeDuckDuckGoUrl('//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa&rut=1'),
    'https://example.com/a'
  )
})

test('parses DuckDuckGo HTML results with either attribute order', () => {
  const results = parseDuckDuckGoHtml(DDG_HTML, 5)
  assert.equal(results.length, 2)
  assert.deepEqual(results[0], {
    title: 'Example & A',
    url: 'https://example.com/a',
    snippet: 'Snippet one'
  })
  assert.deepEqual(results[1], {
    title: 'Second',
    url: 'https://example.org/b',
    snippet: 'Second snippet'
  })
})

test('parses Bing organic results', () => {
  const results = parseBingHtml(BING_HTML, 5)
  assert.equal(results.length, 2)
  assert.deepEqual(results[0], {
    title: 'Code & Docs',
    url: 'https://code.example/',
    snippet: 'A useful … snippet'
  })
  assert.deepEqual(results[1], {
    title: 'Second result',
    url: 'https://second.example/b',
    snippet: 'Second snippet'
  })
})

test('parses Baidu mobile organic results', () => {
  const results = parseBaiduHtml(BAIDU_HTML, 5)
  assert.equal(results.length, 2)
  assert.equal(results[0].title, 'Baidu & One')
  assert.equal(results[0].url, 'https://a.example/1')
  assert.match(results[0].snippet, /First snippet/)
  assert.equal(results[1].url, 'https://b.example/2')
  assert.match(results[1].snippet, /Second snippet/)
})

test('parses SearXNG, Tavily, and Brave JSON shapes', () => {
  assert.deepEqual(
    parseSearxngJson({
      results: [{ title: 'S', url: 'https://s.example', content: 'searx' }]
    }),
    [{ title: 'S', url: 'https://s.example', snippet: 'searx' }]
  )
  assert.deepEqual(
    parseTavilyJson({
      results: [{ title: 'T', url: 'https://t.example', content: 'tavily' }]
    }),
    [{ title: 'T', url: 'https://t.example', snippet: 'tavily' }]
  )
  assert.deepEqual(
    parseBraveJson({
      web: { results: [{ title: 'B', url: 'https://b.example', description: 'brave' }] }
    }),
    [{ title: 'B', url: 'https://b.example', snippet: 'brave' }]
  )
})

test('normalizes configuration and clamps result counts', () => {
  assert.deepEqual(resolveWebSearchConfig({}), {
    provider: 'duckduckgo',
    endpoint: '',
    apiKey: '',
    maxResults: 6,
    enabled: true
  })
  assert.equal(resolveWebSearchConfig({ maxResults: 999 }).maxResults, 10)
  assert.equal(resolveWebSearchConfig({ maxResults: 0 }).maxResults, 1)
  assert.equal(resolveWebSearchConfig({ enabled: false }).enabled, false)
})

test('detects whether a search provider is usable', () => {
  assert.equal(
    isWebSearchConfigured({ provider: 'duckduckgo', endpoint: '', apiKey: '', maxResults: 3 }),
    true
  )
  assert.equal(
    isWebSearchConfigured({ provider: 'bing', endpoint: '', apiKey: '', maxResults: 3 }),
    true
  )
  assert.equal(
    isWebSearchConfigured({ provider: 'baidu', endpoint: '', apiKey: '', maxResults: 3 }),
    true
  )
  assert.equal(
    isWebSearchConfigured({ provider: 'searxng', endpoint: '', apiKey: '', maxResults: 3 }),
    false
  )
  assert.equal(
    isWebSearchConfigured({ provider: 'tavily', endpoint: '', apiKey: 'key', maxResults: 3 }),
    true
  )
  assert.equal(
    isWebSearchConfigured({
      provider: 'duckduckgo',
      endpoint: '',
      apiKey: '',
      maxResults: 3,
      enabled: false
    }),
    false
  )
})

test('formats results for tool output', () => {
  const text = formatSearchResults([
    { title: 'A', url: 'https://a.example', snippet: 'first' },
    { title: 'B', url: 'https://b.example', snippet: '' }
  ])
  assert.match(text, /1\. A\nhttps:\/\/a\.example\nfirst/)
  assert.match(text, /2\. B\nhttps:\/\/b\.example/)
})

test('searchWeb uses the configured provider and fetch implementation', async () => {
  const calls = []
  const fetchImpl = async (input, init) => {
    calls.push({ input: String(input), init })
    return new Response(
      JSON.stringify({
        results: [{ title: 'T', url: 'https://t.example', content: 'body' }]
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  }
  const results = await searchWeb(
    'query',
    { provider: 'searxng', endpoint: 'https://searx.example', apiKey: '', maxResults: 3 },
    fetchImpl
  )
  assert.equal(results[0].url, 'https://t.example')
  assert.match(calls[0].input, /searx\.example\/search/)
  assert.match(calls[0].input, /format=json/)
})

test('searchWeb fetches and parses Bing results without an API key', async () => {
  const calls = []
  const fetchImpl = async (input) => {
    calls.push(String(input))
    return new Response(BING_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html' }
    })
  }
  const results = await searchWeb(
    'claude code',
    { provider: 'bing', endpoint: '', apiKey: '', maxResults: 3 },
    fetchImpl
  )
  assert.equal(results.length, 2)
  assert.equal(results[0].url, 'https://code.example/')
  assert.match(calls[0], /bing\.com\/search/)
  assert.match(calls[0], /q=claude\+code/)
})

test('searchWeb fetches and parses Baidu mobile results', async () => {
  const calls = []
  const fetchImpl = async (input, init) => {
    calls.push({ input: String(input), init })
    return new Response(BAIDU_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html' }
    })
  }
  const results = await searchWeb(
    'Claude Code',
    { provider: 'baidu', endpoint: '', apiKey: '', maxResults: 3 },
    fetchImpl
  )
  assert.equal(results.length, 2)
  assert.match(calls[0].input, /m\.baidu\.com\/s/)
  assert.match(calls[0].input, /word=Claude\+Code/)
  assert.match(String(calls[0].init?.headers?.['User-Agent'] || ''), /Android/)
})

test('testWebSearch reports provider failures without leaking keys', async () => {
  const result = await testWebSearch(
    'query',
    { provider: 'tavily', endpoint: '', apiKey: 'secret-key', maxResults: 3 },
    async () => new Response('bad request', { status: 400 })
  )
  assert.equal(result.ok, false)
  assert.match(result.error || '', /HTTP 400/)
  assert.doesNotMatch(result.error || '', /secret-key/)
})
