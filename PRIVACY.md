# Privacy

3PI Desk for Claude Code is a local desktop application. It does not include analytics,
telemetry, advertising, or a remote account system.

## What stays on your machine

| Data | Location |
| --- | --- |
| API provider configuration and token | `~/.claude/settings.json` (mode `0600` when written by the app) |
| App preferences, recent workspaces, per-chat settings, API profiles | `~/.config/claude-desk/settings.json` (mode `0600`) |
| Chat deletion backups | `~/.config/claude-desk/session-backups/` |
| Claude Code chat transcripts | `~/.claude/projects/<project>/<session-id>.jsonl` |

The renderer process never receives the full API token; it only receives a masked value.

## Network requests

The app makes network requests only when needed:

- To the **API provider you configure** (Base URL), to send prompts and receive model output.
- To the provider's model-list endpoint when you click **Test connection** / **Test & fetch models**.
- To `registry.npmjs.org` when you open **About → Check for updates** (reads the latest SDK version).
- To plugin marketplaces or Git repositories when you explicitly add/update a marketplace or
  install/update a plugin through the Extensions panel.

Your provider's own privacy policy applies to prompts, attachments, and responses sent to it.
The project author does not receive them.

## What the project author does not collect

- No usage analytics.
- No crash reports are sent to the author.
- No API keys, prompts, file contents, or chat transcripts are sent to the author.

## Deleting your data

- Remove app preferences and backups: delete `~/.config/claude-desk/`.
- Remove chats: use the app's delete flow (which keeps a backup first) or manage
  `~/.claude/projects/` yourself.
- Removing the app does not automatically delete `~/.claude/` or your chat history.

## Third-party services

Anthropic's Claude Agent SDK and Claude Code CLI are subject to Anthropic's legal agreements.
Third-party API providers are subject to their own terms and privacy policies.
