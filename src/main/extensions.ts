import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { promisify } from 'node:util'
import type {
  AgentEntry,
  AvailablePlugin,
  ExtensionsSnapshot,
  HookEntry,
  McpConfigSnapshot,
  McpServerEntry,
  PluginEntry,
  PluginMarketplaceSnapshot,
  SkillEntry
} from '../shared/types'
import { resolveClaudeExecutable } from './session'
import { claudeSettingsPath } from './settings'

const execFileAsync = promisify(execFile)

let activePluginAbort: AbortController | null = null
let activePluginChild: ChildProcess | null = null

function runPluginCommand(
  args: string[],
  cwd: string,
  timeoutMs = 180_000
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(claudeBinary(), args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const abort = new AbortController()
    activePluginAbort = abort
    activePluginChild = child
    let stdout = ''
    let stderr = ''
    let settled = false

    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      abort.signal.removeEventListener('abort', onAbort)
      if (activePluginAbort === abort) activePluginAbort = null
      if (activePluginChild === child) activePluginChild = null
      if (error) reject(error)
      else resolve({ stdout, stderr })
    }

    const onAbort = (): void => {
      child.kill('SIGTERM')
      finish(new Error('Operation cancelled.'))
    }

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      finish(new Error('Plugin operation timed out and was cancelled.'))
    }, timeoutMs)

    abort.signal.addEventListener('abort', onAbort)
    child.stdout?.on('data', (data) => {
      stdout += String(data)
      if (stdout.length > 5 * 1024 * 1024) stdout = stdout.slice(0, 5 * 1024 * 1024)
    })
    child.stderr?.on('data', (data) => {
      stderr += String(data)
      if (stderr.length > 5 * 1024 * 1024) stderr = stderr.slice(0, 5 * 1024 * 1024)
    })
    child.on('error', (error) => finish(error))
    child.on('close', (code) => {
      if (code === 0) finish()
      else finish(new Error(stderr.trim() || stdout.trim() || `Command failed (exit code ${code})`))
    })
  })
}

export function cancelPluginAction(): void {
  activePluginAbort?.abort()
  activePluginChild?.kill('SIGTERM')
  activePluginAbort = null
  activePluginChild = null
}

function claudeConfigPath(): string {
  return join(homedir(), '.claude.json')
}

function claudeDir(): string {
  return process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
}

function claudeBinary(): string {
  return resolveClaudeExecutable() || 'claude'
}

interface ClaudeConfig {
  mcpServers?: Record<string, Record<string, unknown>>
  projects?: Record<
    string,
    { mcpServers?: Record<string, Record<string, unknown>>; [key: string]: unknown }
  >
  [key: string]: unknown
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path, 'utf8')) as T
  } catch {
    return fallback
  }
}

async function writeJson(path: string, value: unknown, mode = 0o600): Promise<void> {
  await fs.writeFile(path, JSON.stringify(value, null, 2) + '\n', { mode })
}

function frontmatter(text: string): Record<string, string> {
  if (!text.startsWith('---')) return {}
  const end = text.indexOf('\n---', 3)
  if (end < 0) return {}
  const block = text.slice(3, end)
  const result: Record<string, string> = {}
  for (const line of block.split('\n')) {
    const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/)
    if (!match) continue
    result[match[1]] = match[2].replace(/^["']|["']$/g, '').trim()
  }
  return result
}

async function scanSkills(cwd: string): Promise<SkillEntry[]> {
  const skills: SkillEntry[] = []
  const locations: Array<{ dir: string; scope: SkillEntry['scope'] }> = [
    { dir: join(claudeDir(), 'skills'), scope: 'user' },
    { dir: join(cwd, '.claude', 'skills'), scope: 'project' },
    { dir: join(cwd, '.claude', 'skills'), scope: 'project' }
  ]
  const seen = new Set<string>()

  for (const location of locations) {
    let entries
    try {
      entries = await fs.readdir(location.dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const path = join(location.dir, entry.name, 'SKILL.md')
      const key = `${location.scope}:${path}`
      if (seen.has(key)) continue
      seen.add(key)
      try {
        const text = await fs.readFile(path, 'utf8')
        const meta = frontmatter(text)
        skills.push({
          name: meta.name || entry.name,
          description: meta.description,
          path,
          scope: location.scope
        })
      } catch {
        // not a skill directory
      }
    }
  }
  return skills
}

async function scanAgents(cwd: string): Promise<AgentEntry[]> {
  const agents: AgentEntry[] = [
    {
      name: 'general-purpose',
      description: 'Built-in general-purpose subagent for multi-step tasks.',
      scope: 'builtin'
    }
  ]
  const locations: Array<{ dir: string; scope: AgentEntry['scope'] }> = [
    { dir: join(claudeDir(), 'agents'), scope: 'user' },
    { dir: join(cwd, '.claude', 'agents'), scope: 'project' }
  ]

  for (const location of locations) {
    let entries
    try {
      entries = await fs.readdir(location.dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
      const path = join(location.dir, entry.name)
      try {
        const text = await fs.readFile(path, 'utf8')
        const meta = frontmatter(text)
        agents.push({
          name: meta.name || basename(entry.name, '.md'),
          description: meta.description,
          model: meta.model,
          scope: location.scope,
          path
        })
      } catch {
        // skip
      }
    }
  }
  return agents
}

async function readHooks(cwd: string): Promise<HookEntry[]> {
  const hooks: HookEntry[] = []
  const files: Array<{ path: string; source: string }> = [
    { path: claudeSettingsPath(), source: 'User settings' },
    { path: join(cwd, '.claude', 'settings.json'), source: 'Project settings' },
    { path: join(cwd, '.claude', 'settings.local.json'), source: 'Local settings' }
  ]

  for (const file of files) {
    const settings = await readJson<Record<string, any>>(file.path, {})
    const configured = settings.hooks
    if (!configured || typeof configured !== 'object') continue
    for (const [event, matchers] of Object.entries(configured)) {
      if (!Array.isArray(matchers)) continue
      for (const matcher of matchers as Array<Record<string, any>>) {
        const matcherText = matcher?.matcher ? String(matcher.matcher) : ''
        const list = Array.isArray(matcher?.hooks) ? matcher.hooks : []
        for (const hook of list as Array<Record<string, any>>) {
          const command =
            hook?.command || hook?.prompt || hook?.url || hook?.type || 'unknown'
          hooks.push({
            event,
            matcher: matcherText,
            command: String(command).slice(0, 500),
            source: file.source
          })
        }
      }
    }
  }
  return hooks
}

async function readMcpServers(
  cwd: string,
  statuses: McpServerEntry[]
): Promise<McpServerEntry[]> {
  const servers: McpServerEntry[] = []
  const config = await readJson<ClaudeConfig>(claudeConfigPath(), {})
  const projectConfig = await readJson<{ mcpServers?: Record<string, Record<string, unknown>> }>(
    join(cwd, '.mcp.json'),
    {}
  )

  const statusFor = (name: string): McpServerEntry | undefined =>
    statuses.find((status) => status.name === name)

  for (const [name, serverConfig] of Object.entries(config.mcpServers || {})) {
    const status = statusFor(name)
    servers.push({
      name,
      scope: 'user',
      config: serverConfig,
      status: status?.status,
      source: status?.source,
      tools: status?.tools
    })
  }
  for (const [name, serverConfig] of Object.entries(
    config.projects?.[cwd]?.mcpServers || {}
  )) {
    const status = statusFor(name)
    servers.push({
      name,
      scope: 'local',
      config: serverConfig,
      status: status?.status,
      source: status?.source,
      tools: status?.tools
    })
  }
  for (const [name, serverConfig] of Object.entries(projectConfig.mcpServers || {})) {
    const status = statusFor(name)
    servers.push({
      name,
      scope: 'project',
      config: serverConfig,
      status: status?.status,
      source: status?.source,
      tools: status?.tools
    })
  }

  for (const status of statuses) {
    if (servers.some((server) => server.name === status.name)) continue
    servers.push(status)
  }
  return servers
}

async function listPlugins(cwd: string): Promise<PluginEntry[]> {
  try {
    const { stdout } = await execFileAsync(claudeBinary(), ['plugin', 'list', '--json'], {
      cwd,
      timeout: 20_000,
      maxBuffer: 5 * 1024 * 1024,
      env: process.env
    })
    const parsed = JSON.parse(stdout) as unknown
    const items = Array.isArray(parsed)
      ? parsed
      : (parsed as { plugins?: unknown[] })?.plugins
    if (!Array.isArray(items)) return []
    const plugins: PluginEntry[] = []
    for (const raw of items as Array<Record<string, any>>) {
      const name = String(raw.name || raw.id || raw.plugin || '')
      if (!name) continue
      plugins.push({
        name,
        version: raw.version ? String(raw.version) : undefined,
        enabled: raw.enabled !== false && raw.status !== 'disabled',
        description: raw.description ? String(raw.description) : undefined,
        marketplace: raw.marketplace ? String(raw.marketplace) : undefined
      })
    }
    return plugins
  } catch {
    return []
  }
}

export async function listExtensions(
  cwd: string,
  mcpStatus: McpServerEntry[] = []
): Promise<ExtensionsSnapshot> {
  const [plugins, skills, hooks, agents, mcp] = await Promise.all([
    listPlugins(cwd),
    scanSkills(cwd),
    readHooks(cwd),
    scanAgents(cwd),
    readMcpServers(cwd, mcpStatus)
  ])
  return { mcp, plugins, skills, hooks, agents }
}

function mcpScopePath(
  scope: McpConfigSnapshot['scope'],
  cwd: string
): string {
  return scope === 'project' ? join(cwd, '.mcp.json') : claudeConfigPath()
}

export async function readMcpConfig(
  scope: McpConfigSnapshot['scope'],
  cwd: string
): Promise<McpConfigSnapshot> {
  const path = mcpScopePath(scope, cwd)
  const config = await readJson<ClaudeConfig>(path, {})
  const servers =
    scope === 'user'
      ? config.mcpServers || {}
      : scope === 'local'
        ? config.projects?.[cwd]?.mcpServers || {}
        : (await readJson<{ mcpServers?: Record<string, unknown> }>(path, {})).mcpServers || {}
  return {
    scope,
    path,
    text: JSON.stringify(servers, null, 2)
  }
}

export async function saveMcpConfig(
  scope: McpConfigSnapshot['scope'],
  cwd: string,
  text: string
): Promise<McpConfigSnapshot> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error(`JSON Invalid JSON: ${error instanceof Error ? error.message : error}`)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('MCP Configuration must be a JSON object.')
  }
  const servers = parsed as Record<string, Record<string, unknown>>

  const path = mcpScopePath(scope, cwd)
  if (scope === 'project') {
    const existing = await readJson<Record<string, unknown>>(path, {})
    await writeJson(path, { ...existing, mcpServers: servers }, 0o644)
  } else {
    const config = await readJson<ClaudeConfig>(path, {})
    if (scope === 'user') {
      config.mcpServers = servers
    } else {
      const project = config.projects?.[cwd] || {}
      config.projects = {
        ...(config.projects || {}),
        [cwd]: { ...project, mcpServers: servers }
      }
    }
    await writeJson(path, config)
  }

  return {
    scope,
    path,
    text: JSON.stringify(servers, null, 2)
  }
}

export async function togglePlugin(name: string, enabled: boolean): Promise<void> {
  await execFileAsync(
    claudeBinary(),
    ['plugin', enabled ? 'enable' : 'disable', name],
    {
      cwd: homedir(),
      timeout: 30_000,
      maxBuffer: 5 * 1024 * 1024,
      env: process.env
    }
  )
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

export type PluginAction = 'install' | 'update' | 'uninstall' | 'enable' | 'disable'

export async function pluginAction(
  action: PluginAction,
  name: string,
  cwd: string
): Promise<void> {
  const args =
    action === 'install'
      ? ['plugin', 'install', name, '--json']
      : action === 'update'
        ? ['plugin', 'update', name, '--json']
        : action === 'uninstall'
          ? ['plugin', 'uninstall', name, '--json']
          : action === 'enable'
            ? ['plugin', 'enable', name]
            : ['plugin', 'disable', name]
  await runPluginCommand(args, cwd, 180_000)
}

function extensionRoots(cwd: string): string[] {
  return [
    join(claudeDir(), 'skills'),
    join(claudeDir(), 'agents'),
    join(cwd, '.claude', 'skills'),
    join(cwd, '.claude', 'agents')
  ]
}

function assertExtensionPath(path: string, cwd: string): void {
  const target = path.startsWith('/') ? path : join(cwd, path)
  const allowed = extensionRoots(cwd).some((root) => target.startsWith(`${root}/`))
  if (!allowed) throw new Error('You can only edit files under skills or agents directories.')
  if (!target.endsWith('.md')) throw new Error('Only Markdown files are supported.')
}

export async function readExtensionFile(
  path: string,
  cwd: string
): Promise<{ path: string; text: string }> {
  assertExtensionPath(path, cwd)
  return { path, text: await fs.readFile(path, 'utf8') }
}

export async function writeExtensionFile(
  path: string,
  text: string,
  cwd: string
): Promise<void> {
  assertExtensionPath(path, cwd)
  await fs.writeFile(path, text, 'utf8')
}

export async function createExtensionFile(
  kind: 'skill' | 'agent',
  scope: 'user' | 'project',
  cwd: string,
  name: string,
  text: string
): Promise<{ path: string; text: string }> {
  const safe = name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
  if (!safe) throw new Error('Name cannot be empty.')
  const root =
    scope === 'user'
      ? join(claudeDir(), kind === 'skill' ? 'skills' : 'agents')
      : join(cwd, '.claude', kind === 'skill' ? 'skills' : 'agents')
  await fs.mkdir(root, { recursive: true })
  const path =
    kind === 'skill' ? join(root, safe, 'SKILL.md') : join(root, `${safe}.md`)
  await fs.mkdir(kind === 'skill' ? join(root, safe) : root, { recursive: true })
  await fs.writeFile(path, text, 'utf8')
  return { path, text }
}

export async function deleteExtensionFile(path: string, cwd: string): Promise<void> {
  assertExtensionPath(path, cwd)
  if (path.endsWith('SKILL.md')) {
    await fs.rm(path.replace(/\/SKILL\.md$/, ''), { recursive: true, force: true })
    return
  }
  await fs.rm(path, { force: true })
}

function hooksSettingsPath(scope: 'user' | 'project', cwd: string): string {
  return scope === 'user' ? claudeSettingsPath() : join(cwd, '.claude', 'settings.json')
}

export async function readHooksConfig(
  scope: 'user' | 'project',
  cwd: string
): Promise<{ path: string; text: string }> {
  const path = hooksSettingsPath(scope, cwd)
  const settings = await readJson<Record<string, any>>(path, {})
  return { path, text: JSON.stringify(settings.hooks || {}, null, 2) }
}

export async function saveHooksConfig(
  scope: 'user' | 'project',
  cwd: string,
  text: string
): Promise<{ path: string; text: string }> {
  let hooks: unknown
  try {
    hooks = JSON.parse(text)
  } catch (error) {
    throw new Error(`JSON Invalid JSON: ${error instanceof Error ? error.message : error}`)
  }
  if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) {
    throw new Error('Hooks Configuration must be a JSON object.')
  }
  const path = hooksSettingsPath(scope, cwd)
  const settings = await readJson<Record<string, any>>(path, {})
  settings.hooks = hooks
  await fs.mkdir(dirname(path), { recursive: true })
  await writeJson(path, settings, 0o600)
  return { path, text: JSON.stringify(hooks, null, 2) }
}

function describeSource(source: unknown): string {
  if (!source) return ''
  if (typeof source === 'string') return source
  if (typeof source === 'object') {
    const value = source as Record<string, unknown>
    if (value.repo) return `github:${value.repo}`
    if (value.url) return String(value.url)
    if (value.path) return String(value.path)
  }
  return JSON.stringify(source).slice(0, 160)
}

export async function pluginMarketplaces(cwd: string): Promise<PluginMarketplaceSnapshot> {
  const known = await readJson<Record<string, any>>(
    join(claudeDir(), 'plugins', 'known_marketplaces.json'),
    {}
  )
  const marketplaces = Object.entries(known).map(([name, value]) => ({
    name,
    source: describeSource(value?.source),
    lastUpdated: value?.lastUpdated ? Number(value.lastUpdated) : undefined,
    installLocation: value?.installLocation ? String(value.installLocation) : undefined
  }))

  let available: AvailablePlugin[] = []
  try {
    const { stdout } = await execFileAsync(
      claudeBinary(),
      ['plugin', 'list', '--available', '--json'],
      { cwd, timeout: 60_000, maxBuffer: 10 * 1024 * 1024, env: process.env }
    )
    const parsed = JSON.parse(stdout) as {
      installed?: Array<Record<string, any>>
      available?: Array<Record<string, any>>
    }
    const installedNames = new Set(
      (parsed.installed || []).map((plugin) => String(plugin.name || plugin.id || ''))
    )
    available = (parsed.available || [])
      .filter((plugin) => plugin?.name)
      .map((plugin) => ({
        pluginId: String(plugin.pluginId || `${plugin.name}@${plugin.marketplaceName || ''}`),
        name: String(plugin.name),
        description: plugin.description ? String(plugin.description) : undefined,
        marketplaceName: plugin.marketplaceName ? String(plugin.marketplaceName) : undefined,
        installCount: plugin.installCount ? Number(plugin.installCount) : undefined,
        installed: installedNames.has(String(plugin.name))
      }))
      .sort((a, b) => (b.installCount || 0) - (a.installCount || 0))
  } catch {
    // keep an empty catalog
  }

  return { marketplaces, available }
}

export async function marketplaceAdd(
  source: string,
  cwd: string
): Promise<PluginMarketplaceSnapshot> {
  await runPluginCommand(['plugin', 'marketplace', 'add', source], cwd, 180_000)
  return pluginMarketplaces(cwd)
}

export async function marketplaceUpdate(
  name: string | undefined,
  cwd: string
): Promise<PluginMarketplaceSnapshot> {
  await runPluginCommand(
    name ? ['plugin', 'marketplace', 'update', name] : ['plugin', 'marketplace', 'update'],
    cwd,
    180_000
  )
  return pluginMarketplaces(cwd)
}

export async function marketplaceRemove(
  name: string,
  cwd: string
): Promise<PluginMarketplaceSnapshot> {
  await runPluginCommand(['plugin', 'marketplace', 'remove', name], cwd, 60_000)
  return pluginMarketplaces(cwd)
}
