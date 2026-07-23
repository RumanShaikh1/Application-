import { useEffect, useState } from 'react'

const STORAGE_KEY = 'themeMode'

export type Theme = 'light' | 'dark'

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

// Same defensive pattern as useDraggableTab's storage access: chrome.storage
// is only defined when the "storage" permission is granted, and an already-
// loaded extension doesn't get a manifest permission change until reloaded.
// A theme preference failing to load/save must never be able to crash the
// panel - see ErrorBoundary.tsx for what happens when a hook doesn't guard
// against that.
function loadStoredTheme(): Promise<Theme | null> {
  try {
    return chrome.storage.local.get(STORAGE_KEY).then(
      (result) => (isTheme(result[STORAGE_KEY]) ? result[STORAGE_KEY] : null),
      () => null
    )
  } catch {
    return Promise.resolve(null)
  }
}

function saveTheme(theme: Theme): void {
  try {
    void chrome.storage.local.set({ [STORAGE_KEY]: theme }).catch(() => {})
  } catch {
    // Preference just won't persist across reloads - not worth surfacing.
  }
}

/**
 * Applies the `dark` class to the given container element (the shadow
 * root's own `.marketpane-root` div - see main.tsx) rather than anything on
 * the host page, so the toggle only ever affects our own panel.
 */
export function useTheme(containerEl: HTMLElement | null): {
  theme: Theme
  toggleTheme: () => void
} {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    loadStoredTheme().then((stored) => {
      if (stored) setTheme(stored)
    })
  }, [])

  useEffect(() => {
    containerEl?.classList.toggle('dark', theme === 'dark')
  }, [theme, containerEl])

  function toggleTheme(): void {
    setTheme((current) => {
      const next: Theme = current === 'light' ? 'dark' : 'light'
      saveTheme(next)
      return next
    })
  }

  return { theme, toggleTheme }
}
