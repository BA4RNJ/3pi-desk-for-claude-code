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
4. **Keep the packaged native CLI path fix.** `resolveClaudeExecutable()` in
   `src/main/session.ts` must point at `app.asar.unpacked`, and `electron-builder.yml` must keep
   `asarUnpack: node_modules/@anthropic-ai/**`. This must work on Linux and macOS; without it
   sessions fail with `spawn ENOTDIR` in both packaged builds.
5. **Do not rename the npm package `claude-desk`** without migrating the app data directory
   (`~/.config/claude-desk/` on Linux, `~/Library/Application Support/claude-desk/` on macOS;
   workspaces, preferences, API profiles, backups). Product/display name is 3PI Desk for Claude
   Code; executable is `3pi-desk`.
6. **Plugin installs must use the cancellable runner.** `runPluginCommand` spawns with
   `stdio: ['ignore','pipe','pipe']` and `--json`. Using `execFile` with open stdin can hang
   forever on CLI confirmation prompts.
7. **Never touch the user's real workspace for testing.** Use `/tmp/...` folders, and remove only
   sessions you created there.

## Current architecture in one minute

- `src/main/index.ts`: Electron lifecycle, windows/tray, all `ipcMain.handle` registration,
  `Map<tabId, SessionManager>`.
- `src/main/session.ts`: Claude Agent SDK `query()` per tab; streaming input, permissions,
  `canUseTool`, checkpoints, context usage, MCP status, effort restart.
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
- App package size is ~640 MB because it bundles the Claude Code binary.

## Verification checklist

- `npm run typecheck`
- `npx electron-vite build`
- Test a provider change and a custom model in Settings → API (model list, test connection, save).
- Launch the **packaged** binary and send one real prompt (uses API credits) to verify the asar
  path fix.
- Test permissions in a temp workspace: inline card, allow/deny/always, no full-screen backdrop.
- Test English default and 中文 toggle in Settings → General.
- Test workspace window: recent workspaces, session counts, open/add/remove.
- Test delete: confirm backup appears in `~/.config/claude-desk/session-backups/`.
- Check no stuck `claude plugin install` processes after marketplace operations.
