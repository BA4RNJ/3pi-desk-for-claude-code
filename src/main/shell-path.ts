import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'

/**
 * GUI apps launched from Finder/Dock on macOS do not inherit the login shell's
 * PATH. Without this, Claude Code starts (the CLI is invoked by absolute path)
 * but its tools cannot find Homebrew/nvm/custom binaries such as git or node.
 *
 * Ask the user's login shell for its PATH once at startup. The call is
 * best-effort: a slow or unusual shell falls back to the common macOS paths.
 */
const FALLBACK_PATH = [
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
  '/usr/local/bin',
  '/usr/local/sbin',
  `${homedir()}/.local/bin`
].join(':')

const MARKER_START = '__3PI_PATH__'
const MARKER_END = '__3PI_PATH_END__'

function loginShellPath(): string | null {
  const shell = process.env.SHELL || '/bin/zsh'
  const shellName = shell.split('/').pop()
  if (!shellName || !['zsh', 'bash', 'sh', 'fish'].includes(shellName)) {
    return null
  }
  // Fish stores PATH as a list and prints it space-separated with "$PATH".
  const command =
    shellName === 'fish'
      ? `printf '${MARKER_START}%s${MARKER_END}' (string join : $PATH)`
      : `printf "${MARKER_START}%s${MARKER_END}" "$PATH"`

  try {
    const output = execFileSync(
      shell,
      ['-ilc', command],
      {
        encoding: 'utf8',
        timeout: 2500,
        stdio: ['ignore', 'pipe', 'ignore'],
        env: {
          ...process.env,
          PATH: [process.env.PATH, FALLBACK_PATH].filter(Boolean).join(':')
        }
      }
    )
    const match = output.match(
      new RegExp(`${MARKER_START}([\\s\\S]*?)${MARKER_END}`)
    )
    return match?.[1] || null
  } catch {
    return null
  }
}

export function mergePathEntries(...values: Array<string | undefined | null>): string {
  const seen = new Set<string>()
  const entries: string[] = []
  for (const value of values) {
    if (!value) continue
    for (const entry of value.split(':')) {
      if (!entry || seen.has(entry)) continue
      seen.add(entry)
      entries.push(entry)
    }
  }
  return entries.join(':')
}

/**
 * Finder launches the app with `/usr/bin:/bin:/usr/sbin:/sbin`. Terminal
 * launches already inherit a useful PATH, so only pay for the shell lookup
 * when the inherited PATH looks like the LaunchServices default.
 */
export function pathLooksMinimal(path: string | undefined): boolean {
  if (!path) return true
  const entries = path.split(':').filter(Boolean)
  const systemDirs = new Set(['/usr/bin', '/bin', '/usr/sbin', '/sbin'])
  return entries.length <= 4 && entries.every((entry) => systemDirs.has(entry))
}

/** Merge the login-shell PATH into this process on macOS. No-op elsewhere. */
export function ensureMacPath(): void {
  if (process.platform !== 'darwin') return
  process.env.PATH = mergePathEntries(
    pathLooksMinimal(process.env.PATH) ? loginShellPath() : null,
    process.env.PATH,
    FALLBACK_PATH
  )
}
