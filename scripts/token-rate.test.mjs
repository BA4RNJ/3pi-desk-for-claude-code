import test from 'node:test'
import assert from 'node:assert/strict'
import {
  TokenRateMeter,
  formatTokenRate
} from '../src/renderer/src/lib/token-rate.ts'

function delta(text, type = 'text_delta') {
  const payload =
    type === 'thinking_delta'
      ? { type, thinking: text }
      : type === 'input_json_delta'
        ? { type, partial_json: text }
        : { type, text }
  return { type: 'content_block_delta', delta: payload }
}

function start(at) {
  return { at, event: { type: 'message_start', message: { id: `m-${at}` } } }
}

test('estimates a live rate from streamed characters', () => {
  const meter = new TokenRateMeter()
  const events = []
  events.push(start(1000))
  for (let i = 0; i < 30; i += 1) {
    events.push({ at: 1100 + i * 100, event: delta('x'.repeat(20)) })
  }
  for (const { at, event } of events) meter.handleStreamEvent('main', event, at)

  const snapshot = meter.snapshot()
  assert.ok(snapshot)
  assert.equal(snapshot.estimated, true)
  // 600 chars over ~2.9s with the default 0.4 tokens/char.
  assert.ok(
    snapshot.tokensPerSecond > 70 && snapshot.tokensPerSecond < 95,
    `unexpected rate ${snapshot.tokensPerSecond}`
  )
})

test('calibrates against exact message usage and reports the exact rate', () => {
  const meter = new TokenRateMeter()
  meter.handleStreamEvent('main', start(1000).event, 1000)
  for (let i = 0; i < 10; i += 1) {
    meter.handleStreamEvent('main', delta('y'.repeat(50)), 1100 + i * 100)
  }
  // 500 characters produced 500 output tokens over 1.1 s.
  meter.handleStreamEvent(
    'main',
    { type: 'message_delta', usage: { output_tokens: 500 } },
    2100
  )

  const exact = meter.snapshot()
  assert.ok(exact)
  assert.equal(exact.estimated, false)
  assert.ok(
    exact.tokensPerSecond > 400 && exact.tokensPerSecond < 500,
    `unexpected exact rate ${exact.tokensPerSecond}`
  )

  // The next message starts after an idle gap; its live estimate must use
  // the calibrated 1 token per character, not the default ratio.
  meter.handleStreamEvent('main', start(4000).event, 4000)
  for (let i = 0; i < 12; i += 1) {
    meter.handleStreamEvent('main', delta('z'.repeat(10)), 4100 + i * 100)
  }
  const estimate = meter.snapshot()
  assert.ok(estimate)
  assert.equal(estimate.estimated, true)
  // 120 chars over 1.1 s at 1 token/char ≈ 109 tok/s.
  assert.ok(
    estimate.tokensPerSecond > 90 && estimate.tokensPerSecond < 120,
    `unexpected calibrated estimate ${estimate.tokensPerSecond}`
  )
})

test('falls back to the turn total when messages omit usage', () => {
  const meter = new TokenRateMeter()
  meter.handleStreamEvent('main', start(1000).event, 1000)
  for (let i = 0; i < 10; i += 1) {
    meter.handleStreamEvent('main', delta('a'.repeat(50)), 1100 + i * 100)
  }
  meter.endTurn(250)

  meter.handleStreamEvent('main', start(4000).event, 4000)
  for (let i = 0; i < 11; i += 1) {
    meter.handleStreamEvent('main', delta('b'.repeat(20)), 4100 + i * 100)
  }
  const snapshot = meter.snapshot()
  assert.ok(snapshot)
  // 220 chars over ~1 s at the turn-calibrated 0.5 tokens/char.
  assert.ok(
    snapshot.tokensPerSecond > 80 && snapshot.tokensPerSecond < 120,
    `unexpected fallback estimate ${snapshot.tokensPerSecond}`
  )
})

test('ignores the idle gap instead of diluting the rate', () => {
  const meter = new TokenRateMeter()
  meter.handleStreamEvent('main', start(1000).event, 1000)
  for (let i = 0; i < 20; i += 1) {
    meter.handleStreamEvent('main', delta('c'.repeat(25)), 1100 + i * 100)
  }

  // A tool call or a pause: no deltas for two seconds.
  meter.handleStreamEvent('main', start(5000).event, 5000)
  for (let i = 0; i < 11; i += 1) {
    meter.handleStreamEvent('main', delta('d'.repeat(20)), 5100 + i * 100)
  }
  const snapshot = meter.snapshot()
  assert.ok(snapshot)
  // 220 chars over 1.1 s at 0.4 tokens/char ≈ 80 tok/s.
  assert.ok(
    snapshot.tokensPerSecond > 65 && snapshot.tokensPerSecond < 95,
    `unexpected post-gap rate ${snapshot.tokensPerSecond}`
  )
})

test('reset clears the live rate', () => {
  const meter = new TokenRateMeter()
  meter.handleStreamEvent('main', start(1000).event, 1000)
  for (let i = 0; i < 10; i += 1) {
    meter.handleStreamEvent('main', delta('e'.repeat(20)), 1100 + i * 100)
  }
  assert.ok(meter.snapshot())
  meter.reset()
  assert.equal(meter.snapshot(), undefined)
})

test('formats tok/s compactly', () => {
  assert.equal(formatTokenRate(42.6), '43')
  assert.equal(formatTokenRate(9.94), '9.9')
  assert.equal(formatTokenRate(0), '')
  assert.equal(formatTokenRate(Number.NaN), '')
})
