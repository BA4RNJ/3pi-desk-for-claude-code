# Third-Party Notices

This repository's original source code is licensed under the MIT License (see `LICENSE`).
That license does **not** apply to third-party components shipped with, downloaded by, or
required by the application.

## Anthropic Claude Agent SDK and Claude Code CLI

- Packages: `@anthropic-ai/claude-agent-sdk`, `@anthropic-ai/claude-agent-sdk-<platform>-<arch>`
- Copyright: © Anthropic PBC. All rights reserved.
- License notice shipped in the packages:

  > © Anthropic PBC. All rights reserved. Use is subject to the Legal Agreements outlined here:
  > https://code.claude.com/docs/en/legal-and-compliance

These packages are **not** open source and are not covered by this project's MIT license.
Installing them through npm or running them means you accept Anthropic's legal agreements.
If you build or distribute a package that bundles the Claude Code CLI (for example the
AppImage/deb artifacts produced by this repository), you are responsible for confirming that
your distribution complies with those agreements.

This project is unofficial and is not affiliated with, endorsed by, or sponsored by Anthropic.

## Electron

Electron is licensed under the MIT License. See the `electron` package for the full text.

## JavaScript dependencies

The application uses npm packages under permissive licenses, primarily MIT, BSD-3-Clause, and
ISC. The exact resolved versions are pinned in `package-lock.json`; each package's license is
listed in its own `package.json`. The production dependency tree currently includes:

- `react`, `react-dom`, `react-markdown`, `remark-gfm`, `rehype-highlight` — MIT
- `highlight.js`, `diff` — BSD-3-Clause
- `lucide-react` — ISC
- `@anthropic-ai/claude-agent-sdk` — proprietary, see above

## App icon

The 3PI Desk application icon and brand assets are part of this project. Do not use them to
imply affiliation with Anthropic.

## Reporting a licensing issue

If you believe a third-party notice is missing or incorrect, please open an issue or contact the
maintainer through GitHub.
