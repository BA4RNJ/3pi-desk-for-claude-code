/**
 * Live API output-rate meter.
 *
 * Anthropic-compatible streaming APIs only report exact output-token counts
 * when an assistant message finishes (`message_delta.usage.output_tokens`).
 * To show a live tok/s value we estimate from the characters received in
 * `content_block_delta` events and calibrate that estimate against the exact
 * per-message counts (or the turn total when a provider omits per-message
 * usage).
 */

export interface TokenRateSnapshot {
  /** Output tokens per second for the latest measurement. */
  tokensPerSecond: number
  /** Epoch ms of the last token-bearing stream event or exact count. */
  updatedAt: number
  /** True while the number is derived from streamed characters. */
  estimated: boolean
}

const WINDOW_MS = 3500
const MIN_WINDOW_MS = 800
const IDLE_GAP_MS = 1500
const MIN_CHARS_TO_CALIBRATE = 80
const DEFAULT_TOKENS_PER_CHAR = 0.4
const MIN_TOKENS_PER_CHAR = 0.05
const MAX_TOKENS_PER_CHAR = 4

interface DeltaSample {
  at: number
  chars: number
}

interface MessageTrack {
  startedAt: number
  chars: number
}

function deltaCharacters(delta: unknown): number {
  if (!delta || typeof delta !== 'object') return 0
  const item = delta as Record<string, unknown>
  switch (item.type) {
    case 'text_delta':
      return String(item.text ?? '').length
    case 'thinking_delta':
      return String(item.thinking ?? '').length
    case 'input_json_delta':
      return String(item.partial_json ?? '').length
    default:
      return 0
  }
}

export class TokenRateMeter {
  private samples: DeltaSample[] = []
  private messages = new Map<string, MessageTrack>()
  private turnChars = 0
  private turnCalibrated = false
  private tokensPerChar = DEFAULT_TOKENS_PER_CHAR
  private calibrated = false
  private latest: TokenRateSnapshot | undefined

  snapshot(): TokenRateSnapshot | undefined {
    return this.latest
  }

  reset(): void {
    this.samples = []
    this.messages.clear()
    this.turnChars = 0
    this.turnCalibrated = false
    this.latest = undefined
  }

  /** Feed one raw `stream_event.event` payload. */
  handleStreamEvent(
    key: string,
    event: Record<string, any>,
    at = Date.now()
  ): void {
    if (!event) return
    if (event.type === 'message_start') {
      this.messages.set(key, { startedAt: at, chars: 0 })
      return
    }
    if (event.type === 'content_block_delta') {
      const chars = deltaCharacters(event.delta)
      if (chars > 0) this.addDelta(key, chars, at)
      return
    }
    if (event.type === 'message_delta') {
      const usage = event.usage as Record<string, unknown> | undefined
      const output = Number(usage?.output_tokens)
      this.endMessage(
        key,
        Number.isFinite(output) && output > 0 ? output : undefined,
        at
      )
    }
  }

  /**
   * Finalize a turn. When no message reported exact usage, the turn total is
   * still enough to calibrate the character-to-token ratio.
   */
  endTurn(outputTokens?: number): void {
    if (
      !this.turnCalibrated &&
      outputTokens !== undefined &&
      outputTokens > 0 &&
      this.turnChars >= MIN_CHARS_TO_CALIBRATE
    ) {
      this.calibrate(outputTokens / this.turnChars)
    }
    this.turnChars = 0
    this.turnCalibrated = false
  }

  private addDelta(key: string, chars: number, at: number): void {
    const track = this.messages.get(key)
    if (track) track.chars += chars
    else this.messages.set(key, { startedAt: at, chars })
    this.turnChars += chars

    const last = this.samples[this.samples.length - 1]
    if (last && at - last.at > IDLE_GAP_MS) this.samples = []
    this.samples.push({ at, chars })

    const cutoff = at - WINDOW_MS
    while (this.samples.length > 1 && this.samples[0].at < cutoff) {
      this.samples.shift()
    }
    this.updateEstimate(at)
  }

  private updateEstimate(at: number): void {
    const first = this.samples[0]
    if (!first) return
    const spanMs = Math.max(at - first.at, 1)
    if (spanMs < MIN_WINDOW_MS) return

    let chars = 0
    for (const sample of this.samples) chars += sample.chars
    const tokensPerSecond = (chars / spanMs) * 1000 * this.tokensPerChar
    if (!Number.isFinite(tokensPerSecond) || tokensPerSecond <= 0) return

    this.latest = {
      tokensPerSecond,
      updatedAt: at,
      // The rolling number is always derived from characters; the exact
      // count only arrives when a message completes.
      estimated: true
    }
  }

  private endMessage(
    key: string,
    outputTokens: number | undefined,
    at: number
  ): void {
    const track = this.messages.get(key)
    this.messages.delete(key)
    if (!track) return

    if (outputTokens && track.chars >= MIN_CHARS_TO_CALIBRATE) {
      if (this.calibrate(outputTokens / track.chars)) this.turnCalibrated = true
    }
    if (!outputTokens) return

    const seconds = (at - track.startedAt) / 1000
    if (seconds < 0.2) return
    const tokensPerSecond = outputTokens / seconds
    if (!Number.isFinite(tokensPerSecond) || tokensPerSecond <= 0) return
    this.latest = { tokensPerSecond, updatedAt: at, estimated: false }
  }

  private calibrate(ratio: number): boolean {
    if (!Number.isFinite(ratio)) return false
    if (ratio < MIN_TOKENS_PER_CHAR || ratio > MAX_TOKENS_PER_CHAR) return false
    this.tokensPerChar = this.calibrated
      ? this.tokensPerChar * 0.5 + ratio * 0.5
      : ratio
    this.calibrated = true
    return true
  }
}

/** Format a tok/s value for the compact top-bar chip. */
export function formatTokenRate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return ''
  return value >= 10 ? String(Math.round(value)) : value.toFixed(1)
}
