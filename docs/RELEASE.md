# Release Process

This document describes how to publish a new 3PI Desk for Claude Code release.

## One-time repository settings

In **Settings → General**:

- Description: `3PI Desk for Claude Code — a local Electron GUI for Claude Code powered by the Claude Agent SDK`
- Topics: `electron`, `claude-code`, `claude-agent-sdk`, `desktop-app`, `linux`, `gui`,
  `ai-coding`, `third-party-api`, `react`, `typescript`
- Social preview: upload [`docs/social-preview.png`](social-preview.png).

In **Settings → Security and quality**:

- Enable **Private vulnerability reporting**.
- Enable **Secret scanning** and **Push protection**.
- Enable **Dependabot alerts** and **Dependabot security updates**.
- CodeQL runs from `.github/workflows/codeql.yml`.

In **Settings → Branches** (or Rulesets):

- Protect `main`.
- Require the **Verify** status check.
- Block force pushes and deletions.
- Allow administrators to bypass in an emergency.

## Before tagging

1. Update the version in `package.json`.
2. Update `CHANGELOG.md`.
3. Run:

   ```bash
   npm ci
   npm run typecheck
   npm test
   npx electron-vite build
   npm run dist:linux   # on Linux
   npm run dist:mac     # on macOS (unsigned unless signing secrets are configured)
   ```

4. Verify the packages launch from a clean environment:
   - AppImage: `chmod +x 3pi-desk-*.AppImage && ./3pi-desk-*.AppImage`
   - deb: install into a disposable VM/container.
   - macOS dmg: open it, drag the app to Applications, right-click → Open (unsigned build), and
     send one prompt.
5. Run a clean-clone check:

   ```bash
   git clone https://github.com/BA4RNJ/3pi-desk-for-claude-code.git /tmp/3pi-clean
   cd /tmp/3pi-clean
   npm ci
   npm run typecheck
   npm test
   npx electron-vite build
   ```

6. Confirm no secrets or personal data are tracked:

   ```bash
   git grep -nE 'sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}'
   ```

7. Confirm `LICENSE`, `THIRD_PARTY_NOTICES.md`, and `docs/social-preview.png` are present.

## Tag and publish

The release workflow builds Linux AppImage/deb and a macOS dmg/zip, generates
`SHA256SUMS` / `SHA256SUMS-macos`, and creates a **draft** GitHub Release. macOS artifacts are
unsigned and unnotarized unless Apple signing secrets are added to the repository; their filename
includes the runner architecture.

```bash
git tag -a v0.4.0 -m "3PI Desk for Claude Code v0.4.0"
git push origin v0.4.0
```

Then:

1. Open **Actions → Release** and wait for the Linux and macOS jobs.
2. Open **Releases**, review the draft, and add a short legal note:

   > Release packages include Anthropic's Claude Code CLI. Use and redistribution are subject to
   > Anthropic's legal agreements. See `THIRD_PARTY_NOTICES.md`.

3. Download one artifact per platform, verify `SHA256SUMS` / `SHA256SUMS-macos`, launch it, and
   send one real prompt.
4. Publish the draft.

## Licensing reminder

The project's MIT license covers this repository's code only. The Claude Agent SDK and Claude
Code CLI are © Anthropic PBC, all rights reserved, and are subject to Anthropic's legal
agreements. Do not state or imply that the MIT license covers those components.
