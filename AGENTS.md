# AGENTS.md — Maintainer Handoff

You are working on **3PI Desk for Claude Code**, a local Electron GUI for Claude Code at:

```
/path/to/3pi-desk-for-claude-code
```

Read [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) before changing code. It is the detailed
architecture and maintenance guide. This file is the short, non-negotiable checklist.

## Commands

```bash
cd /path/to/3pi-desk-for-claude-code

npm run typecheck
npx electron-vite build
npm run package                 # host platform -> release/linux-unpacked or release/mac-<arch>/*.app
npm run package:mac             # explicit macOS dir build (run on macOS)
npm run dist:mac                # dmg + zip (unsigned)
npm run package:offline         # slim build + bundled Claude Code CLI (air-gapped)
npm run dist:linux:offline      # offline Linux AppImage + deb
npm run dist:mac:offline        # offline macOS dmg + zip
node scripts/smoke-packaged.mjs # auto-detects Linux/macOS output; real API call; use with care
```

The project path contains spaces. Always quote it in shell commands.

## Non-negotiable rules

1. **Never delete user chats automatically.** Do not add cleanup that removes sessions or
   `~/.claude/projects/**`. UI deletion must use the existing backup-then-delete flow in
   `src/main/index.ts` (`findSessionTranscript` + copy to the app data directory:
   `~/.config/claude-desk/session-backups/` on Linux,
   `~/Library/Application Support/claude-desk/session-backups/` on macOS). Test only in temporary
   workspaces, and never call delete on sessions you did not create.
2. **Agent prompts are inline, never full-screen.** Permission, question, and plan prompts live in
   `PermissionBar.tsx` / `QuestionBar.tsx` above the composer. Do not reintroduce modal backdrops
   for `canUseTool` flows.
3. **Default UI language is English.** UI source strings are Chinese; `src/renderer/src/i18n.ts`
   translates them at runtime. Add dictionary entries for new strings and test the Chinese toggle.
4. **Keep the packaged native CLI path fix.** `resolveClaudeExecutable()` lives in
   `src/main/claude-cli.ts` and is re-exported by `src/main/session.ts`. It must point at
   `app.asar.unpacked`, and `electron-builder.yml` must keep
   `asarUnpack: node_modules/@anthropic-ai/**`. This must work on Linux and macOS; without it
   sessions fail with `spawn ENOTDIR` in both packaged builds. The default build excludes the
   platform CLI package and resolves it at runtime; `electron-builder.offline.yml` bundles it.
5. **Do not rename the npm package `claude-desk`** without migrating the app data directory
   (`~/.config/claude-desk/` on Linux, `~/Library/Application Support/claude-desk/` on macOS;
   workspaces, preferences, API profiles, backups). Product/display name is 3PI Desk for Claude
   Code; executable is `3pi-desk`.
6. **Plugin installs must use the cancellable runner.** `runPluginCommand` spawns with
   `stdio: ['ignore','pipe','pipe']` and `--json`. Using `execFile` with open stdin can hang
   forever on CLI confirmation prompts.
7. **Never touch the user's real workspace for testing.** Use `/tmp/...` folders, and remove only
   sessions you created there.
8. **Keep shared main services compatible with the native bridge.** `packages/agent-bridge` bundles
   `src/main/*` with `electron` replaced by `native-platform.ts`. Do not use `BrowserWindow`,
   `net`, `dialog`, or other Electron-only APIs in modules the bridge imports. `claude-cli.ts`
   only uses `app.getPath/getVersion/getAppPath` and publishes status via
   `subscribeClaudeCliStatus` (wired to windows in `index.ts`). `npm test` builds the bridge.

## Current architecture in one minute

- `src/main/index.ts`: Electron lifecycle, windows/tray, all `ipcMain.handle` registration,
  `Map<tabId, SessionManager>`.
- `src/main/session.ts`: Claude Agent SDK `query()` per tab; streaming input, permissions,
  `canUseTool`, checkpoints, context usage, MCP status, effort restart.
- `src/main/claude-cli.ts`: Claude Code CLI discovery (env → setting → bundled → downloaded →
  system), first-run download, and the status shown in Settings → General.
  `src/main/claude-cli-paths.ts` holds the pure path/version helpers.
- `src/preload/index.ts` + `src/shared/types.ts`: the `window.desk` API; keep main/renderer in sync.
- `src/shared/providers.ts`: provider presets and display names; `src/main/models.ts` handles
  catalog discovery, custom models, and connection testing.
- `src/renderer/src/hooks/useDesk.ts`: tabs, session events, permissions, workspaces, actions.
  Large but centralized — change cautiously.
- `src/renderer/src/lib/messages.ts`: SDK event -> UI messages; merges assistant frames by API
  message id (thinking + tool_use may arrive separately).
- `src/renderer/src/components/`: UI.
- `src/main/extensions.ts`: MCP/plugins/skills/hooks/agents and marketplace CLI integration.
- `src/main/background.ts`: `claude --bg` sessions (workspace trust required).
- `src/main/settings.ts`: `~/.claude/settings.json` + app preferences.
- `src/renderer/src/i18n.ts`: Chinese -> English DOM translator (default English).
- `packages/agent-bridge/`: Node JSON-Lines bridge for the native macOS frontend;
  `native-platform.ts` shims the Electron APIs the shared services need.
- `apps/macos/`: experimental native SwiftUI macOS frontend (Apple Silicon, four-part version).
  See `docs/MACOS-NATIVE.md`; UI parity is tracked in `docs/MACOS-UI-PARITY.md`.

## Important data flows

- Sessions are owned by Claude Code; transcripts live in
  `~/.claude/projects/<project>/<session-id>.jsonl`.
- Tabs are UI + one `SessionManager` each; sessions belong to the tab's cwd/workspace.
- Workspaces are recent project folders in app preferences; opening one creates a tab. The
  workspace window never deletes files or chats.
- `sessions:delete` backs up first; if the transcript cannot be found it fails closed.
- File checkpoint restore (`rewindFiles`) only restores files recorded by Claude Code; external
  side effects are not undone.
- The app reads API configuration from `~/.claude/settings.json`; the renderer only sees a masked
  token. The default provider is OpenCode Go / `deepseek-v4.1-flash`, with presets for Anthropic,
  Z.ai, Moonshot, DeepSeek, MiniMax, Ollama, and a custom Anthropic-compatible endpoint. Custom
  model IDs (and optional context windows) are stored per provider in app preferences.

## Known limitations

- Cloud sessions and Anthropic usage/limit APIs require an Anthropic account; unavailable with
  third-party providers.
- No auto-update release feed; About checks npm for the SDK and shows a rebuild command.
- English is runtime/DOM-translated; some dynamic text may remain Chinese.
- AskUserQuestion is unavailable in subagents (Claude Code limitation).
- Global shortcut may not work on Wayland; PDF support depends on the model/gateway.
- macOS builds are unsigned/unnotarized by default; CI publishes one runner architecture, so build
  from source if that does not match the target Mac.
- The slim package is ~275 MB unpacked (Electron ~260 MB + app). The Claude Code CLI is resolved
  from the user's install, a previous download, or a first-run download. The offline build
  (`npm run package:offline`) bundles the CLI and is ~640 MB.
- First-run download needs network access (~146 MB); Settings → General exposes 重新检测 /
  下载 CLI / 选择已有安装.
- The native macOS SwiftUI frontend (`apps/macos`) is experimental and Apple Silicon only; full
  UI parity is not certified (see `docs/MACOS-UI-PARITY.md`). Native releases use four-part tags
  and are built on macOS with `scripts/native/package-standalone.sh`; `release.yml` only builds
  the Electron channel.
- macOS Electron verification in `ci.yml` is opt-in (`ENABLE_MACOS_CI=true`). It is skipped by
  default because macOS arm64 runners can cancel queued jobs, which marks CI red and sends
  failure notifications. Native macOS builds use `release-native.yml`.

## Verification checklist

- `npm run typecheck`
- `npx electron-vite build`
- Test a provider change and a custom model in Settings → API (model list, test connection, save).
- Launch the **packaged** binary and send one real prompt (uses API credits) to verify the asar
  path fix.
- Check Settings → General → Claude Code CLI: a system install or downloaded copy is detected, and
  the slim build contains no `claude-agent-sdk-*` platform package. `npm run package:offline`
  must instead find the bundled CLI under `app.asar.unpacked`.
- On Apple Silicon, run `npm test`, `scripts/native/test-transcript.sh`, and
  `scripts/native/package-standalone.sh`; the native app must still find its bundled
  `claude-agent-sdk-darwin-arm64` CLI.
- Test permissions in a temp workspace: inline card, allow/deny/always, no full-screen backdrop.
- Test English default and 中文 toggle in Settings → General.
- Test workspace window: recent workspaces, session counts, open/add/remove.
- Test delete: confirm backup appears in `~/.config/claude-desk/session-backups/`.
- Check no stuck `claude plugin install` processes after marketplace operations.
