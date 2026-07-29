import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Moon, Sparkles, Sun } from 'lucide-react'
import { applyThemeClass, getStoredTheme, getSystemTheme, storeTheme, type Theme } from '../lib/themeStore'

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/learn', label: 'Learn', end: false },
  { to: '/scenarios', label: 'Scenarios', end: true },
  { to: '/simulator', label: 'Simulator', end: false },
  { to: '/tax', label: 'Trade cost', end: false },
  { to: '/tax/fy-overview', label: 'FY planner', end: false },
  { to: '/progress', label: 'Progress', end: false }
]

export default function Layout() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme() ?? getSystemTheme())

  useEffect(() => {
    applyThemeClass(theme)
  }, [theme])

  useEffect(() => {
    // Follow the OS setting live only until the user picks explicitly -
    // index.html's no-FOUC bootstrap script only reads this once, before mount.
    if (getStoredTheme() !== null) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event: MediaQueryListEvent): void => setTheme(event.matches ? 'dark' : 'light')
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  function toggleTheme(): void {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    storeTheme(next)
    setTheme(next)
  }

  return (
    <div className="min-h-screen bg-bone">
      <header className="border-b border-ink/10 bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-y-2 px-4 py-3 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
            <Sparkles size={16} className="text-vermilion" aria-hidden="true" />
            Decision Replay
          </NavLink>
          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex flex-wrap items-center gap-1" aria-label="Primary">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-vermilion ${
                      isActive ? 'bg-ink text-bone' : 'text-ink/60 hover:text-ink'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="rounded-full p-2 text-ink/60 transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-vermilion"
            >
              {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
