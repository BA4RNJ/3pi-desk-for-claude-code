# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-11-02

Initial public release.

### Added

- Electron desktop GUI for Claude Code powered by the official Claude Agent SDK.
- Workspaces, concurrent chat tabs, and per-workspace session lists.
- Inline permission, question, and plan cards above the composer (no full-screen prompts).
- In-place message editing and withdrawal for user messages: edit retracts the message into the
  composer without a dialog; withdraw asks for confirmation. Both roll the current tab back
  without opening a new tab/branch, and the old transcript is kept but hidden.
- Streaming replies, thinking blocks, tool cards, subagents, todos, checkpoints, and slash
  commands.
- Compact/detailed chat views, and a single User/All toggle with jump-to-message.
- Local background sessions and extension management (MCP, plugins/marketplace, skills, hooks,
  agents).
- Attachment support for PNG/JPEG/GIF/WebP images, PDF, and text-like files (including SVG
  source and GB18030/UTF-16/UTF-8 text), with per-file failure messages.
- Bilingual documentation (Chinese first, English second) and screenshots.
- CI: type-check, unit tests, and production build.
- AppImage and deb packaging targets.

### Changed

- Model, effort, and permission controls moved below the composer.
- Model, effort, and permission settings now persist per conversation and are inherited by new
  chats.
- Theme, language, chat view, and user/all view persist across restarts.
- The app icon and in-app brand mark were replaced.

### Fixed

- Attachment uploads silently dropping SVG and most non-image formats.
- Running indicator and stop button disappearing while the model was still streaming.
- Settings resetting after reopening a chat or the app.
- Settings dialog lag caused by software-rendered backdrop blur and synchronous i18n DOM walks.
- Packaged window/tray icon path inside `app.asar`; desktop `StartupWMClass` mismatch.

### Known limitations

- Linux only (tested on Ubuntu 24.04 / GNOME).
- Cloud sessions and Anthropic usage/limit APIs require an Anthropic account and are unavailable
  with third-party providers.
- No built-in auto-update feed.
- PDF input depends on the model/gateway.
- The global shortcut may not work on Wayland.
- The packaged app bundles Anthropic's Claude Code CLI; redistribution is subject to Anthropic's
  legal agreements (see `THIRD_PARTY_NOTICES.md`).
