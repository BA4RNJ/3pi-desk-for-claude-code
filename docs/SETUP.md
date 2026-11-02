# 安装与连接 Claude Code 教程

本教程面向两类用户：

- **没有安装过 Claude Code**，只想用这个面板 + 第三方 API；
- **已经安装过 Claude Code CLI**，想继续用现有配置和聊天记录。

结论先说：**两类用户都不需要额外安装全局 `claude` 命令。** 面板自带 Claude Code CLI。

---

## 1. 面板和 Claude Code 是什么关系

```text
3PI Desk（Electron 界面）
        │
        ▼
Claude Agent SDK（官方 SDK）
        │  内置并启动
        ▼
Claude Code CLI（随应用打包的 claude 二进制）
        │
        ▼
ANTHROPIC_BASE_URL（第三方 Anthropic 兼容 API）
```

- 会话、工具调用、权限、检查点等逻辑由 **Claude Code CLI** 执行；面板只负责界面和配置。
- 关键实现：`src/main/session.ts` 的 `resolveClaudeExecutable()` 固定解析 SDK 自带的
  `@anthropic-ai/claude-agent-sdk-<platform>-<arch>/claude`，**不会**调用你系统里的全局 `claude`。
- 面板和 CLI 共享同一个 `~/.claude/` 目录：`settings.json`、`~/.claude.json`、MCP 配置、
  skills、agents、hooks，以及 `~/.claude/projects/**` 下的聊天记录。

---

## 2. 我属于哪一类用户？

| 你的情况 | 怎么做 |
| --- | --- |
| 没装过 Claude Code | 直接用打包版，或从源码构建；无需 `npm i -g @anthropic-ai/claude-code` |
| 装过 Claude Code，已在 CLI 里配好第三方 API | 直接运行；面板会读取 `~/.claude/settings.json`，聊天记录也会出现 |
| 装过 Claude Code，但只在 `.bashrc` / `.zshrc` 里 `export` 了环境变量 | 从终端启动面板，或在面板 **设置 → API** 里重新保存一次配置（推荐） |
| 想自己维护配置、不把密钥交给面板 | 手动编辑 `~/.claude/settings.json` 的 `env` 块，面板只读取并显示掩码 |
| 想从源码运行 | Node.js 24+，`npm ci`，然后 `npm run dev` 或 `npm run package` |

---

## 3. 使用打包版（推荐）

打包版位于仓库的：

```text
# Linux
release/linux-unpacked/3pi-desk

# macOS（Apple Silicon；Intel 为 release/mac/）
release/mac-arm64/3PI Desk for Claude Code.app
```

macOS 上可以直接双击 `.app`，或拖进「应用程序」。未签名构建首次打开需要右键 → 打开。

如果已经按 README 的桌面集成安装过，也可以在应用菜单搜索 **3PI Desk for Claude Code**，或直接运行：

```bash
3pi-desk
```

首次使用：

1. 打开 **设置 → API**。
2. 选择供应商预设，或选择 **自定义 / 其他**。
3. 填写：
   - **Base URL**：供应商的 Anthropic 兼容 API 根地址；
   - **Token**：你的 API Key；
   - **模型**：从列表选择，或手动输入模型 ID。
4. 点击 **测试连接**。成功后再点保存。
5. 关闭设置，点击侧边栏的工作区卡片，添加项目文件夹。
6. 选择模型和思考强度，发送消息。

验证是否正常：

- **设置 → 关于** 里应能看到 Claude Code CLI 的版本号；
- **设置 → API** 里的 Token 只显示前 8 位和后 4 位的掩码；
- 发送一条简单消息，能收到流式回复。

> 打包版不需要系统里存在 `claude` 命令，也不需要先运行 Claude Code 的登录流程。

---

## 4. 从源码运行或构建

要求：Node.js 24+、npm 11+，Linux（主要在 Ubuntu 24.04 / GNOME 验证）或 macOS。

```bash
cd /path/to/3pi-desk-for-claude-code
npm ci
npm run dev          # 开发模式

npm run typecheck
npm run build

# Linux
npm run package:linux   # 输出 release/linux-unpacked/3pi-desk
npm run dist:linux      # AppImage + deb

# macOS（必须在 Mac 上执行）
npm run package:mac     # 输出 release/mac-arm64/3PI Desk for Claude Code.app
npm run dist:mac        # dmg + zip（默认未签名）
```

`npm ci` 会自动安装：

- `@anthropic-ai/claude-agent-sdk`
- 当前平台包（约 314 MB，内含 `claude` 二进制）：
  - Linux：`@anthropic-ai/claude-agent-sdk-linux-x64`
  - Apple Silicon：`@anthropic-ai/claude-agent-sdk-darwin-arm64`
  - Intel Mac：`@anthropic-ai/claude-agent-sdk-darwin-x64`

因此源码版同样不需要全局安装 Claude Code CLI。

注意：

- macOS 构建必须在 macOS 上执行。默认不签名；分发给他人前需要 Developer ID 签名与 Apple
  公证，否则 Gatekeeper 会阻止首次打开（本机右键 → 打开可绕过）。
- 如果打包后出现 `spawn ENOTDIR`，说明 `asarUnpack` 或 `resolveClaudeExecutable()` 的
  `app.asar.unpacked` 路径修复被破坏了，请保留现有实现。

---

## 5. 已经安装 Claude Code CLI 的用户

可以放心直接使用，两者不会冲突：

- **不会互相覆盖二进制**：面板使用自己打包的 CLI，不修改你的全局 `claude`。
- **共享配置和聊天**：面板读取 `~/.claude/settings.json`、`~/.claude.json` 和
  `~/.claude/projects/**`，你已有的会话会出现在对应工作区。
- **版本可能不同**：面板的 CLI 版本跟随安装的 SDK；全局 `claude` 升级不会升级面板内置版本。
  需要更新时重新构建或重新安装应用。
- **认证信息**：面板从 `~/.claude/settings.json` 的 `env` 读取 `ANTHROPIC_AUTH_TOKEN` 或
  `ANTHROPIC_API_KEY`，只把掩码传给界面。

### 关于 shell 环境变量

很多第三方 API 教程会让你在 `.bashrc` / `.zshrc` 里写：

```bash
export ANTHROPIC_BASE_URL="https://example.com/anthropic"
export ANTHROPIC_AUTH_TOKEN="sk-..."
export ANTHROPIC_MODEL="some-model"
```

从桌面菜单启动的应用**通常不会继承**这些变量。推荐做法是二选一：

1. 在面板 **设置 → API** 里填一次并保存（面板会写入 `~/.claude/settings.json`）；
2. 或手动把同样的键写进 `~/.claude/settings.json` 的 `env` 块（见下一节）。

如果确实要从终端启动：

```bash
source ~/.bashrc
3pi-desk
```

### 自定义配置目录

面板支持 `CLAUDE_CONFIG_DIR` 环境变量。如果你把 Claude Code 配置放在非默认目录，启动面板时带上该变量即可。

---

## 6. 第三方 API 配置详解

### 6.1 用面板配置（推荐）

**设置 → API** 保存时，面板会合并写入 `~/.claude/settings.json` 的 `env` 块（不会删除其他配置）：

| 键 | 写入内容 |
| --- | --- |
| `ANTHROPIC_BASE_URL` | 你填写的 Base URL |
| `ANTHROPIC_AUTH_TOKEN` | Bearer 认证模式下的 Token |
| `ANTHROPIC_API_KEY` | API Key 认证模式下的 Token |
| `ANTHROPIC_MODEL` | 选中的模型 |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | 同一个模型 |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | 同一个模型 |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | 同一个模型 |

把三个默认模型都指向同一个模型，是为了避免第三方网关没有 `opus` / `sonnet` / `haiku`
对应模型时出现“模型不存在”的错误。

面板会根据供应商预设选择认证模式：

- Anthropic 官方：`ANTHROPIC_API_KEY`（`x-api-key`）；
- 大多数第三方网关：`ANTHROPIC_AUTH_TOKEN`（`Authorization: Bearer`）。

如果测试连接失败，优先检查是不是认证模式选错了。

### 6.2 Base URL 规则

Base URL 要写到 API 根，**不要**包含 `/v1/messages`：

| 供应商 | Base URL 示例 |
| --- | --- |
| OpenCode Go（默认） | `https://opencode.ai/inference/go/anthropic` |
| Anthropic | `https://api.anthropic.com` |
| Z.ai (GLM) | `https://api.z.ai/api/anthropic` |
| Moonshot (Kimi) | `https://api.moonshot.ai/anthropic` |
| DeepSeek | `https://api.deepseek.com/anthropic` |
| MiniMax | `https://api.minimax.io/anthropic` |
| Ollama（本地） | `http://localhost:11434`，且需要提供 Anthropic 兼容接口 |
| 自定义 | 你的网关地址 |

### 6.3 手动配置（不想把密钥交给面板时）

直接用编辑器修改 `~/.claude/settings.json`：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://your-gateway.example.com/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "sk-your-token",
    "ANTHROPIC_MODEL": "your-model-id",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "your-model-id",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "your-model-id",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "your-model-id"
  }
}
```

如果是 Anthropic 官方 API，把 `ANTHROPIC_AUTH_TOKEN` 换成 `ANTHROPIC_API_KEY`。

建议收紧权限：

```bash
chmod 600 ~/.claude/settings.json
```

保存后重启面板。**设置 → API** 会显示 Base URL、模型和 Token 掩码；你不需要在面板里重新输入密钥。

### 6.4 模型与上下文窗口

- 供应商能列出模型时，面板会显示模型列表；
- 供应商不列出、或列表里没有你的模型时，在 **设置 → API** 里手动添加自定义模型；
- 自定义模型可以填写 **上下文窗口**。面板会把它注入为 `CLAUDE_CODE_MAX_CONTEXT_TOKENS`，
  否则 Claude Code 对不认识的模型可能按 200k 处理；
- 切换上下文窗口不同的模型时，会话会自动重启并 `resume`，聊天记录不会丢失。

### 6.5 “测试连接”做了什么

- 尝试读取供应商的模型列表（`/v1/models` 等路径），同时尝试 Bearer 和 `x-api-key`；
- 已知供应商预设：模型列表成功即视为连接成功；
- 自定义 URL：还会额外发一个最小的 `POST /v1/messages` 探测，避免“只支持 OpenAI 格式、
  顺便列了模型”的端点被误判为可用；
- 如果供应商没有模型列表，则用当前模型做探测。

### 6.6 密钥存放位置

| 内容 | 位置 | 权限 |
| --- | --- | --- |
| Claude Code 使用的 API 配置 | `~/.claude/settings.json` | 写入时 `0600` |
| 面板保存的 API 配置档案（含 Token） | `~/.config/claude-desk/settings.json` | 写入时 `0600` |
| 删除聊天前的备份 | `~/.config/claude-desk/session-backups/` | — |

面板不会把密钥上传到作者服务器；渲染进程只收到掩码。请不要把上述文件提交到 Git。

---

## 7. 常见问题

### 401 / 403

- 认证模式不对：第三方网关通常用 `ANTHROPIC_AUTH_TOKEN`，Anthropic 官方用 `ANTHROPIC_API_KEY`；
- Token 过期、额度不足，或复制时带了空格/换行；
- 重跑 **测试连接**，看返回的具体状态码。

### 404 / 连接成功但聊天失败

- Base URL 多写了 `/v1/messages`，或少了供应商要求的路径段；
- 端点只兼容 OpenAI 格式，不兼容 Anthropic Messages API；
- 代理/DNS 问题：用 `curl` 直接访问 Base URL 验证。

### 模型不存在

- 模型 ID 与供应商列表不一致；
- 第三方网关没有 `opus` / `sonnet` / `haiku`，而某些内置流程仍在请求这些别名。面板已把三个
  默认模型变量都指向你选的模型；如果仍报错，检查 `~/.claude/settings.json` 是否被其他工具覆盖。

### 上下文长度显示只有 200k

- 该模型是自定义模型，但没有填写上下文窗口；
- 在 **设置 → API** 的自定义模型里补上正确的上下文长度，然后重新开始会话。

### 插件安装卡住

- 在插件市场的横幅上点 **取消**；
- 安装命令以关闭 stdin 的方式运行，正常情况下不会等待确认；如果系统里的 CLI 仍要求确认，
  先在终端完成一次交互，再回到面板操作。

### 窗口空白 / 更新后打不开

- 彻底退出所有面板进程后重新启动；
- 打包版是原生 Electron 构建，更新后必须重启。

### 其他已知限制

- 云端会话和 Anthropic 账号用量接口需要 Anthropic 账号，第三方供应商下不可用；
- 全局快捷键在 Wayland 下可能无效；
- PDF 输入取决于模型/网关是否支持；
- 英文界面由运行时翻译提供，少量动态文本可能仍是中文。

---

## 8. 验证清单

- [ ] **设置 → 关于** 显示 Claude Code CLI 版本号，而不是 `not found`；
- [ ] **设置 → API** 显示 Base URL、模型和 Token 掩码；
- [ ] **测试连接** 成功；
- [ ] 发送一条消息能收到流式回复；
- [ ] 权限请求显示在输入框上方，没有全屏遮罩；
- [ ] 重启应用后，工作区和聊天列表仍在；
- [ ] 删除聊天后，`~/.config/claude-desk/session-backups/` 出现备份。

---

## 9. 回滚与卸载

面板数据：

```bash
rm -rf ~/.config/claude-desk
```

桌面集成（如果安装过）：

```bash
rm -f ~/.local/share/applications/3pi-desk.desktop
rm -f ~/桌面/3pi-desk.desktop
rm -f ~/.local/share/icons/hicolor/512x512/apps/3pi-desk.png
rm -f ~/.local/bin/3pi-desk
update-desktop-database ~/.local/share/applications
gtk-update-icon-cache -f -t ~/.local/share/icons/hicolor
```

**不要**删除 `~/.claude/`，除非你确定要删除 Claude Code 的配置和全部聊天记录。面板本身不会自动
删除聊天；通过 UI 删除时会先备份到 `~/.config/claude-desk/session-backups/`。

---

# English

This tutorial covers two groups of users:

- **Users who have never installed Claude Code** and only want this panel plus a third-party API.
- **Users who already have the Claude Code CLI** and want to keep their configuration and chats.

Short version: **neither group needs to install a global `claude` command.** The panel bundles
the Claude Code CLI.

## 1. How the panel relates to Claude Code

```text
3PI Desk (Electron UI)
        │
        ▼
Claude Agent SDK (official SDK)
        │  bundles and starts
        ▼
Claude Code CLI (the claude binary shipped with the app)
        │
        ▼
ANTHROPIC_BASE_URL (third-party Anthropic-compatible API)
```

- Sessions, tool calls, permissions, and checkpoints are executed by the **Claude Code CLI**; the
  panel only provides the UI and configuration.
- `resolveClaudeExecutable()` in `src/main/session.ts` resolves the SDK's own
  `@anthropic-ai/claude-agent-sdk-<platform>-<arch>/claude` binary and **never** invokes a global
  `claude` command.
- The panel and the CLI share `~/.claude/`: `settings.json`, `~/.claude.json`, MCP configuration,
  skills, agents, hooks, and the chat transcripts under `~/.claude/projects/**`.

## 2. Which user are you?

| Your situation | What to do |
| --- | --- |
| Never installed Claude Code | Use the packaged build or build from source; no `npm i -g @anthropic-ai/claude-code` required |
| Installed Claude Code and configured a third-party API in the CLI | Run the app; it reads `~/.claude/settings.json` and shows your existing chats |
| Installed Claude Code but only exported variables in `.bashrc` / `.zshrc` | Launch from a terminal, or save the configuration once in Settings → API (recommended) |
| Want to keep keys outside the panel | Edit the `env` block of `~/.claude/settings.json`; the panel reads it and shows only a mask |
| Want to build from source | Node.js 24+, `npm ci`, then `npm run dev` or `npm run package` |

## 3. Packaged app (recommended)

The unpacked build is at:

```text
# Linux
release/linux-unpacked/3pi-desk

# macOS (Apple Silicon; use release/mac/ on Intel)
release/mac-arm64/3PI Desk for Claude Code.app
```

On macOS, double-click the `.app` or drag it into Applications. Unsigned builds need
right-click → Open on first launch.

If desktop integration is installed, search for **3PI Desk for Claude Code** in the application
menu, or run:

```bash
3pi-desk
```

First run:

1. Open **Settings → API**.
2. Choose a provider preset, or **Custom / Other**.
3. Enter the **Base URL**, **Token**, and **model**.
4. Click **Test & fetch models**. Save after it succeeds.
5. Close Settings, click the workspace card, and add a project folder.
6. Pick a model and effort level below the composer, then send a message.

Verification:

- **Settings → About** shows the Claude Code CLI version, not `not found`.
- **Settings → API** shows the Base URL, model, and a masked token.
- A simple message receives a streaming reply.

> The packaged app does not need a global `claude` command or a prior Claude Code login.

## 4. Run or build from source

Requirements: Node.js 24+, npm 11+, Linux (Ubuntu 24.04 / GNOME is the main tested environment)
or macOS (Apple Silicon / Intel).

```bash
cd /path/to/3pi-desk-for-claude-code
npm ci
npm run dev          # development

npm run typecheck
npm run build

# Linux
npm run package:linux   # outputs release/linux-unpacked/3pi-desk
npm run dist:linux      # AppImage + deb

# macOS (must run on macOS)
npm run package:mac     # outputs release/mac-arm64/3PI Desk for Claude Code.app
npm run dist:mac        # dmg + zip (unsigned by default)
```

`npm ci` installs:

- `@anthropic-ai/claude-agent-sdk`
- the platform package for the current host (~314 MB, containing `claude`):
  - Linux: `@anthropic-ai/claude-agent-sdk-linux-x64`
  - Apple Silicon: `@anthropic-ai/claude-agent-sdk-darwin-arm64`
  - Intel Mac: `@anthropic-ai/claude-agent-sdk-darwin-x64`

The source build therefore also does not need a global Claude Code CLI.

Notes:

- macOS builds must run on macOS. They are unsigned by default; configure a Developer ID
  certificate and Apple notarization before distributing, otherwise Gatekeeper blocks the first
  launch (right-click → Open bypasses this locally).
- If the packaged app fails with `spawn ENOTDIR`, the `asarUnpack` setting or the
  `app.asar.unpacked` path fix in `resolveClaudeExecutable()` is broken. Keep both.

## 5. Already installed Claude Code CLI

The two installations coexist safely:

- **No binary conflict**: the panel uses its own bundled CLI and does not modify the global
  `claude`.
- **Shared configuration and chats**: the panel reads `~/.claude/settings.json`, `~/.claude.json`,
  and `~/.claude/projects/**`; existing sessions appear in the matching workspace.
- **Versions may differ**: the panel's CLI version follows its SDK. Upgrading the global `claude`
  does not upgrade the bundled one; rebuild or reinstall the app to update it.
- **Credentials**: the panel reads `ANTHROPIC_AUTH_TOKEN` or `ANTHROPIC_API_KEY` from the `env`
  block of `~/.claude/settings.json` and only sends a mask to the UI.

### Shell environment variables

Many third-party API guides tell you to put this in `.bashrc` / `.zshrc`:

```bash
export ANTHROPIC_BASE_URL="https://example.com/anthropic"
export ANTHROPIC_AUTH_TOKEN="sk-..."
export ANTHROPIC_MODEL="some-model"
```

An app launched from the desktop menu usually **does not inherit** these variables. Choose one:

1. Enter the configuration once in **Settings → API** (the panel writes `~/.claude/settings.json`);
2. Or write the same keys into the `env` block of `~/.claude/settings.json` (see below).

To launch from a terminal instead:

```bash
source ~/.bashrc
3pi-desk
```

### Custom config directory

The panel honors `CLAUDE_CONFIG_DIR`. If your Claude Code configuration lives elsewhere, start the
app with that variable set.

## 6. Third-party API configuration

### 6.1 Panel-managed configuration (recommended)

When you save in **Settings → API**, the panel merges these keys into the `env` block of
`~/.claude/settings.json` without deleting other settings:

| Key | Value |
| --- | --- |
| `ANTHROPIC_BASE_URL` | The Base URL you entered |
| `ANTHROPIC_AUTH_TOKEN` | Token in Bearer mode |
| `ANTHROPIC_API_KEY` | Token in API-key mode |
| `ANTHROPIC_MODEL` | The selected model |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | The same model |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | The same model |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | The same model |

Pointing all three default-model aliases at the same model prevents “model not found” errors on
gateways that do not provide `opus` / `sonnet` / `haiku` equivalents.

The panel selects the auth mode from the provider preset:

- Anthropic official: `ANTHROPIC_API_KEY` (`x-api-key`).
- Most third-party gateways: `ANTHROPIC_AUTH_TOKEN` (`Authorization: Bearer`).

If the connection test fails, check the auth mode first.

### 6.2 Base URL rules

Use the API root, **not** `/v1/messages`:

| Provider | Example Base URL |
| --- | --- |
| OpenCode Go (default) | `https://opencode.ai/inference/go/anthropic` |
| Anthropic | `https://api.anthropic.com` |
| Z.ai (GLM) | `https://api.z.ai/api/anthropic` |
| Moonshot (Kimi) | `https://api.moonshot.ai/anthropic` |
| DeepSeek | `https://api.deepseek.com/anthropic` |
| MiniMax | `https://api.minimax.io/anthropic` |
| Ollama (local) | `http://localhost:11434`, with an Anthropic-compatible endpoint |
| Custom | Your gateway address |

### 6.3 Manual configuration (keeping the key outside the panel)

Edit `~/.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://your-gateway.example.com/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "sk-your-token",
    "ANTHROPIC_MODEL": "your-model-id",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "your-model-id",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "your-model-id",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "your-model-id"
  }
}
```

For the Anthropic official API, replace `ANTHROPIC_AUTH_TOKEN` with `ANTHROPIC_API_KEY`.

Restrict permissions:

```bash
chmod 600 ~/.claude/settings.json
```

Restart the panel. **Settings → API** shows the Base URL, model, and token mask; you do not need to
re-enter the key in the panel.

### 6.4 Models and context window

- If the provider lists models, the panel shows them.
- If it does not, add a custom model under **Settings → API**.
- A custom model can include a **context window**. The panel injects it as
  `CLAUDE_CODE_MAX_CONTEXT_TOKENS`; otherwise Claude Code may assume 200k for unknown models.
- Switching to a model with a different context window restarts the session with `resume`; the
  transcript is preserved.

### 6.5 What the connection test does

- Reads the provider model list (`/v1/models` and alternatives), trying both Bearer and
  `x-api-key`.
- Known provider presets: a successful model list is treated as connected.
- Custom URLs: additionally sends a minimal `POST /v1/messages` probe, so an OpenAI-only endpoint
  that happens to list models is not reported as connected.
- If there is no model list, it probes with the current model.

### 6.6 Where keys are stored

| Content | Location | Permissions |
| --- | --- | --- |
| API configuration used by Claude Code | `~/.claude/settings.json` | `0600` on write |
| Panel API profiles (including tokens) | `~/.config/claude-desk/settings.json` | `0600` on write |
| Chat deletion backups | `~/.config/claude-desk/session-backups/` | — |

The panel does not upload keys to the author; the renderer only receives a mask. Do not commit
these files to Git.

## 7. FAQ

### 401 / 403

- Wrong auth mode: most gateways use `ANTHROPIC_AUTH_TOKEN`, Anthropic official uses
  `ANTHROPIC_API_KEY`.
- Expired token, exhausted quota, or copied whitespace/newlines.
- Run **Test connection** again and check the status code.

### 404 / connection works but chat fails

- Base URL includes `/v1/messages`, or is missing a provider path segment.
- The endpoint only supports OpenAI format, not the Anthropic Messages API.
- Proxy/DNS issue: verify the Base URL with `curl`.

### Model not found

- The model ID does not match the provider list.
- The gateway lacks `opus` / `sonnet` / `haiku`, while an internal flow still requests an alias.
  The panel points all three default-model variables at your model; if it still fails, check
  whether another tool overwrote `~/.claude/settings.json`.

### Context window shows only 200k

- The model is custom and has no context window set.
- Add the correct context length under custom models in **Settings → API**, then start a new
  session.

### Plugin install hangs

- Click **Cancel** in the marketplace banner.
- Installs run with stdin closed; if the system CLI still waits for confirmation, complete one
  interactive run in a terminal and retry from the panel.

### Blank window / app does not open after an update

- Quit every running instance and relaunch.
- The packaged app is a native Electron build and must be restarted after an update.

### Other limitations

- Cloud sessions and Anthropic usage/limit APIs require an Anthropic account and are unavailable
  with third-party providers.
- The global shortcut may not work under Wayland.
- PDF input depends on the model/gateway.
- Some dynamic text may remain Chinese when English is selected (runtime translator).

## 8. Verification checklist

- [ ] **Settings → About** shows a Claude Code CLI version, not `not found`.
- [ ] **Settings → API** shows the Base URL, model, and token mask.
- [ ] **Test connection** succeeds.
- [ ] A message receives a streaming reply.
- [ ] Permission requests appear above the composer, not as a full-screen overlay.
- [ ] Workspaces and chats are still present after a restart.
- [ ] Deleting a chat creates a backup in `~/.config/claude-desk/session-backups/`.

## 9. Rollback and uninstall

Panel data:

```bash
rm -rf ~/.config/claude-desk
```

Desktop integration (if installed):

```bash
rm -f ~/.local/share/applications/3pi-desk.desktop
rm -f ~/桌面/3pi-desk.desktop
rm -f ~/.local/share/icons/hicolor/512x512/apps/3pi-desk.png
rm -f ~/.local/bin/3pi-desk
update-desktop-database ~/.local/share/applications
gtk-update-icon-cache -f -t ~/.local/share/icons/hicolor
```

**Do not** delete `~/.claude/` unless you intend to delete Claude Code's configuration and all
chat history. The panel never deletes chats automatically; UI deletion backs up to
`~/.config/claude-desk/session-backups/` first.
