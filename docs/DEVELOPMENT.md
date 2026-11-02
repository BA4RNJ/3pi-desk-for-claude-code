# 3PI Desk for Claude Code — Development & Maintenance Guide

This document is the technical handoff for the next developer or AI maintainer. It describes the
architecture, the important data flows, safety rules, and the traps that have already been found
and fixed. Read this before changing code. `AGENTS.md` contains the short checklist.

## 1. Product decisions

- Desktop app for Linux (tested on Ubuntu 24.04 / GNOME).
- Electron main process + preload bridge + React renderer.
- Claude Code is driven through the **official Claude Agent SDK**, not by scraping the CLI UI.
- The app mirrors the official Claude Code CLI semantics where practical: tabs, workspaces,
  sessions, permissions, checkpoints, slash commands, MCP, plugins, hooks, skills, agents, and
  background sessions.
- **UI defaults to English**, with a Chinese switch. The source strings in components are Chinese;
  English is applied at runtime by a presentation-layer translator (see §10).
- **Chats are user data.** The app must never delete them automatically. UI deletion requires
  confirmation and creates a backup first.
- The product name is **3PI Desk for Claude Code**. The npm package name intentionally remains
  `claude-desk` so that existing app preferences (`~/.config/claude-desk/`) and user data are
  preserved.

## 2. Stack and versions (v0.4.0)

- Electron 45.2.1 (Node 24.22.x inside Electron).
- React 19, TypeScript, Vite 8, electron-vite 6.
- `@anthropic-ai/claude-agent-sdk` 0.3.316 (bundles Claude Code 2.1.316).
- `electron-builder` 26 with the locally installed Electron distribution.
- Native binary package: `@anthropic-ai/claude-agent-sdk-linux-x64`.
- markdown: react-markdown + remark-gfm + rehype-highlight.
- Icons: lucide-react.
- Scripts: Playwright Core for UI smoke tests (dev only).

## 3. Repository layout

```
3PI desk for Claude code/
  package.json                  app scripts, name stays "claude-desk"
  electron.vite.config.ts       main/preload/renderer build
  electron-builder.yml          Linux packaging, asarUnpack, productName
  build/icon.png                package icon
  resources/icon.png|svg        window/tray/desktop icon
  src/
    shared/types.ts             IPC contracts, session/model/settings types
    main/
      index.ts                  app lifecycle, windows, tray, IPC registration
      session.ts                one Claude Agent SDK session manager per tab
      settings.ts               ~/.claude/settings.json + app preferences
      models.ts                 OpenCode Go model catalog + API test
      files.ts                  file tree/read/write, attachments, screenshots
      extensions.ts             MCP/plugins/skills/hooks/agents, marketplace
      background.ts             `claude --bg` background sessions
      version.ts                app/SDK/CLI/npm version info
    preload/
      index.ts                  contextBridge API (window.desk)
      index.d.ts                Window typing
    renderer/
      index.html
      src/
        App.tsx                 layout, tabs, dialogs, composer region
        hooks/useDesk.ts        all renderer state: tabs, sessions, events
        types.ts                UI message/tab types
        lib/messages.ts         SDK event -> UI message reducer
        lib/usage.ts            token/cost estimates
        lib/export.ts           Markdown export
        lib/files.ts            browser File -> attachment conversion
        lib/format.ts           time/cost/token formatting
        i18n.ts                 Chinese -> English runtime translator
        components/             UI (see below)
  scripts/                      Playwright smoke/regression scripts (dev only)
  docs/DEVELOPMENT.md           this file
  AGENTS.md                     short AI handoff
  README.md                     user guide
```

Key components:

- `PermissionBar.tsx` — compact inline approval card for tools/plans.
- `QuestionBar.tsx` — compact inline AskUserQuestion card.
- `WorkspaceManager.tsx` — recent workspaces window.
- `TabBar.tsx` — concurrent chat tabs.
- `Sidebar.tsx` — brand, workspaces, chat search/list/menu, settings.
- `TopBar.tsx` — model, effort, permission mode, usage, tasks.
- `ChatView.tsx` / `MessageView.tsx` / `ToolCard.tsx` — transcript rendering.
- `FilePanel.tsx` / `FilePreviewDialog.tsx` — workspace file tree and editor.
- `SettingsDialog.tsx` — General/API/Permissions/Extensions/Background/Usage/About.
- `ExtensionsPanel.tsx` — MCP, plugins + marketplace, skills, hooks, agents.
- `BackgroundPanel.tsx` — local background sessions.
- `PermissionDialog.tsx` / `QuestionDialog.tsx` — legacy modal versions (no longer used for agent
  prompts; keep only if you intentionally need a blocking dialog).

## 4. Process architecture

```
Renderer (React)
  window.desk.*  (preload contextBridge)
        |  ipcRenderer.invoke / events
        v
Electron main
  Map<tabId, SessionManager>
  SessionManager -> @anthropic-ai/claude-agent-sdk query()
        |  spawns native `claude` (SDK bundle)
        v
Claude Code subprocess (stream-json)
        |  Anthropic Messages API
        v
ANTHROPIC_BASE_URL (default OpenCode Go)
```

- One `SessionManager` per tab. Managers are created lazily in `session:start`, kept in
  `main/index.ts`, and stopped on tab close. Events are tagged with `tabId` so inactive tabs keep
  streaming while the user works elsewhere.
- The renderer never talks to Anthropic directly. The API token lives in
  `~/.claude/settings.json`; the renderer only receives a masked token via Settings.
- `window.desk` is the only bridge. `contextIsolation: true`, `nodeIntegration: false`.

## 5. IPC surface

`src/preload/index.ts` is the source of truth. Channels are grouped:

- Session: `session:start`, `session:send`, `session:interrupt`, `session:stop`,
  `session:setModel`, `session:setPermissionMode`, `session:setEffort`, `session:commands`,
  `session:rewind`, `session:contextUsage`, `session:mcpStatus`, `session:toggleMcp`.
- Permissions: `permission:respond`.
- Sessions: `sessions:list`, `sessions:all`, `sessions:messages`, `sessions:rename`,
  `sessions:delete`, `sessions:tag`, `sessions:fork`.
- Files: `files:pick`, `files:search`, `files:tree`, `files:read`,
  `files:write`, `files:export`, `open:path`, `open:backupDir`.
- Settings/models: `settings:get`, `settings:saveApi`, `settings:saveApiProfile`,
  `settings:deleteApiProfile`, `settings:applyApiProfile`, `settings:savePreferences`,
  `settings:savePermissionRules`, `settings:saveCustomModel`, `settings:deleteCustomModel`,
  `models:list`, `models:test`. `models:test` returns the discovered model list and whether the
  check used the provider list or a Messages probe.
- Extensions: `extensions:list`, `extensions:mcpStatus`, `extensions:readMcp`,
  `extensions:saveMcp`, `extensions:togglePlugin`, `extensions:pluginAction`,
  `extensions:cancelPluginAction`, `extensions:marketplaces`,
  `extensions:marketplaceAdd|Update|Remove`, `extensions:readFile|writeFile|createFile|deleteFile`,
  `extensions:readHooks|saveHooks`.
- Background: `background:list`, `background:start`, `background:logs`, `background:stop`,
  `background:remove`, `background:trust`.
- App: `app:versionInfo`, `defaults:get`, `cwd:save`, `dialog:pickDirectory`.
- Main -> renderer: `session:event`, `session:state`, `permission:request`,
  `permission:cancel` (all carry `{tabId,...}`), `app:new-tab`.

`ipcMain.handle` and preload must stay in sync. A quick check:

```bash
node -e '
const fs=require("fs");const pre=fs.readFileSync("src/preload/index.ts","utf8");
const main=fs.readFileSync("src/main/index.ts","utf8");
const invoke=new Set([...pre.matchAll(/ipcRenderer\.invoke\(\s*["\x27]([^"\x27]+)/g)].map(m=>m[1]));
const handle=new Set([...main.matchAll(/ipcMain\.handle\(\s*["\x27]([^"\x27]+)/g)].map(m=>m[1]));
console.log("missing:",[...invoke].filter(x=>!handle.has(x)));
'
```

## 6. Agent SDK integration (critical)

`src/main/session.ts` is the heart. Do not casually rewrite it.

- `query({ prompt: AsyncQueue, options })` with streaming input keeps one CLI process alive per
  tab and accepts multiple turns.
- Important options:
  - `cwd`, `model`, `permissionMode`, `effort`, `resume`, `includePartialMessages: true`
  - `systemPrompt: { type: 'preset', preset: 'claude_code' }`
  - `tools: { type: 'preset', preset: 'claude_code' }`
  - `settingSources: ['user','project','local']`
  - `enableFileCheckpointing: true`
  - `canUseTool` -> permission/question/plan flow
  - `additionalDirectories`, `allowedTools`, `disallowedTools`, `maxBudgetUsd`
  - `extraArgs` for IDE/Chrome flags
  - `env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: '3pi-desk/0.4.0' }`, plus
    `CLAUDE_CODE_MAX_CONTEXT_TOKENS` from `findModelContextWindow()` in `main/models.ts`.
    Claude Code defaults to 200k for model IDs it does not recognize; the gateway catalog's
    per-model `limit.context` must be passed so DeepSeek (1M) and other gateway models use their
    real window. Do not hardcode a single window. Switching to a model with a different window
    restarts the session with `resume`; same-window switches use `query.setModel()` live.
- **Packaged binary path**: the SDK resolves its native CLI inside `app.asar`, which cannot be
  spawned (`spawn ENOTDIR`). `resolveClaudeExecutable()` replaces `app.asar` with
  `app.asar.unpacked` and is passed as `pathToClaudeCodeExecutable`. Never remove this or the
  packaged app will fail to start sessions. `electron-builder.yml` must keep
  `asarUnpack: node_modules/@anthropic-ai/**`.
- `SessionManager` state is pushed via `session:state`; raw SDK messages via `session:event`.
  The renderer reducer (`lib/messages.ts`) handles partials, full assistant frames, tool results,
  tasks, result stats, local command output, and rewind IDs.
- Effort changes restart the manager with `resume` (some models/CLIs do not support live effort).
  The renderer keeps its transcript; only the backend query is recreated.
- `rewindFiles(userMessageId)` needs `enableFileCheckpointing` and the user message UUID. The UI
  generates `turnId` on send, passes it as the SDK user message `uuid`, and stores it as
  `rewindId`. Assistant/result frames may also carry `user_message_uuid`, which is bound as a
  fallback.

## 7. Renderer state: tabs, messages, sessions

`useDesk.ts` is a large hook but intentionally centralized.

- `tabsRef: Map<tabId, TabRuntimeData>` is the mutable working state. `tabs` is a React snapshot
  published from it. Streaming events are flushed on a small timer to avoid excessive renders.
- `TabView` (renderer types): `id, cwd, title, messages, state, permissions, loadingHistory,
  sessionId, effort, tasks, usage, commands`.
- `TabRuntimeData` additionally holds `started`, `streamIds`, and runtime-only data.
- One tab may be a **new chat** (no `sessionId`) until the first send. `ensureSession` starts the
  manager with the tab's cwd/model/mode/effort; selected sessions start with `resume`.
- Sessions belong to the workspace/cwd of the tab. The sidebar lists `listSessions(cwd)` for the
  active tab. Global search calls `listAllSessions()` and opens results in a tab using the
  session's own cwd (important: pass the cwd override to `selectSession`).
- Titles: "New chat" until a user prompt exists; after a result the session summary from
  Claude Code is used. Tab/topbar titles are marked `data-i18n-skip` when they are real chat
  titles, so the translator does not rewrite user/model text.

### API providers, models, and detection

- `src/shared/providers.ts` holds the provider presets shown in Settings → API: OpenCode Go,
  Anthropic, Z.ai (GLM), Moonshot (Kimi), DeepSeek, MiniMax, Ollama (local), and Custom / Other.
  `settings.ts` stores the selected `providerId` and per-provider `customModels` in
  `~/.config/claude-desk/settings.json`.
- `testApi()` in `main/models.ts` tries `${base}/v1/models` (and alternate paths) with both
  `Authorization: Bearer` and `x-api-key` plus `anthropic-version`, preferring the configured
  `authMode` (`bearer` for most gateways, `apiKey` for Anthropic). Known presets trust a
  successful model list. Custom URLs are additionally probed with a minimal `POST /v1/messages`
  request, so an OpenAI-only endpoint that lists models is rejected instead of being reported as
  connected. If no model list exists, the probe validates the current model. The successful auth
  mode is returned to the UI and saved; `saveApiSettings()` writes either `ANTHROPIC_AUTH_TOKEN`
  or `ANTHROPIC_API_KEY` accordingly.
- Custom models are merged into `getModels()` for the active provider only. Their optional
  `contextWindow` feeds `CLAUDE_CODE_MAX_CONTEXT_TOKENS` exactly like a catalog model. Do not
  hardcode a single context window.
- If the model list cannot be fetched, non-OpenCode providers do not fall back to the bundled
  DeepSeek models; they keep the configured model and custom entries.

### Message reducer

`lib/messages.ts`:

- `applyStreamEvent` handles SSE partials by content-block index.
- `applyAssistantMessage` / `mergeAssistantEntry` merge multiple assistant frames that share the
  same API message id (Claude Code may emit thinking and tool_use frames separately). Do not
  replace the whole block list blindly or thinking/tool blocks will disappear.
- `applyEvent` handles tool results, `tool_progress`, permission denials, compaction notices, and
  result errors. It also binds `user_message_uuid` -> `rewindId`.
- Task events (`task_started/progress/notification`) are handled in `useDesk.ts`.
- History (`historyToMessages`) merges assistant entries by API message id and records
  `transcriptId` (transcript entry UUID) for branching.

### Tabs

- `addTab` / `closeTab` / `activateTab`; closing a tab stops its manager but does not delete the
  session transcript.
- New chat tabs are lazy; `selectSession` loads history before starting the resume.
- Multiple tabs run concurrently; events carry `tabId`.

## 8. Permission flow (inline, non-blocking)

- `canUseTool` in `SessionManager` sends `permission:request` with `kind`:
  - `permission` — normal tool approval
  - `question` — `AskUserQuestion`
  - `plan` — `ExitPlanMode`
- `pending` promises are resolved by `respondPermission`:
  - allow: `{behavior:'allow', updatedInput, updatedPermissions?}`
  - deny: `{behavior:'deny', message}`
  - questions: `updatedInput = { ...input, answers }` where answers map question text to a string
    or array of labels.
- The renderer shows `PermissionBar` for permission/plan and `QuestionBar` for questions **above
  the composer**, inside `.composer-region`. There is no modal backdrop for agent prompts.
- Multiple pending requests are flattened across tabs; the first is shown, with tab title and a
  "Switch" action for inactive tabs. `queued` count is passed for display.
- "Allow for this chat" uses the SDK's permission suggestions, but the destination is forced to
  `session`. The UI shows the scope text. Note: the CLI has previously persisted some suggestions
  to local settings; verify behavior if changing this logic.
- `QuestionBar` offers single/multi select, an optional custom answer, skip, and send.
- Plan approval shows the last assistant text as the plan; expandable.
- The old `PermissionDialog`/`QuestionDialog` modal components are legacy; do not reintroduce
  full-screen blocking for agent requests.

## 9. Sessions, transcripts, and data safety

Claude Code owns transcripts. The app must treat them as irreplaceable user data.

- Read: `listSessions`, `getSessionMessages` from the SDK.
- Mutate: `renameSession`, `tagSession`, `forkSession` (supports `upToMessageId`).
- Delete: `sessions:delete` in `main/index.ts`:
  1. `findSessionTranscript(sessionId)` scans `~/.claude/projects/*/<id>.jsonl`.
  2. Copies it to `~/.config/claude-desk/session-backups/<timestamp>-<id>.jsonl`.
  3. Calls `deleteSession`.
  4. Returns the backup path; the renderer shows "Chat deleted; backup saved".
  - If the transcript cannot be found, deletion fails closed and nothing is deleted.
- **Never add automatic cleanup, background purges, or "test cleanup" that deletes sessions in a
  user workspace.** This repository has already lost user data once from over-aggressive cleanup.
  Test only in temp directories and never call delete on a session you did not create.
- The Workspaces window exposes "Open backup folder". Restore manually by copying the backup
  `.jsonl` back into the project directory under `~/.claude/projects/` and refreshing.
- Checkpoints: `rewindFiles` restores files only; Bash/git/install side effects are not undone.
  The UI dialog says so.

## 10. Workspaces

- Workspaces are project folders. Recent workspaces are stored in app preferences
  (`recentWorkspaces: string[]`, max 12).
- On boot, the current cwd and home are seeded into recents; opening/creating a tab adds its cwd.
- `WorkspaceManager.tsx` lists recents with session counts and latest activity, opens a workspace
  as a new tab, adds a folder via the native picker, and removes entries from the recent list only
  (it never deletes files or chats).
- Chat lists are per active tab/workspace. There is no global "all chats" tree inside the sidebar;
  use the search field to find chats across workspaces.
- Removing a workspace from recents does not delete its Claude Code transcripts.

## 11. Files and attachments

- `files:tree` builds a bounded tree (depth 5, ~600 nodes, ignored dirs). `files:read/write` are
  restricted to paths inside the active workspace (`isInside` prefix check). Keep this restriction.
- `FilePanel` opens in a third column (`.app.has-files`). `FilePreviewDialog` edits text files and
  views images; binary files are not previewable.
- Tool file paths can open the preview via `onOpenFile` threaded through
  `ChatView -> MessageView -> ToolCard`.
- Composer attachments: images, PDF documents, and text files. `fileToAttachment` handles
  drag/drop/paste in the renderer; `files:pick` reads native files in main. PDFs are sent as
  Anthropic `document` blocks and depend on the gateway/model.
- Tool-result images are extracted in `applyUserMessage` into `ToolBlock.images` and rendered in
  `ToolCard`.

## 12. Extensions, marketplace, and background sessions

- MCP: reads `~/.claude.json` (`mcpServers`, `projects[cwd].mcpServers`) and `<cwd>/.mcp.json`.
  The editor edits only the inner server object. Saving merges back. Active session status is
  obtained from `query.mcpServerStatus()`; toggling uses `query.toggleMcpServer()`.
- Plugins: `claude plugin list --json` for installed; `claude plugin list --available --json` for
  the catalog. Do **not** use `execFile` with an open stdin for install/update/uninstall: the CLI
  can wait on a confirmation and hang forever. `extensions.ts` uses `runPluginCommand` (spawn,
  `stdio: ['ignore','pipe','pipe']`, `--json`, timeout, AbortController). Keep stdin closed.
  The UI disables all plugin actions while one is running and offers a Cancel button.
- Marketplaces: official `claude-plugins-official` is configured by Claude Code. Add/update/remove
  use `claude plugin marketplace ...`. The available catalog is large; the UI searches client-side
  and caps visible rows.
- Skills: no separate marketplace. Scan `~/.claude/skills/*/SKILL.md` and
  `<cwd>/.claude/skills/*/SKILL.md`; parse YAML frontmatter. Skills and agents can be created/
  edited/deleted in the Extensions panel (Markdown files under the allowed roots).
- Hooks: read/write the `hooks` object in user or project `settings.json`; also flatten them for
  display.
- Agents: scan `~/.claude/agents/*.md` and `<cwd>/.claude/agents/*.md`; edit raw Markdown.
- Background sessions: `claude --bg <prompt>` requires workspace trust. `background:trust` writes
  `projects[cwd].hasTrustDialogAccepted = true` in `~/.claude.json` only when the user opts in.
  `claude agents --json` is filtered to `kind === 'background'`; logs are ANSI-stripped. Cloud
  sessions remain unsupported on OpenCode Go.

## 13. i18n (English default)

This is a **runtime presentation translator**, not a compile-time i18n framework. It exists because
the source UI is Chinese and the product must default to English.

- `src/renderer/src/i18n.ts`:
  - `DICTIONARY` (Chinese -> English) and `PHRASE_RULES` (regex for times/counts).
  - `translateText` handles exact matches, dynamic counts/times, phrase replacement, and Chinese
    punctuation normalization. Technical strings (paths, URLs, model ids) are skipped.
  - `startI18n(lang)` walks `document.body`, translates text nodes and `placeholder/title/
    aria-label/alt`, and installs a `MutationObserver` for dynamic React updates. Form controls
    (`input/textarea/select`) are skipped for text content but their attributes are still
    translated, so settings placeholders and the composer placeholder follow the language.
  - Provider and model names are intentionally English; provider descriptions are translated.
    Keep UI copy provider-neutral (avoid assuming a Claude model or one gateway).
  - `setI18nLanguage(lang)` switches live; originals are kept so Chinese can be restored.
  - `initialLanguage()` defaults to `en`; saved key is `3pi-language`.
- `App.tsx` calls `startI18n` in a `useLayoutEffect` (before paint) and `setI18nLanguage` on
  language changes. `useDesk` persists the choice.
- Skip selectors in `i18n.ts` exclude model/user/tool content, code, inputs, and chat titles.
  When adding UI, use semantic Chinese source strings. Add new dictionary entries or regex rules.
  If a piece of UI must not be translated (e.g., a generated chat title), mark it with
  `data-i18n-skip`.
- Native tray menu/dialog strings are English in main; the language toggle only affects the
  renderer. If full native localization is needed, add an app-level language preference and rebuild
  the tray menu on change.
- Limitations: dynamic strings from tools/models and some compound text may remain Chinese or read
  awkwardly. A future improvement is a proper message-based i18n; keep the translator until then.

## 14. Branding, packaging, and installation

- Package `name` is still `claude-desk` on purpose, so `~/.config/claude-desk/` is reused. Changing
  it would reset the user's workspaces/preferences. Change `productName`/UI brand instead.
- `electron-builder.yml`: `productName: 3PI Desk for Claude Code`, `executableName: 3pi-desk`,
  `appId: local.3pidesk`, `electronDist: node_modules/electron/dist` (avoid network downloads),
  `asarUnpack: node_modules/@anthropic-ai/**`.
- Package output: `release/linux-unpacked/3pi-desk`.
- Desktop integration installed at:
  - `~/.local/share/applications/3pi-desk.desktop`
  - `~/桌面/3pi-desk.desktop`
  - `~/.local/share/icons/hicolor/512x512/apps/3pi-desk.png`
  - `~/.local/bin/3pi-desk`
  - The Exec path contains spaces and must stay quoted:
    `Exec="/path/to/3pi-desk-for-claude-code/release/linux-unpacked/3pi-desk"`
- The old `claude-desk` menu entry/desktop shortcut is removed; the old app files in
  `~/Applications/claude-desk` may remain as a backup.
- Ubuntu-specific: main calls `app.disableHardwareAcceleration()` and
  `app.commandLine.appendSwitch('disable-gpu-sandbox')`; without them Electron can crash on this
  machine's sandbox/GPU setup. Keep unless the environment changes.

## 15. Build, run, and test

```bash
cd /path/to/3pi-desk-for-claude-code

npm run typecheck          # main + renderer
npx electron-vite build    # output in out/
npm run dev                # electron-vite dev (if needed)
npm run package            # typecheck + build + electron-builder dir
node scripts/smoke-packaged.mjs   # launches packaged app and sends a tiny prompt (API cost!)
```

- `scripts/` contains Playwright-based smoke tests for permissions, questions, tabs, attachments,
  rewind, marketplace, backgrounds, settings, etc. They make **real API calls** and create Claude
  Code sessions. Use temporary workspaces and remove only sessions you created. Do not run them
  against the user's workspace with production chats.
- The packaged app has been smoke-tested with real OpenCode Go requests (`HTTP 200`, model
  `deepseek-v4.1-flash`).
- `npm run package` uses the local Electron binary; if Electron download fails, do not remove
  `electronDist`.
- After changing desktop integration files, run `desktop-file-validate`,
  `update-desktop-database ~/.local/share/applications`, and
  `gtk-update-icon-cache -f -t ~/.local/share/icons/hicolor`.

## 16. Data paths

| Purpose | Path |
| --- | --- |
| App preferences (cwd, theme accent, recents, profiles, providerId, custom models) | `~/.config/claude-desk/settings.json` |
| Chat deletion backups | `~/.config/claude-desk/session-backups/` |
| Claude Code user settings (API env, permissions, hooks) | `~/.claude/settings.json` |
| Claude Code global state (projects/MCP/trust) | `~/.claude.json` |
| Claude Code transcripts | `~/.claude/projects/<project>/<session-id>.jsonl` |
| User skills | `~/.claude/skills/<name>/SKILL.md` |
| User agents | `~/.claude/agents/<name>.md` |
| Plugin marketplaces | `~/.claude/plugins/marketplaces/` |
| Background session trust | `~/.claude.json` -> `projects[cwd].hasTrustDialogAccepted` |

## 17. Known limitations / next steps

- Cloud sessions and Anthropic account usage/limits require an Anthropic account; unavailable
  with third-party providers.
- No release feed for auto-update; About only checks npm for the SDK version and shows the rebuild
  command.
- The i18n translator is runtime/DOM-based. Some dynamic or third-party text may remain Chinese.
  Consider migrating to message-based i18n later.
- AskUserQuestion is not available inside subagents (Claude Code limitation).
- Global shortcut may not register on Wayland.
- PDF support depends on the configured model/gateway.
- The app is ~640 MB unpacked because it bundles the Claude Code native binary.
- Future work: cloud/API usage limits, proper i18n, auto-update feed, richer diff editor, more
  marketplace metadata, and an automated restore UI for backups.

## 18. Change checklist

Before committing/changing:

1. Run `npm run typecheck` and `npx electron-vite build`.
2. If touching IPC, run the missing-handler check and update preload/shared types.
3. If touching SDK spawn/packaging, check `pathToClaudeCodeExecutable`, `asarUnpack`, and test the
   **packaged** app (not just dev).
4. If touching permissions/questions/plan, verify no full-screen backdrop is used and both
   allow/deny/always paths work.
5. If touching delete/session cleanup, never delete user data without a backup; test only in temp
   directories.
6. If adding UI strings, add English dictionary entries and test both English and Chinese.
7. Rebuild the package and update the desktop entry/symlink if the binary path changed.
