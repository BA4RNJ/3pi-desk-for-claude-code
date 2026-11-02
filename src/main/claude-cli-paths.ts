import { accessSync, constants, readdirSync, statSync } from 'node:fs'
import { delimiter, join } from 'node:path'

/**
 * Pure filesystem/path helpers for locating the Claude Code CLI.
 *
 * Kept free of Electron imports so `scripts/claude-cli.test.mjs` can exercise
 * it directly with Node's TypeScript stripping.
 */

/** Oldest CLI the current Agent SDK is expected to speak to. */
export const MINIMUM_CLI_VERSION = '2.0.0'

export function claudeBinaryName(
  platform: NodeJS.Platform = process.platform
): string {
  return platform === 'win32' ? 'claude.exe' : 'claude'
}

/** Pull `2.1.309` (or a prerelease) out of `claude --version` output. */
export function parseCliVersion(output: string): string | undefined {
  return output.match(/(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/)?.[1]
}

export function compareVersions(a: string, b: string): number {
  const parts = (value: string): number[] =>
    value
      .split(/[-+]/)[0]
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0)
  const left = parts(a)
  const right = parts(b)
  for (let index = 0; index < 3; index += 1) {
    const delta = (left[index] || 0) - (right[index] || 0)
    if (delta !== 0) return delta > 0 ? 1 : -1
  }
  return 0
}

export function isCompatibleCliVersion(version: string | undefined): boolean {
  return Boolean(version && compareVersions(version, MINIMUM_CLI_VERSION) >= 0)
}

export function isExecutableFile(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false
    if (process.platform !== 'win32') accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/** npm platform packages that can provide the binary, glibc first. */
export function platformPackageNames(
  platform: NodeJS.Platform,
  arch: string
): string[] {
  const base = `@anthropic-ai/claude-agent-sdk-${platform}-${arch}`
  return platform === 'linux' ? [base, `${base}-musl`] : [base]
}

/** Versions installed by the official installer at ~/.local/share/claude. */
export function versionManagerCandidates(home: string): string[] {
  const dir = join(home, '.local', 'share', 'claude', 'versions')
  try {
    return readdirSync(dir)
      .filter((name) => /^\d+\.\d+\.\d+/.test(name))
      .sort((a, b) => compareVersions(b, a))
      .map((name) => join(dir, name))
  } catch {
    return []
  }
}

export interface SystemCandidateOptions {
  platform?: NodeJS.Platform
  envPath?: string
  home: string
}

/**
 * Likely places a user-installed `claude` lives, PATH first.
 * Order matters: the first runnable match wins.
 */
export function systemBinaryCandidates(options: SystemCandidateOptions): string[] {
  const platform = options.platform ?? process.platform
  const binary = claudeBinaryName(platform)
  const candidates: string[] = []

  for (const dir of (options.envPath ?? '').split(delimiter)) {
    if (dir) candidates.push(join(dir, binary))
  }

  if (platform === 'darwin') {
    candidates.push(join(options.home, '.local', 'bin', binary))
    candidates.push(join(options.home, '.claude', 'local', binary))
    candidates.push('/opt/homebrew/bin/claude')
    candidates.push('/usr/local/bin/claude')
  } else if (platform === 'win32') {
    candidates.push(join(options.home, '.local', 'bin', binary))
  } else {
    candidates.push(join(options.home, '.local', 'bin', binary))
    candidates.push(join(options.home, '.claude', 'local', binary))
    candidates.push('/usr/local/bin/claude')
    candidates.push('/usr/bin/claude')
  }

  candidates.push(...versionManagerCandidates(options.home))
  return [...new Set(candidates)]
}

export function cachedCliPath(
  userData: string,
  version: string,
  platform: NodeJS.Platform = process.platform
): string {
  return join(userData, 'claude-cli', version, claudeBinaryName(platform))
}
