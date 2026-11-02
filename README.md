# 3PI Desk for Claude Code

[![CI](https://github.com/BA4RNJ/3pi-desk-for-claude-code/actions/workflows/ci.yml/badge.svg)](https://github.com/BA4RNJ/3pi-desk-for-claude-code/actions/workflows/ci.yml)

A local, Claude-style desktop GUI for **Claude Code**, built with Electron and the official
**Claude Agent SDK**. It is designed for people who want the power of Claude Code without living
in a terminal, with workspaces, tabs, inline approvals, file previews, extension management, and
a marketplace for Claude Code plugins.

The UI defaults to **English**; a **中文** switch is available in Settings → General.

## Project status and disclaimer

- **Why this project exists.** It is a GUI rebuilt for people who want to keep using the Claude
  Code workflow while pointing it at a **third-party, Anthropic-Messages-compatible API
  provider**. The interface, model picker, and provider presets are built around that use case.
- **Early stage.** The project is still in its initial creation and testing phase. Expect bugs,
  rough edges, and incomplete features; it will be improved incrementally. Issue reports and
  patches are welcome.
- **What runs underneath.** Sessions are executed by the official **Claude Agent SDK**, which
  bundles the Claude Code CLI. The desktop app is a UI and configuration layer; it does not
  reimplement the agent loop, so the core behaviour is the same Claude Code you already trust.
- **About API keys.** The app writes your key only to the local Claude Code configuration
  (`~/.claude/settings.json`, mode `0600`) and never sends it to the project author. The
  renderer only ever receives a masked token. If you would rather not hand your key to this
  client at all, configure the provider yourself in the Claude Code CLI (or by editing
  `~/.claude/settings.json`); the app reads that configuration and displays only a mask. See
  [`docs/SETUP.md`](docs/SETUP.md).
- **Unofficial.** This is not an Anthropic product and is not affiliated with or endorsed by
  Anthropic.

## Highlights

- **Workspaces and tabs**: chats belong to a workspace (a project folder). Recent workspaces open
  in a dedicated workspace window; multiple tabs can run independent chats at the same time.
- **Inline approvals**: permission requests, clarifying questions, and plan approval appear as a
  compact card above the composer. They never cover the screen or block the rest of the app.
- **Agent features**: streaming replies, thinking blocks, tool cards (Bash, edits, diffs,
  reads/searches, subagents, todos), file checkpoint restore, slash commands, model and effort
  selection, and context/cost estimates.
- **Extensions**: manage MCP servers, install/update/remove plugins from the official marketplace,
  manage hooks, and create or edit skills and agents.
- **Files**: a workspace file tree with text editing and image preview; tool file paths open in
  the same viewer.
- **Marketplace**: browse and search the official `claude-plugins-official` catalog, install from
  it, or add your own marketplace by `owner/repo` or Git URL. Installs can be cancelled safely.
- **Local background sessions**: start and monitor Claude Code background sessions without using a
  tab; stop, inspect logs, and remove them from the app.
- **Safety first**: deleting a chat from the UI always keeps a local backup first. The app never
  automatically deletes chats.
- **Customisation**: light/dark/system theme, accent colour, font size, compact mode, tray,
  close-to-tray, and a global shortcut.

## Requirements

- Linux. Tested on Ubuntu 24.04 with GNOME.
- The packaged build includes Electron and the Claude Code native binary; no separate Claude Code
  install is required to run it.
- Any **Anthropic Messages-compatible** API provider. Settings → API includes presets for
  OpenCode Go, Anthropic, Z.ai (GLM), Moonshot (Kimi), DeepSeek, MiniMax, and Ollama, plus a
  custom option. The default is OpenCode Go with `deepseek-v4.1-flash`. Models that the provider
  does not list can be added manually with an optional context window.
- For rebuilding: Node.js 24+ and npm 11+.

## Do I need to install Claude Code?

**No.** The packaged build and the source build both bundle the official Claude Code CLI through
the Claude Agent SDK, so a separate `claude` installation is not required:

- **Packaged app:** the CLI binary ships under
  `release/linux-unpacked/resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude`.
- **From source:** `npm install` pulls `@anthropic-ai/claude-agent-sdk` and its platform package
  (`@anthropic-ai/claude-agent-sdk-linux-x64`, ~314 MB), which contains the same binary.

If you **already have Claude Code installed**, the two coexist safely. The app deliberately uses
its own bundled CLI (it never invokes the global `claude` binary), but it shares the same
`~/.claude/` directory: settings, MCP configuration, skills, agents, hooks, and chat transcripts.
Existing chats therefore appear in the app, and API changes made in the app are visible to the
CLI as well.

See [`docs/SETUP.md`](docs/SETUP.md) for the full installation and configuration tutorial (in
Chinese), covering both user groups, manual configuration, and troubleshooting.

## Connecting a third-party API provider

Open **Settings → API**, choose a preset (or **Custom / Other**), paste the Base URL and token,
pick a model, click **Test connection**, then save. The app writes the required environment
variables to `~/.claude/settings.json` for you — no manual JSON editing is needed:

| Variable | Value |
| --- | --- |
| `ANTHROPIC_BASE_URL` | Provider API root (not `/v1/messages`) |
| `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_API_KEY` | Token; the app chooses the variable from the auth mode |
| `ANTHROPIC_MODEL` | Selected model |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` / `..._SONNET_MODEL` / `..._HAIKU_MODEL` | Same model, so built-in aliases resolve consistently |

If you prefer to manage the configuration yourself, put the same keys in the `env` block of
`~/.claude/settings.json`; the app detects them and masks the token. Environment variables
exported only from a shell profile (`.bashrc` / `.zshrc`) are **not** inherited when the app is
launched from the desktop menu, so use `~/.claude/settings.json` for configuration that both the
app and the CLI can see.

## Run

From the application menu, search for **3PI Desk for Claude Code**, or use the desktop shortcut.
You can also run:

```bash
3pi-desk
```

The installed build lives at:

```text
/path/to/3pi-desk-for-claude-code/release/linux-unpacked/3pi-desk
```

The app keeps its own preferences in `~/.config/claude-desk/` and uses the existing Claude Code
configuration and transcripts in `~/.claude/`.

## First run

1. Open **Settings → API**. Pick a provider (or **Custom / Other**), paste its key, and choose or
   type a model. **Test connection** reads the provider model list when available and verifies
   the current model; save when it succeeds. Add custom model IDs if the provider does not list
   them.
2. Click the workspace card in the sidebar to open the **Workspaces** window. Add the project
   folder you want to work in; each folder becomes a workspace and its own chat list.
3. Pick a model and an effort level in the top bar. Choose a permission mode if you do not want to
   be asked for every tool.
4. Send a message. File edits and commands will ask for approval inline above the composer.

## Permissions

The inline permission card shows the tool, a short command/path preview, and the actions:

- **Deny** / **Allow once** / **Allow for this chat**
- For clarifying questions: choose options (or type another answer) and send.
- For plans: expand the plan and **Approve and run**, or keep planning.

The app runs the local agent engine with permission prompts routed to the UI. It does not bypass
permissions unless you explicitly choose **Skip all confirmations** in the permission-mode menu.

## Workspaces and chat safety

Chats are persisted by the local agent engine as JSONL transcripts under `~/.claude/projects/`.
The app groups chats by workspace directory and never deletes a transcript automatically.

Deleting a chat from the UI:

1. asks for confirmation, then
2. copies the transcript to `~/.config/claude-desk/session-backups/`, then
3. removes the original.

**Open backup folder** in the Workspaces window opens that backup directory. To restore a chat,
copy the desired `.jsonl` file back into the matching project folder under
`~/.claude/projects/` and refresh the workspace.

## Extensions

- **MCP**: edit the user/project/local MCP configuration as JSON; servers are also listed with live
  connection state in the app.
- **Plugins**: the official marketplace is preconfigured. Search, install, update, uninstall, or
  add another marketplace. Plugin changes apply to new chats.
- **Skills**: there is no separate skills marketplace. Skills ship inside plugins, or live in
  `~/.claude/skills/<name>/SKILL.md` (user) and `.claude/skills/` (project). The Skills tab can
  create, edit, delete, and open them.
- **Hooks**: edit the `hooks` object in user or project `settings.json`.
- **Agents**: create, edit, and delete Markdown agent definitions under `~/.claude/agents/` or the
  project `.claude/agents/`.

## Background sessions

**Settings → Background** starts a background session in a workspace. The first time, the
workspace must be trusted; tick **Trust this directory** or use **Trust directory**. The app
shows running sessions, logs, and stop/remove actions. Cloud sessions require an Anthropic account
and are usually unavailable with third-party providers.

## Languages and appearance

- **Default language**: English. Switch to 中文 in **Settings → General**.
- Theme, accent colour, font size, and compact mode are also in General.
- The UI source strings are Chinese and translated at runtime by the English dictionary. Some
  dynamic messages from tools or the model may remain in their original language by design.

## Troubleshooting

- **Cannot connect / login**: open Settings → API and run **Test connection**. Make sure the Base
  URL ends at the API root (`.../anthropic`), not `/v1/messages`, and that the token belongs to the
  selected workspace.
- **DNS or proxy problems**: `api.anthropic.com` is not needed when a custom Base URL is used. If
  the provider is unreachable, check DNS/proxy settings. Many gateways are reachable directly
  without a VPN.
- **A plugin install hangs**: use **Cancel** in the marketplace banner. Installs run with stdin
  closed and can be cancelled; they are serialized.
- **Empty workspace**: click the workspace card and confirm the folder. If chats were deleted from
  the UI, look in the backup folder.
- **Window is blank after an update**: quit all running instances completely and relaunch. The
  packaged app is a native Electron build; restarting is required after an update.

## Known limitations

- Cloud sessions and Anthropic account usage/limit APIs are unavailable with third-party
  providers.
- There is no release feed for automatic app updates. Use **About → Check for updates** and the
  copyable rebuild command.
- PDF input depends on what the configured model/gateway supports.
- The global shortcut may not work under Wayland.
- English is provided by a presentation-layer translator; a few dynamic/third-party strings may
  remain untranslated.
- The packaged app is large because it includes the Claude Code native binary.

## Rebuild from source

```bash
cd /path/to/3pi-desk-for-claude-code
npm install
npm run typecheck
npm run build
npm run package
```

The unpacked build is written to `release/linux-unpacked/`. The desktop entry and `3pi-desk`
launcher point there.

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for architecture, data flow, and maintenance
details, and [AGENTS.md](AGENTS.md) for a short handoff for the next AI maintainer.

## 中文快速开始

本项目是为了**在使用第三方 API 供应商的同时，继续使用 Claude Code 框架**而重新定制的图形界面。
底层由官方 Claude Agent SDK 调用随应用打包的 Claude Code CLI，面板只负责交互与配置，不重写
Agent 循环。

> **项目状态**：目前仍处于初始创建和测试阶段，会有不少 bug 和不足之处，会逐步完善。
>
> **关于 API Key**：密钥只写入本机 `~/.claude/settings.json`（权限 `0600`），界面只拿到掩码，
> 不会发送给本项目作者。如果你不信任本客户端，可以完全不用面板填写密钥，直接在 Claude Code CLI
> 中配置；面板会读取现有配置，仅显示掩码。
>
> 本项目为非官方项目，与 Anthropic 无隶属关系。

**是否需要预装 Claude Code？不需要。** 打包版和源码版都内置了 Claude Code CLI。已经安装过
Claude Code 的用户也可以直接使用：面板不会调用全局 `claude`，但会共享 `~/.claude/` 下的配置
与聊天记录。

1. 在应用菜单搜索“3PI Desk for Claude Code”，或运行 `3pi-desk`。
2. 设置 → API：选择供应商（或“自定义 / 其他”），填入 Base URL、Token 和模型；点“测试连接”。
   供应商未列出的模型可以手动添加，并填写上下文窗口。
3. 点侧边栏工作区卡片，添加项目文件夹；每个文件夹就是一个工作区。
4. 在顶部选择模型和思考强度，发送消息。权限确认会显示在输入框上方，不再全屏遮挡。
5. 删除会话前应用会先备份到 `~/.config/claude-desk/session-backups/`，放心操作。

详细的安装方式、两类用户的接入方法、第三方 API 手动配置示例和排错说明见
[`docs/SETUP.md`](docs/SETUP.md)。
