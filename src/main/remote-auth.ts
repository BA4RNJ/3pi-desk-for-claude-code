import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export interface RemoteCredentials {
  username: string
  /** Hex-encoded random salt. */
  salt: string
  /** Hex-encoded scrypt hash. */
  hash: string
}

export function hashPassword(
  password: string,
  salt = randomBytes(16).toString('hex')
): { salt: string; hash: string } {
  const hash = scryptSync(password, salt, 64).toString('hex')
  return { salt, hash }
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  try {
    const expected = Buffer.from(hash, 'hex')
    const actual = scryptSync(password, salt, expected.length)
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

interface SessionRecord {
  username: string
  createdAt: number
  lastSeen: number
}

interface PairingRecord {
  username: string
  expiresAt: number
}

interface AttemptRecord {
  count: number
  resetAt: number
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const PAIRING_TTL_MS = 5 * 60 * 1000
const ATTEMPT_WINDOW_MS = 60 * 1000
const MAX_ATTEMPTS = 10

/**
 * Password login plus opaque in-memory session tokens. Tokens are lost when
 * the desktop process restarts, so a browser re-authenticates after an app
 * restart; that is intentional for a single-user remote console.
 */
export class RemoteAuth {
  private readonly sessions = new Map<string, SessionRecord>()
  private readonly pairingTokens = new Map<string, PairingRecord>()
  private readonly attempts = new Map<string, AttemptRecord>()
  private readonly credentials: () => RemoteCredentials | null

  constructor(credentials: () => RemoteCredentials | null) {
    this.credentials = credentials
  }

  /**
   * Create a short-lived (5 minute), single-use pairing code for QR-code login.
   */
  createPairingToken(): { code: string; expiresAt: number } {
    this.prune()
    const expected = this.credentials()
    const username = expected?.username || 'ba4rnj'
    const code = randomBytes(24).toString('base64url')
    const expiresAt = Date.now() + PAIRING_TTL_MS
    this.pairingTokens.set(code, { username, expiresAt })
    return { code, expiresAt }
  }

  redeemPairingToken(code: string, ip: string): string | null {
    if (!this.allowAttempt(ip)) return null
    this.prune()
    const trimmed = code.trim()
    const record = this.pairingTokens.get(trimmed)
    if (!record || record.expiresAt <= Date.now()) {
      this.pairingTokens.delete(trimmed)
      this.recordFailure(ip)
      return null
    }
    this.pairingTokens.delete(trimmed)
    this.attempts.delete(ip)
    const token = randomBytes(32).toString('base64url')
    const now = Date.now()
    this.sessions.set(token, { username: record.username, createdAt: now, lastSeen: now })
    return token
  }

  login(username: string, password: string, ip: string): string | null {
    if (!this.allowAttempt(ip)) return null
    const expected = this.credentials()
    if (!expected) return null
    const userOk = username.trim() === expected.username
    const passOk = verifyPassword(password, expected.salt, expected.hash)
    if (!userOk || !passOk) {
      this.recordFailure(ip)
      return null
    }
    this.attempts.delete(ip)
    const token = randomBytes(32).toString('base64url')
    const now = Date.now()
    this.sessions.set(token, { username: expected.username, createdAt: now, lastSeen: now })
    this.prune()
    return token
  }

  resume(token: string): string | null {
    const session = this.sessions.get(token)
    if (!session) return null
    if (Date.now() - session.createdAt > SESSION_TTL_MS) {
      this.sessions.delete(token)
      return null
    }
    session.lastSeen = Date.now()
    return session.username
  }

  logout(token: string): void {
    this.sessions.delete(token)
  }

  logoutAll(): void {
    this.sessions.clear()
  }

  private allowAttempt(ip: string): boolean {
    const now = Date.now()
    const record = this.attempts.get(ip)
    if (!record || record.resetAt <= now) {
      this.attempts.delete(ip)
      return true
    }
    return record.count < MAX_ATTEMPTS
  }

  private recordFailure(ip: string): void {
    const now = Date.now()
    const record = this.attempts.get(ip)
    if (!record || record.resetAt <= now) {
      this.attempts.set(ip, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS })
      return
    }
    record.count += 1
  }

  private prune(): void {
    const now = Date.now()
    for (const [token, session] of this.sessions) {
      if (now - session.createdAt > SESSION_TTL_MS) this.sessions.delete(token)
    }
    for (const [code, record] of this.pairingTokens) {
      if (record.expiresAt <= now) this.pairingTokens.delete(code)
    }
    for (const [ip, record] of this.attempts) {
      if (record.resetAt <= now) this.attempts.delete(ip)
    }
  }
}
