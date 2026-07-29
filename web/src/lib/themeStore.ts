export type Theme = 'light' | 'dark'

// Same key the no-FOUC bootstrap script in index.html reads before React
// mounts - keep the two in sync if this ever changes.
const STORAGE_KEY = 'marketpane.theme'

export function getStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage can be unavailable (private browsing, quota) - the toggle
    // still works for the session, it just won't persist across reloads.
  }
}

export function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyThemeClass(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}
