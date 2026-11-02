# Contributing

Thanks for taking the time to improve 3PI Desk for Claude Code. The project is in an early stage;
small, focused changes with a clear reproduction are the easiest to review.

## Before you start

- Read [`AGENTS.md`](AGENTS.md) and [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).
- For security issues, **do not open a public issue**. Follow [`SECURITY.md`](SECURITY.md).
- By contributing, you agree that your contribution is licensed under this repository's MIT
  License.
- The Claude Agent SDK and Claude Code CLI are Anthropic's proprietary components and are not
  covered by this project's license. Do not vendor or redistribute their binaries in a pull
  request.

## Development setup

Requirements: Linux or macOS, Node.js 24+, npm 11+.

```bash
git clone https://github.com/BA4RNJ/3pi-desk-for-claude-code.git
cd 3pi-desk-for-claude-code
npm ci
npm run dev
```

Useful commands:

```bash
npm run typecheck
npm test
npx electron-vite build
npm run package       # host platform: linux-unpacked or mac-<arch>/*.app
npm run package:mac   # explicit macOS dir build (run on macOS)
npm run dist:linux    # AppImage + deb
npm run dist:mac      # dmg + zip (unsigned)
```

`npm ci` downloads Electron and the Claude Agent SDK platform package for the current platform
(about 314 MB).

## Ground rules

1. **Never delete user chats automatically.** Do not add cleanup that removes sessions or
   `~/.claude/projects/**`. UI deletion must keep the existing backup-then-delete flow.
2. **Agent prompts stay inline.** Permission, question, and plan cards live above the composer;
   do not reintroduce full-screen modal backdrops for `canUseTool`.
3. **English is the default UI language.** UI source strings are Chinese; add dictionary entries
   in `src/renderer/src/i18n.ts` for new strings and test the 中文 toggle.
4. **Keep the packaged CLI path fix.** `resolveClaudeExecutable()` must resolve
   `app.asar.unpacked`, and `electron-builder.yml` must keep `asarUnpack:
   node_modules/@anthropic-ai/**`.
5. **Do not rename the npm package `claude-desk`** without migrating `~/.config/claude-desk/`.
6. **Plugin installs use the cancellable runner** (`runPluginCommand`, closed stdin, `--json`).
7. **Never test against the user's real workspace.** Use `/tmp/...` folders and remove only
   sessions you created there. Real smoke scripts call paid APIs.
8. **No secrets in commits.** API keys, tokens, `.env` files, and private paths must not be
   committed. Report accidental exposure privately.

## Pull requests

- Keep the change focused and explain the problem and the fix.
- Include reproduction steps for bug fixes and screenshots for UI changes.
- Run `npm run typecheck`, `npm test`, and `npx electron-vite build` before opening the PR.
- If you change IPC, keep `src/preload/index.ts`, `src/shared/types.ts`, and the main handlers in
  sync.
- Update `README.md` / `docs/DEVELOPMENT.md` when behavior or setup changes.
- Do not include built artifacts (`out/`, `release/`) or `node_modules/`.
