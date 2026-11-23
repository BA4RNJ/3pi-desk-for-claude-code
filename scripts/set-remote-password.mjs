#!/usr/bin/env node
/**
 * Configure the LAN/web login without embedding a password in the repo.
 *
 * Usage:
 *   node scripts/set-remote-password.mjs <username> <password> [--port 3789]
 *     [--bind lan|localhost] [--data-dir /path/to/claude-desk]
 *
 * The password is stored as a scrypt hash in <userData>/settings.json (0600).
 */
import { randomBytes, scryptSync } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

function dataDirFromArgs() {
  const index = process.argv.indexOf('--data-dir')
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1]
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'claude-desk')
  }
  if (process.platform === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'claude-desk')
  }
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'claude-desk')
}

function arg(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

const positional = []
const valueFlags = new Set(['--port', '--bind', '--data-dir'])
const rawArgs = process.argv.slice(2)
for (let index = 0; index < rawArgs.length; index += 1) {
  if (valueFlags.has(rawArgs[index])) {
    index += 1
    continue
  }
  if (!rawArgs[index].startsWith('--')) positional.push(rawArgs[index])
}
const username = positional[0] || 'ba4rnj'
const password = rawArgs.includes('--password-stdin')
  ? readFileSync(0, 'utf8').trim()
  : positional[1]
if (!password) {
  console.error('Usage: node scripts/set-remote-password.mjs <username> <password> [--port 3789] [--bind lan]')
  process.exit(1)
}

const dataDir = dataDirFromArgs()
const settingsPath = join(dataDir, 'settings.json')
let settings = {}
if (existsSync(settingsPath)) {
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
  } catch {
    console.error(`Cannot parse ${settingsPath}; refusing to overwrite it.`)
    process.exit(1)
  }
}

const salt = randomBytes(16).toString('hex')
const hash = scryptSync(password, salt, 64).toString('hex')
const current = settings.remote || {}
settings.remote = {
  ...current,
  enabled: true,
  port: Number(arg('--port', current.port || 3789)),
  bind: arg('--bind', current.bind || 'lan'),
  username,
  passwordSalt: salt,
  passwordHash: hash
}

mkdirSync(dataDir, { recursive: true })
writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 })
console.log(`Remote access configured for user "${username}" in ${settingsPath}`)
console.log('Restart 3PI Desk, or open Settings → 远程访问 and save once, to start the server.')
