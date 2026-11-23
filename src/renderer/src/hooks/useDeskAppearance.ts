import { useEffect } from 'react'
import type { SettingsSnapshot } from '../../../shared/types'
import type { ThemeMode } from '../types'

export function initialTheme(): ThemeMode {
  const saved = localStorage.getItem('claude-desk-theme')
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  return 'system'
}

export function useAppearanceEffects(
  settings: SettingsSnapshot | null,
  theme: ThemeMode
): void {
  useEffect(() => {
    const root = document.documentElement
    const preferences = settings?.preferences
    if (!preferences) return
    const presetAccents = new Set(['coral', 'blue', 'green', 'purple'])
    const accent = preferences.accent || 'coral'
    root.dataset.palette = preferences.palette || 'claude'
    root.dataset.compact = preferences.compactMode ? 'true' : 'false'
    root.style.setProperty('--ui-scale', String(preferences.fontScale || 1))
    if (presetAccents.has(accent)) {
      root.dataset.accent = accent
      for (const property of ['--coral', '--coral-strong', '--coral-soft', '--coral-ghost']) {
        root.style.removeProperty(property)
      }
    } else if (/^#[0-9a-f]{6}$/i.test(accent)) {
      root.dataset.accent = 'custom'
      root.style.setProperty('--coral', accent)
      root.style.setProperty(
        '--coral-strong',
        `color-mix(in srgb, ${accent} 76%, var(--ink))`
      )
      root.style.setProperty(
        '--coral-soft',
        `color-mix(in srgb, ${accent} 18%, var(--bg))`
      )
      root.style.setProperty(
        '--coral-ghost',
        `color-mix(in srgb, ${accent} 14%, transparent)`
      )
    } else {
      root.dataset.accent = 'coral'
      for (const property of ['--coral', '--coral-strong', '--coral-soft', '--coral-ghost']) {
        root.style.removeProperty(property)
      }
    }
  }, [settings?.preferences])

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      root.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    media.addEventListener('change', apply)
    localStorage.setItem('claude-desk-theme', theme)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}
