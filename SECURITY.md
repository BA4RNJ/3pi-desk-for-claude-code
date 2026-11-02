# Security Policy

## Supported versions

Security fixes are provided for the latest release on the `main` branch (currently the `0.4.x`
series). Older versions may not receive fixes.

## Reporting a vulnerability

Please **do not open a public issue** for a security vulnerability.

Use GitHub's private vulnerability reporting:

1. Go to the repository's **Security and quality** tab.
2. Click **Report a vulnerability**.
3. Include affected version, operating system, reproduction steps, and impact.

If private reporting is unavailable, contact the maintainer through GitHub (`@BA4RNJ`) and ask
for a private channel.

Please include only the minimum necessary data. **Never paste API keys, tokens, full chat
transcripts, or private file contents** into a report. Redact paths and identifiers.

## Scope

In scope:

- The Electron main process, preload bridge, and renderer code in this repository.
- IPC input validation, file path restrictions, and permission handling.
- Local credential handling and token masking.
- Packaging, update, and desktop-integration behavior shipped by this project.

Out of scope (report upstream):

- Vulnerabilities in Anthropic's Claude Agent SDK or Claude Code CLI.
- Vulnerabilities in third-party API providers or model gateways.
- Issues that require an already-compromised local account or physical access.
- Social-engineering scenarios that do not involve a defect in this application.

## Security model and known risks

- The app runs Claude Code tools locally. Tool calls can read/write files and execute commands,
  subject to the permission mode you choose.
- **Skip all confirmations** (`bypassPermissions`) disables prompts. Use it only in trusted
  workspaces.
- API tokens are stored in `~/.claude/settings.json` with mode `0600`. They are not encrypted at
  rest beyond filesystem permissions.
- The renderer runs with `contextIsolation: true` and `nodeIntegration: false`. The preload
  bridge is the only IPC surface.
- Chat deletion always creates a backup first; the app does not automatically delete chats.

## Disclosure

We will acknowledge a report as soon as practical, investigate, and coordinate a fix and
disclosure timeline with the reporter. Please allow reasonable time before public disclosure.

---

## 中文说明

请通过 GitHub 仓库的 **Security and quality → Report a vulnerability** 私下报告安全问题，不要开
公开 issue。报告中不要包含 API Key、Token、完整聊天记录或私有文件内容。Anthropic SDK/CLI 或
第三方 API 供应商自身的问题请报告给对应上游。
