import test from 'node:test'
import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createWebSearchMcpServer } from '../src/main/web-search-mcp.ts'

test('the in-process MCP server exposes web_search and returns results', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    assert.match(String(input), /searx\.example/)
    return new Response(
      JSON.stringify({
        results: [
          { title: 'Result A', url: 'https://a.example', content: 'Snippet A' }
        ]
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  }
  try {
    const server = createWebSearchMcpServer({
      provider: 'searxng',
      endpoint: 'https://searx.example',
      apiKey: '',
      maxResults: 3,
      enabled: true
    })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await server.instance.connect(serverTransport)
    const client = new Client({ name: '3pi-test', version: '1.0.0' })
    await client.connect(clientTransport)
    const tools = await client.listTools()
    assert.deepEqual(
      tools.tools.map((tool) => tool.name),
      ['web_search']
    )
    const result = await client.callTool({
      name: 'web_search',
      arguments: { query: 'test query' }
    })
    assert.equal(result.isError, undefined)
    const text = result.content?.[0]?.text || ''
    assert.match(text, /Result A/)
    assert.match(text, /https:\/\/a\.example/)
    assert.match(text, /Snippet A/)
    await client.close()
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('the MCP tool reports provider errors as tool errors', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response('boom', { status: 500 })
  try {
    const server = createWebSearchMcpServer({
      provider: 'duckduckgo',
      endpoint: '',
      apiKey: '',
      maxResults: 3,
      enabled: true
    })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await server.instance.connect(serverTransport)
    const client = new Client({ name: '3pi-test', version: '1.0.0' })
    await client.connect(clientTransport)
    const result = await client.callTool({
      name: 'web_search',
      arguments: { query: 'will fail' }
    })
    assert.equal(result.isError, true)
    assert.match(result.content?.[0]?.text || '', /HTTP 500/)
    await client.close()
  } finally {
    globalThis.fetch = originalFetch
  }
})
