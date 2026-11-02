/**
 * Detect whether the process is running inside WSL.
 *
 * WSLg is not required: plain WSL with an external X server still has no
 * Windows system tray and cannot receive Windows-wide global shortcuts, so the
 * UI should degrade the same way.
 */
export function isWslEnvironment(
  env: Record<string, string | undefined>,
  osRelease: string
): boolean {
  if (env.WSL_DISTRO_NAME || env.WSL_INTEROP) return true
  return osRelease.toLowerCase().includes('microsoft')
}
