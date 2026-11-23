# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- In-chat search (`Ctrl/Cmd + F`) with match highlighting and next/previous navigation, plus a
  prompt timeline that jumps to any earlier question without leaving the chat.
- File panel **Git changes** tab: branch name, uncommitted files with status and line counts,
  per-file Git diff preview, and one-click “review changes” / “generate commit message” prompts.
- Rewind dialog expands each affected file into a before/after diff before restoring the
  checkpoint.
- Remote access QR pairing: the settings panel renders a QR code for LAN and tunnel URLs; scanning
  it logs in with a single-use five-minute pairing token (the code is stripped from the URL after
  use). Permission and question prompts now raise a browser/system notification and vibrate on
  mobile when the owning tab is not focused.
- Cloudflare Tunnel auto-reconnect with exponential backoff when `cloudflared` exits unexpectedly.
- One-click API profile failover: when a turn fails and several profiles are saved, the error
  banner switches profiles and resends the last message.
- Local usage history: each completed turn is tallied by day, model, and project (30 days kept
  locally); Settings → Usage shows today/7-day totals, daily rows, and model/project rankings.
- About now checks the latest GitHub Release alongside the SDK version and links to the release
  page.
- macOS native composer: slash-command and `@` file suggestions can be navigated with the arrow
  keys, accepted with Tab/Enter, dismissed with Esc, and scroll the selection into view.
- Project-directory home with project search, a per-project page with a composer and
  model/effort/permission/web-search controls at the top and searchable chat history below, and
  independent unsent drafts for every chat and project. Explicit home buttons in the sidebar and
  top bar.
- Copy/move a chat to another workspace. Move hides the original from the list but keeps its
  transcript on disk; copy creates an independent session.
- Relocate a project whose folder was renamed or moved. The project page detects the missing path
  and offers 重新定位文件夹; old transcripts are copied to the new location with `cwd` rewritten
  (originals are kept), and recent projects are updated. Starting or resuming a chat in a missing
  folder now reports an actionable error instead of hanging on an opaque spawn failure.
- Live AI work timer in the top bar, accumulated per chat.
- Live output speed (`tok/s`) in the top bar next to the token totals, context usage, and work
  timer. It is estimated from streaming deltas and calibrated against exact output-token counts.
- Warm khaki, monochrome, blue, and green palettes plus a custom accent colour picker. The
  monochrome/blue/green palettes keep white (or dark neutral) surfaces and tint only controls.
  The Settings window is fully opaque with a fixed top bar for close/save.
- Web-search toggle next to the model/effort/permission controls.
- Subscription/account profiles: save multiple plans or tokens, switch from the model picker's
  independent **API configuration / subscriptions** box (models are in a separate box below), and
  manage/update/delete them in Settings → API. The API page now defaults to a clean list; the full
  form opens only via **Add configuration**/**Edit**, and its single **Save configuration** action
  creates or updates the profile and sets it active. New subscriptions appear immediately and can
  be saved without typing a name.
- Cross-workspace copy helpers and session-copy tests.
- Bing and Baidu as no-key web-search providers for networks where DuckDuckGo is unreachable.
- `/help` is answered locally with the full slash-command list instead of being forwarded to the
  headless Claude Code CLI, which rejects the terminal-only command.

### Changed

- Long transcripts use `content-visibility` per message so switching tabs and streaming stays
  cheap; message heights are preserved with intrinsic sizing.
- The renderer exposes a render-time `t()` helper so new high-frequency UI strings can be
  translated without waiting for the DOM observer.
- `useDesk` helpers (tab helpers, appearance effects) moved into dedicated modules; the public
  `DeskController` surface is unchanged.
- AskUserQuestion, permission, and plan prompts are bound to their own chat tab. A background
  question no longer appears over another conversation; its tab pulses with the accent colour and
  the owning transcript receives an attention-style system notice. The inline question card also
  flashes when it appears.
- Edit/withdraw keeps the original visible chat title; the hidden fallback transcript no longer
  surfaces as `(fork)`.
- Model catalog discovery no longer blocks the project home at startup.
- Compact/detailed and User/All switching preserve scroll position instead of jumping to the top
  of a long transcript.
- Composer text and the AI work timer are kept local to their components, avoiding app-wide
  re-renders on every keystroke and timer tick.
- Message rendering is memoized by a revision counter, so streaming one reply no longer
  re-renders every earlier markdown/tool card in a long transcript.
- The slash-command menu now lists every available command instead of the first eight, scrolls
  the keyboard selection into view automatically, and opens below the composer on the project
  page so the list is not clipped by the top of the window.

## [0.4.3] - 2026-11-03

### Changed

- Unified the version line: Electron (Linux/WSL) and the native macOS SwiftUI build now share one
  three-part version and one GitHub Release. macOS ships as
  `3pi-desk-<version>-macos-arm64.zip`; Linux and WSL keep `linux` / `wsl` in their filenames.
- `release.yml` now builds Linux, WSL, and the native macOS app in one workflow and attaches
  `SHA256SUMS-linux`, `SHA256SUMS-wsl`, and `SHA256SUMS-macos` to the same draft release. The
  separate four-part native tag workflow was removed.
- The native app's `Info.plist` and bridge version are derived from the release tag.
- macOS Electron verification in `ci.yml` is opt-in via `ENABLE_MACOS_CI`, and main-branch pushes
  no longer cancel each other.
- Removed the paused Gitee mirror from user-facing documentation; its workflow is manual-only.

## [0.4.2] - 2026-11-03

### Added

- Experimental macOS ARM64 native SwiftUI frontend (`apps/macos`) with a local Node agent bridge
  (`packages/agent-bridge`) that reuses the same settings, session, files, extensions, and
  background services as Electron. Native releases use four-part tags and are documented in
  [`docs/MACOS-NATIVE.md`](docs/MACOS-NATIVE.md).
- The Electron release workflow now classifies `v*` tags: three-part tags build the Electron
  packages, four-part tags are ignored by that workflow.

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
