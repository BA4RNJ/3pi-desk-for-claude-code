import {
  Bot,
  BookOpen,
  Download,
  Plug,
  Plus,
  Puzzle,
  RefreshCw,
  Save,
  Search,
  Server,
  Store,
  Trash2,
  Webhook,
  X
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type {
  AvailablePlugin,
  ExtensionsSnapshot,
  McpConfigSnapshot,
  McpServerEntry,
  PluginAction,
  PluginEntry,
  PluginMarketplaceSnapshot
} from '../../../shared/types'

interface ExtensionsPanelProps {
  cwd: string
  home?: string
  tabId?: string
  onOpenPath: (path: string) => void
}

type ExtensionTab = 'mcp' | 'plugins' | 'skills' | 'hooks' | 'agents'

const TABS: Array<{ id: ExtensionTab; label: string; icon: typeof Server }> = [
  { id: 'mcp', label: 'MCP', icon: Server },
  { id: 'plugins', label: '插件', icon: Puzzle },
  { id: 'skills', label: '技能', icon: BookOpen },
  { id: 'hooks', label: 'Hooks', icon: Webhook },
  { id: 'agents', label: 'Agents', icon: Bot }
]

const MCP_STATUS_TEXT: Record<string, string> = {
  connected: '已连接',
  failed: '连接失败',
  'needs-auth': '需要登录',
  pending: '等待中',
  disabled: '已停用'
}

interface ExtensionEditorState {
  kind: 'skill' | 'agent'
  creating: boolean
  path?: string
  name: string
  text: string
  scope: 'user' | 'project'
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function skillTemplate(name: string): string {
  return `---
name: ${name}
description: Describe when this skill should be used.
---

# ${name}

Write the skill instructions here.
`
}

function agentTemplate(name: string): string {
  return `---
name: ${name}
description: Describe when this agent should be used.
model: deepseek-v4.1-flash
---

You are a specialized assistant. Explain your role and constraints here.
`
}

export function ExtensionsPanel({ cwd, home, tabId, onOpenPath }: ExtensionsPanelProps) {
  const [tab, setTab] = useState<ExtensionTab>('mcp')
  const [snapshot, setSnapshot] = useState<ExtensionsSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [scope, setScope] = useState<McpConfigSnapshot['scope']>('user')
  const [mcpText, setMcpText] = useState('')
  const [mcpPath, setMcpPath] = useState('')
  const [mcpSaving, setMcpSaving] = useState(false)
  const [busyPlugin, setBusyPlugin] = useState('')
  const [pluginName, setPluginName] = useState('')
  const [hooksScope, setHooksScope] = useState<'user' | 'project'>('user')
  const [hooksText, setHooksText] = useState('')
  const [hooksPath, setHooksPath] = useState('')
  const [editor, setEditor] = useState<ExtensionEditorState | null>(null)
  const [editingSaving, setEditingSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [market, setMarket] = useState<PluginMarketplaceSnapshot | null>(null)
  const [marketLoading, setMarketLoading] = useState(false)
  const [marketQuery, setMarketQuery] = useState('')
  const [newMarketplace, setNewMarketplace] = useState('')
  const [busyMarket, setBusyMarket] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setSnapshot(await window.desk.listExtensions(cwd, tabId))
    } catch (loadError) {
      setError(errorText(loadError))
    } finally {
      setLoading(false)
    }
  }, [cwd, tabId])

  const loadMcpConfig = useCallback(async () => {
    try {
      const config = await window.desk.readMcpConfig(scope, cwd)
      setMcpText(config.text)
      setMcpPath(config.path)
    } catch (configError) {
      setError(errorText(configError))
    }
  }, [cwd, scope])

  const loadMarket = useCallback(async () => {
    setMarketLoading(true)
    try {
      setMarket(await window.desk.pluginMarketplaces(cwd))
    } catch (marketError) {
      setError(errorText(marketError))
    } finally {
      setMarketLoading(false)
    }
  }, [cwd])

  const loadHooksConfig = useCallback(async () => {
    try {
      const config = await window.desk.readHooksConfig(hooksScope, cwd)
      setHooksText(config.text)
      setHooksPath(config.path)
    } catch (hooksError) {
      setError(errorText(hooksError))
    }
  }, [cwd, hooksScope])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (tab === 'mcp') void loadMcpConfig()
    if (tab === 'hooks') void loadHooksConfig()
    if (tab === 'plugins') void loadMarket()
  }, [tab, loadMcpConfig, loadHooksConfig, loadMarket])

  const saveMcp = async (): Promise<void> => {
    setMcpSaving(true)
    setError('')
    try {
      const config = await window.desk.saveMcpConfig(scope, cwd, mcpText)
      setMcpText(config.text)
      setMcpPath(config.path)
      await load()
    } catch (saveError) {
      setError(errorText(saveError))
    } finally {
      setMcpSaving(false)
    }
  }

  const saveHooks = async (): Promise<void> => {
    setError('')
    try {
      const config = await window.desk.saveHooksConfig(hooksScope, cwd, hooksText)
      setHooksText(config.text)
      setHooksPath(config.path)
      await load()
    } catch (saveError) {
      setError(errorText(saveError))
    }
  }

  const toggleMcp = async (server: McpServerEntry): Promise<void> => {
    if (!tabId) return
    try {
      await window.desk.toggleMcp(tabId, server.name, server.status === 'disabled')
      await load()
    } catch (toggleError) {
      setError(errorText(toggleError))
    }
  }

  const togglePluginEntry = async (plugin: PluginEntry): Promise<void> => {
    setBusyPlugin(plugin.name)
    setError('')
    try {
      const next = await window.desk.togglePlugin(plugin.name, !plugin.enabled, cwd, tabId)
      setSnapshot(next)
    } catch (toggleError) {
      setError(errorText(toggleError))
    } finally {
      setBusyPlugin('')
    }
  }

  const runPluginAction = async (action: PluginAction, name: string): Promise<void> => {
    setBusyPlugin(name)
    setError('')
    try {
      const next = await window.desk.pluginAction(action, name, cwd, tabId)
      setSnapshot(next)
      setPluginName('')
    } catch (actionError) {
      setError(errorText(actionError))
    } finally {
      setBusyPlugin('')
    }
  }

  const installFromMarket = async (plugin: AvailablePlugin): Promise<void> => {
    if (busyMarket) return
    setBusyMarket(plugin.pluginId)
    setError('')
    setMessage('')
    try {
      const next = await window.desk.pluginAction('install', plugin.pluginId, cwd, tabId)
      setSnapshot(next)
      await loadMarket()
    } catch (installError) {
      const message = errorText(installError).replace(
        /^Error invoking remote method '[^']+':\s*(Error:\s*)?/,
        ''
      )
      if (message.includes('取消') || message.includes('超时')) {
        setMessage(message)
      } else {
        setError(message)
      }
    } finally {
      setBusyMarket('')
    }
  }

  const cancelMarketAction = async (): Promise<void> => {
    try {
      await window.desk.cancelPluginAction()
      setMessage('已取消插件市场操作')
    } catch (cancelError) {
      setError(errorText(cancelError))
    } finally {
      setBusyMarket('')
    }
  }

  const addMarketplace = async (): Promise<void> => {
    if (!newMarketplace.trim()) return
    setBusyMarket('add-market')
    setError('')
    setMessage('')
    try {
      setMarket(await window.desk.marketplaceAdd(newMarketplace.trim(), cwd))
      setNewMarketplace('')
    } catch (marketError) {
      setError(errorText(marketError))
    } finally {
      setBusyMarket('')
    }
  }

  const updateMarketplace = async (name?: string): Promise<void> => {
    setBusyMarket(`update-${name || 'all'}`)
    setError('')
    setMessage('')
    try {
      setMarket(await window.desk.marketplaceUpdate(name, cwd))
    } catch (marketError) {
      setError(errorText(marketError))
    } finally {
      setBusyMarket('')
    }
  }

  const removeMarketplace = async (name: string): Promise<void> => {
    setBusyMarket(`remove-${name}`)
    setError('')
    setMessage('')
    try {
      setMarket(await window.desk.marketplaceRemove(name, cwd))
    } catch (marketError) {
      setError(errorText(marketError))
    } finally {
      setBusyMarket('')
    }
  }

  const openCreate = (kind: 'skill' | 'agent'): void => {
    const name = kind === 'skill' ? 'new-skill' : 'new-agent'
    setEditor({
      kind,
      creating: true,
      name,
      text: kind === 'skill' ? skillTemplate(name) : agentTemplate(name),
      scope: 'user'
    })
  }

  const openEdit = async (path: string, kind: 'skill' | 'agent'): Promise<void> => {
    try {
      const file = await window.desk.readExtensionFile(path, cwd)
      setEditor({
        kind,
        creating: false,
        path,
        name: path.split('/').at(-2) || path.split('/').at(-1) || 'extension',
        text: file.text,
        scope: path.startsWith(`${home}/`) ? 'user' : 'project'
      })
    } catch (editError) {
      setError(errorText(editError))
    }
  }

  const saveEditor = async (): Promise<void> => {
    if (!editor) return
    setEditingSaving(true)
    setError('')
    try {
      if (editor.creating) {
        await window.desk.createExtensionFile(
          editor.kind,
          editor.scope,
          cwd,
          editor.name,
          editor.text
        )
      } else if (editor.path) {
        await window.desk.writeExtensionFile(editor.path, editor.text, cwd)
      }
      setEditor(null)
      await load()
    } catch (saveError) {
      setError(errorText(saveError))
    } finally {
      setEditingSaving(false)
    }
  }

  const removeExtension = async (path: string): Promise<void> => {
    if (deleteConfirm !== path) {
      setDeleteConfirm(path)
      return
    }
    setDeleteConfirm(null)
    try {
      await window.desk.deleteExtensionFile(path, cwd)
      await load()
    } catch (deleteError) {
      setError(errorText(deleteError))
    }
  }

  const counts = {
    mcp: snapshot?.mcp.length || 0,
    plugins: snapshot?.plugins.length || 0,
    skills: snapshot?.skills.length || 0,
    hooks: snapshot?.hooks.length || 0,
    agents: snapshot?.agents.length || 0
  }

  return (
    <div className="extensions-panel">
      <div className="extension-tabs">
        {TABS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              className={`extension-tab ${tab === item.id ? 'is-active' : ''}`}
              onClick={() => {
                setTab(item.id)
                setDeleteConfirm(null)
              }}
            >
              <Icon size={14} />
              <span>{item.label}</span>
              <em>{counts[item.id]}</em>
            </button>
          )
        })}
        <button
          type="button"
          className="icon-button extension-refresh"
          onClick={() => void load()}
          title="刷新"
          aria-label="刷新扩展"
        >
          <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
        </button>
      </div>

      {error && <div className="settings-error">{error}</div>}
      {message && <div className="settings-message">{message}</div>}

      {tab === 'mcp' && (
        <div className="extension-section">
          <div className="extension-list">
            {(snapshot?.mcp || []).length === 0 && (
              <p className="settings-empty">还没有配置 MCP 服务器。</p>
            )}
            {(snapshot?.mcp || []).map((server) => (
              <div key={`${server.scope}-${server.name}`} className="extension-row">
                <span className={`extension-icon status-${server.status || 'disabled'}`}>
                  <Plug size={14} />
                </span>
                <div className="extension-copy">
                  <strong>{server.name}</strong>
                  <small>
                    {server.scope} · {MCP_STATUS_TEXT[server.status || ''] || server.status || '未连接'}
                    {server.tools?.length ? ` · ${server.tools.length} 个工具` : ''}
                  </small>
                </div>
                <button
                  type="button"
                  className="mini-button"
                  disabled={!tabId || !server.status}
                  onClick={() => void toggleMcp(server)}
                >
                  {server.status === 'disabled' ? '启用' : '停用'}
                </button>
              </div>
            ))}
          </div>

          <div className="extension-editor">
            <div className="extension-editor-head">
              <div>
                <strong>MCP 配置</strong>
                <small>{mcpPath}</small>
              </div>
              <div className="scope-switch">
                {(['user', 'project', 'local'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={scope === item ? 'is-active' : ''}
                    onClick={() => setScope(item)}
                  >
                    {item === 'user' ? '用户' : item === 'project' ? '项目' : '本地'}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              className="config-editor"
              spellCheck={false}
              value={mcpText}
              onChange={(event) => setMcpText(event.target.value)}
            />
            <div className="extension-editor-actions">
              <small>保存后对新会话生效；当前会话可切换已有服务器。</small>
              <button
                type="button"
                className="button primary"
                disabled={mcpSaving}
                onClick={() => void saveMcp()}
              >
                <Save size={14} /> 保存配置
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'plugins' && (
        <>
          {(busyMarket || busyPlugin) && (
            <div className="market-busy">
              <span className="spinner" />
              <span>正在执行插件操作…</span>
              <button
                type="button"
                className="mini-button"
                onClick={() => void cancelMarketAction()}
              >
                取消
              </button>
            </div>
          )}

          <div className="extension-list">
            <div className="extension-actions plugin-install">
              <input
                className="text-input"
                value={pluginName}
                placeholder="插件名或 name@marketplace"
                onChange={(event) => setPluginName(event.target.value)}
              />
              <button
                type="button"
                className="button primary"
                disabled={!pluginName.trim() || Boolean(busyPlugin) || Boolean(busyMarket)}
                onClick={() => void runPluginAction('install', pluginName.trim())}
              >
                <Download size={14} /> 安装
              </button>
            </div>
            {(snapshot?.plugins || []).length === 0 && (
              <p className="settings-empty">
                未安装插件。可以从下方官方市场直接安装。
              </p>
            )}
            {(snapshot?.plugins || []).map((plugin) => (
              <div key={plugin.name} className="extension-row">
                <span className="extension-icon">
                  <Puzzle size={14} />
                </span>
                <div className="extension-copy">
                  <strong>{plugin.name}</strong>
                  <small>
                    {plugin.marketplace || '本地插件'}
                    {plugin.version ? ` · v${plugin.version}` : ''}
                    {plugin.description ? ` · ${plugin.description}` : ''}
                  </small>
                </div>
                <button
                  type="button"
                  className="mini-button"
                  disabled={busyPlugin === plugin.name || Boolean(busyMarket)}
                  onClick={() => void togglePluginEntry(plugin)}
                >
                  {plugin.enabled ? '停用' : '启用'}
                </button>
                <button
                  type="button"
                  className="mini-button"
                  disabled={busyPlugin === plugin.name || Boolean(busyMarket)}
                  onClick={() => void runPluginAction('update', plugin.name)}
                >
                  更新
                </button>
                <button
                  type="button"
                  className="mini-button danger-text"
                  disabled={busyPlugin === plugin.name || Boolean(busyMarket)}
                  onClick={() => void runPluginAction('uninstall', plugin.name)}
                >
                  卸载
                </button>
              </div>
            ))}
            <p className="settings-empty">插件变更后需新会话生效。</p>
          </div>

          <div className="market-section">
            <div className="market-head">
              <strong><Store size={14} /> 插件市场</strong>
              <button
                type="button"
                className="icon-button"
                onClick={() => void loadMarket()}
                title="刷新市场"
                aria-label="刷新插件市场"
              >
                <RefreshCw size={14} className={marketLoading ? 'spin-icon' : ''} />
              </button>
            </div>


            <div className="extension-actions">
              <input
                className="text-input"
                value={newMarketplace}
                placeholder="添加市场：owner/repo 或 Git URL"
                onChange={(event) => setNewMarketplace(event.target.value)}
              />
              <button
                type="button"
                className="mini-button"
                disabled={!newMarketplace.trim() || Boolean(busyMarket)}
                onClick={() => void addMarketplace()}
              >
                <Plus size={13} /> 添加市场
              </button>
              <button
                type="button"
                className="mini-button"
                disabled={Boolean(busyMarket)}
                onClick={() => void updateMarketplace(undefined)}
              >
                更新全部
              </button>
            </div>

            <div className="market-list">
              {(market?.marketplaces || []).map((entry) => (
                <div key={entry.name} className="market-row">
                  <div>
                    <strong>{entry.name}</strong>
                    <small>{entry.source}</small>
                  </div>
                  <button
                    type="button"
                    className="mini-button"
                    disabled={Boolean(busyMarket)}
                    onClick={() => void updateMarketplace(entry.name)}
                  >
                    更新
                  </button>
                  {entry.name !== 'claude-plugins-official' && (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="移除市场"
                      onClick={() => void removeMarketplace(entry.name)}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
              {(market?.marketplaces || []).length === 0 && (
                <p className="settings-empty">还没有配置插件市场。</p>
              )}
            </div>

            <div className="market-search">
              <Search size={13} />
              <input
                value={marketQuery}
                placeholder="搜索可用插件…"
                spellCheck={false}
                onChange={(event) => setMarketQuery(event.target.value)}
              />
            </div>

            <div className="market-available">
              {(market?.available || [])
                .filter((plugin) => {
                  const term = marketQuery.trim().toLowerCase()
                  if (!term) return true
                  return [plugin.name, plugin.description, plugin.marketplaceName]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(term))
                })
                .slice(0, 160)
                .map((plugin) => (
                  <div key={plugin.pluginId} className="extension-row market-plugin">
                    <span className="extension-icon">
                      <Puzzle size={14} />
                    </span>
                    <div className="extension-copy">
                      <strong>{plugin.name}</strong>
                      <small className="market-desc">{plugin.description}</small>
                      <small>
                        {plugin.marketplaceName || 'marketplace'}
                        {plugin.installCount
                          ? ` · ${new Intl.NumberFormat('zh-CN').format(plugin.installCount)} 次安装`
                          : ''}
                      </small>
                    </div>
                    <button
                      type="button"
                      className={`mini-button ${plugin.installed ? '' : 'primary-mini'}`}
                      disabled={plugin.installed || Boolean(busyMarket) || Boolean(busyPlugin)}
                      onClick={() => void installFromMarket(plugin)}
                    >
                      {plugin.installed
                        ? '已安装'
                        : busyMarket === plugin.pluginId
                          ? '安装中…'
                          : '安装'}
                    </button>
                  </div>
                ))}
              {!marketLoading && (market?.available || []).length === 0 && (
                <p className="settings-empty">
                  市场目录为空。检查网络，或点更新市场后重试。
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'skills' && (
        <div className="extension-list">
          <div className="extension-actions">
            <button type="button" className="mini-button" onClick={() => openCreate('skill')}>
              <Plus size={13} /> 新建技能
            </button>
            <button type="button" className="mini-button" onClick={() => setTab('plugins')}>
              <Store size={13} /> 去插件市场
            </button>
            <small>技能没有独立市场；安装带技能的插件后会自动出现。</small>
          </div>
          {(snapshot?.skills || []).length === 0 && (
            <p className="settings-empty">
              还没有技能。把技能放到 ~/.claude/skills 或 .claude/skills。
            </p>
          )}
          {(snapshot?.skills || []).map((skill) => (
            <div key={skill.path} className="extension-row">
              <span className="extension-icon">
                <BookOpen size={14} />
              </span>
              <div className="extension-copy">
                <strong>{skill.name}</strong>
                <small>{skill.description || skill.path}</small>
              </div>
              <span className="extension-scope">{skill.scope}</span>
              <button
                type="button"
                className="mini-button"
                onClick={() => void openEdit(skill.path, 'skill')}
              >
                编辑
              </button>
              <button
                type="button"
                className={`mini-button ${deleteConfirm === skill.path ? 'danger-button' : ''}`}
                onClick={() => void removeExtension(skill.path)}
              >
                {deleteConfirm === skill.path ? '确认删除' : <Trash2 size={11} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'hooks' && (
        <>
          <div className="extension-actions">
            <div className="scope-switch">
              {(['user', 'project'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={hooksScope === item ? 'is-active' : ''}
                  onClick={() => setHooksScope(item)}
                >
                  {item === 'user' ? '用户设置' : '项目设置'}
                </button>
              ))}
            </div>
            <small>{hooksPath}</small>
            {home && (
              <button
                type="button"
                className="mini-button"
                onClick={() => onOpenPath(`${home}/.claude/settings.json`)}
              >
                打开用户设置
              </button>
            )}
            <button
              type="button"
              className="mini-button"
              onClick={() => onOpenPath(`${cwd}/.claude/settings.json`)}
            >
              打开项目设置
            </button>
          </div>

          <div className="extension-list">
            {(snapshot?.hooks || []).length === 0 && (
              <p className="settings-empty">还没有配置 Hooks。</p>
            )}
            {(snapshot?.hooks || []).map((hook, index) => (
              <div key={`${hook.event}-${index}`} className="extension-row hook-row">
                <span className="extension-icon">
                  <Webhook size={14} />
                </span>
                <div className="extension-copy">
                  <strong>{hook.event}</strong>
                  <small>
                    {hook.matcher ? `匹配 ${hook.matcher} · ` : ''}
                    {hook.command}
                  </small>
                </div>
                <span className="extension-scope">{hook.source}</span>
              </div>
            ))}
          </div>

          <div className="extension-editor">
            <div className="extension-editor-head">
              <strong>Hooks JSON</strong>
            </div>
            <textarea
              className="config-editor"
              spellCheck={false}
              value={hooksText}
              onChange={(event) => setHooksText(event.target.value)}
            />
            <div className="extension-editor-actions">
              <small>写入 settings.json 的 hooks 字段，新会话生效。</small>
              <button type="button" className="button primary" onClick={() => void saveHooks()}>
                <Save size={14} /> 保存 Hooks
              </button>
            </div>
          </div>
        </>
      )}

      {tab === 'agents' && (
        <div className="extension-list">
          <div className="extension-actions">
            <button type="button" className="mini-button" onClick={() => openCreate('agent')}>
              <Plus size={13} /> 新建 Agent
            </button>
            <small>保存到 ~/.claude/agents，下一会话生效。</small>
          </div>
          {(snapshot?.agents || []).map((agent) => (
            <div key={`${agent.scope}-${agent.name}`} className="extension-row">
              <span className="extension-icon">
                <Bot size={14} />
              </span>
              <div className="extension-copy">
                <strong>{agent.name}</strong>
                <small>
                  {agent.description || '未填写描述'}
                  {agent.model ? ` · ${agent.model}` : ''}
                </small>
              </div>
              <span className="extension-scope">{agent.scope}</span>
              {agent.path && (
                <>
                  <button
                    type="button"
                    className="mini-button"
                    onClick={() => void openEdit(agent.path as string, 'agent')}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className={`mini-button ${deleteConfirm === agent.path ? 'danger-button' : ''}`}
                    onClick={() => void removeExtension(agent.path as string)}
                  >
                    {deleteConfirm === agent.path ? '确认删除' : <Trash2 size={11} />}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {editor && (
        <div className="modal-backdrop" role="presentation">
          <div className="dialog extension-editor-dialog" role="dialog" aria-modal="true">
            <button
              type="button"
              className="dialog-close"
              onClick={() => setEditor(null)}
              aria-label="关闭"
            >
              <X size={16} />
            </button>
            <h2>{editor.creating ? `新建${editor.kind === 'skill' ? '技能' : ' Agent'}` : '编辑扩展'}</h2>
            {editor.creating && (
              <div className="settings-group">
                <span className="settings-label">名称</span>
                <input
                  className="text-input"
                  value={editor.name}
                  onChange={(event) =>
                    setEditor((value) =>
                      value
                        ? {
                            ...value,
                            name: event.target.value,
                            text: value.text.includes('Write the skill')
                              ? skillTemplate(event.target.value)
                              : value.text.includes('specialized assistant')
                                ? agentTemplate(event.target.value)
                                : value.text
                          }
                        : value
                    )
                  }
                />
              </div>
            )}
            <textarea
              className="config-editor extension-editor-text"
              value={editor.text}
              spellCheck={false}
              onChange={(event) =>
                setEditor((value) =>
                  value ? { ...value, text: event.target.value } : value
                )
              }
            />
            {error && <div className="settings-error">{error}</div>}
      {message && <div className="settings-message">{message}</div>}
            <div className="dialog-actions">
              <button type="button" className="button ghost" onClick={() => setEditor(null)}>
                取消
              </button>
              <button
                type="button"
                className="button primary"
                disabled={editingSaving || (editor.creating && !editor.name.trim())}
                onClick={() => void saveEditor()}
              >
                <Save size={14} /> 保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
