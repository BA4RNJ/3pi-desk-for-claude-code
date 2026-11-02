# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.2] - 2026-11-03

### Changed

- Default packages are now slim. The Claude Code CLI is no longer bundled; it is resolved at
  runtime from `CLAUDE_CODE_EXECUTABLE`, an explicit path in Settings, a previously downloaded
  copy, or a system installation (`PATH`, `~/.local/bin/claude`, the official installer's
  versions directory, Homebrew). Linux deb/AppImage drop from ~218/~273 MiB to ~97 MiB and the
  unpacked app from ~640 MB to ~275 MB.
- Settings → General now shows the Claude Code CLI path/version and offers 重新检测, 下载 CLI
  (~146 MB), and 选择已有安装. An inline banner appears when no CLI is found.
- Renderer-only dependencies moved to `devDependencies`; Chromium locales are limited to
  `en-US` and `zh-CN`; `release-wsl/` and `promo/` are excluded from packages.
- Added `electron-builder.offline.yml` plus `package:offline`, `dist:linux:offline`, and
  `dist:mac:offline` for air-gapped installs that bundle the CLI.

### Fixed

- `CLAUDE_AGENT_SDK_CLIENT_APP` and the Settings version label now use the real app version.

## [0.4.1] - 2026-11-02

### Added

- WSL2/WSLg edition: `npm run package:wsl` / `npm run dist:wsl`, a separate
  `electron-builder.wsl.yml`, a dedicated `release-wsl.yml` workflow, and `docs/WSL.md`.
- Runtime WSL detection. The WSL edition skips the system tray and global shortcut, flashes the
  Windows taskbar when a turn finishes (WSLg has no notification daemon), and opens links and
  files through the Windows default browser/application.
- CJK and emoji font recommendations for the WSL deb.
- Single-instance handling, so launching the app again focuses the existing window.
- macOS support: dmg/zip electron-builder targets, hardened-runtime entitlements, a monochrome
  template tray icon, a native application menu with standard Cmd shortcuts, Dock integration, and
  `package:mac` / `dist:mac` scripts. CI verifies the macOS build; the release workflow publishes
  an unsigned dmg/zip (the artifact name includes the runner architecture).

### Changed

- `npm run package` / `npm run dist` now build for the host platform. Explicit `package:linux`,
  `dist:linux`, `package:mac`, and `dist:mac` scripts were added.
- Hardware acceleration is disabled only on Linux; macOS keeps GPU acceleration.

### Fixed

- Closing the window with "close to tray" enabled no longer leaves a hidden, unreachable process
  when no system tray is available (WSLg, or a GNOME session without a tray extension).
- macOS: Cmd+C/V/A/Q no longer stop working, closing the last window keeps the app alive for the
  Dock/tray, and the menu-bar icon uses a correctly sized template image.

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

- Linux (tested on Ubuntu 24.04 / GNOME) and macOS. macOS CI artifacts are unsigned; build from
  source if the published architecture does not match your Mac.
- Cloud sessions and Anthropic usage/limit APIs require an Anthropic account and are unavailable
  with third-party providers.
- No built-in auto-update feed.
- PDF input depends on the model/gateway.
- The global shortcut may not work on Wayland.
- The packaged app bundles Anthropic's Claude Code CLI; redistribution is subject to Anthropic's
  legal agreements (see `THIRD_PARTY_NOTICES.md`).
