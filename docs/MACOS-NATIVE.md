# macOS ARM64 native frontend

The Native SwiftUI channel is maintained alongside Electron. SwiftUI/AppKit provides the macOS
frontend while the local Node bridge reuses existing TypeScript business services and Claude Agent
SDK. Its numeric version line is `0.1.<electron-minor>.<native-patch>`; the current Native
version is `0.1.4.1` alongside Electron `0.4.2`.

See [MACOS-UI-PARITY.md](MACOS-UI-PARITY.md) for the source-to-native interface inventory, remaining
differences and validation boundaries. The target layout follows the original frontend rather
than adopting a different native design.

## Build and preview

Requirements: an Apple Silicon Mac, Node 24+, npm dependencies, and Swift/macOS SDK.

```sh
npm ci --cache .cache/npm
npm run typecheck
npm test
scripts/native/test-transcript.sh
scripts/native/package-standalone.sh
```

The output is `release/native-arm64/3PI Desk Native.app`. The script downloads official ARM64
Node 24.11.0, checks its archive against the vendor SHA256 list, builds optimized Swift code and
bundles Node, the SDK and ARM64 Claude CLI. Runtime does not require Homebrew or this checkout.
Node's license and repository third-party notices are included. The local app is about 414 MiB.
All downloads, build caches and outputs stay in `.cache/` or `release/` and are ignored by Git.

On this machine Command Line Tools' default Swift build system fails on duplicate platform specs.
The scripts use `--build-system native`, project-local module caches and `--disable-sandbox` to
work around nested sandbox limitations. XCTest is unavailable without full Xcode. The scripts
exercise the pure Swift reducer separately; they do not replace actual UI or SDK testing.

The earlier `scripts/native/package-local-preview.sh` makes a developer wrapper which depends
on local Node and checkout paths. Use the standalone script for the current preview.

## Backend reuse

`packages/agent-bridge/services.ts` dispatches the same settings, models, files, extensions and
background operations as Electron. `native-platform.ts` supplies only the user-data/version path
adapter; Swift owns native dialogs. A build-only resolver replaces the Electron import, so no
Electron runtime is bundled or loaded. Existing Electron source paths are unchanged.

The shim only provides `app.getPath/getAppPath/getVersion`. Shared modules must not import
`BrowserWindow`, `net`, `dialog`, or other Electron-only APIs. `src/main/claude-cli.ts` keeps
status pushes behind `subscribeClaudeCliStatus`; Electron wires it to windows in `index.ts`.

Versioned JSON Lines on stdin/stdout carries request IDs, per-tab IDs, responses and events.
Diagnostics must stay on stderr. Sessions start lazily, ordinary commands are serialized per tab,
and plugin cancellation uses a separate queue. Each tab currently owns a separate helper;
sharing one helper and proving crash recovery remain future work.

The native preview reads/writes the same Claude configuration and app preferences as Electron:
`~/.claude/settings.json`, Claude transcripts and macOS `~/Library/Application Support/claude-desk`.
Appearance/language are stored in native application defaults. Settings writes happen on explicit
Save or user actions; theme/language preview updates immediately. Do not run concurrent settings
writes from both applications. API testing and sending messages may make real network requests
and consume provider credits. Transcript deletion backs up first and fails closed without a file.

## Verification

`npm test` builds the adapter and tests it using temporary HOME/configuration/app-data/workspace
paths. It verifies settings compatibility, token masking, file boundaries and invalid deletion
IDs without calling providers or deleting real chats. `test-transcript.sh` checks text frame
merging, tool results, thinking and transcript IDs. `localization-check.swift` checks packaged
English/Chinese bundle lookup. Package handshake and bundled CLI `--version` were verified.

Actual GUI checks covered the main layout, tabs, quick prompts, settings general/API/permissions,
MCP, skills and opening/cancelling an extension editor. Additional checks and remaining gaps are
recorded in the parity inventory. Live API calls, installed-plugin mutations, file rewind,
background execution, full lifecycle recovery and every modal state have not been validated.
