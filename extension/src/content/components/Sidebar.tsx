import { useEffect, useRef, useState } from 'react'
import { Languages, Moon, Sparkle, Sun, X } from 'lucide-react'
import Translator from './Translator'
import StockStats from './StockStats'
import StockDetail from './StockDetail'
import { useDraggableTab } from '../useDraggableTab'
import type { Theme } from '../useTheme'
import type { HighlightPayload, StockStats as StockStatsData } from '@shared/types'

interface SidebarProps {
  highlight: HighlightPayload | null
  tickers: string[]
  onExplainTerm: (text: string) => void
  theme: Theme
  onToggleTheme: () => void
}

const PANEL_WIDTH = 400

export default function Sidebar({ highlight, tickers, onExplainTerm, theme, onToggleTheme }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedStock, setSelectedStock] = useState<StockStatsData | null>(null)
  const tabRef = useRef<HTMLButtonElement>(null)
  const { topPx, handleMouseDown, consumeDrag } = useDraggableTab()

  // Pop the sidebar open automatically whenever a fresh highlight arrives.
  // It never auto-closes - only the tab, the close button, or Esc do that -
  // so the page stays clickable/selectable underneath the whole time.
  useEffect(() => {
    if (highlight) {
      setIsOpen(true)
      setSelectedStock(null)
    }
  }, [highlight?.timestamp])

  useEffect(() => {
    if (!isOpen) return

    function handleKeydown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setIsOpen(false)
        tabRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [isOpen])

  // Toolbar-icon click (handled in the background worker) relays here to
  // toggle the sidebar, mirroring what clicking the floating tab does.
  useEffect(() => {
    function handleMessage(message: unknown): void {
      if (message && typeof message === 'object' && (message as { type?: string }).type === 'toggle-sidebar') {
        setIsOpen((value) => !value)
      }
    }
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [])

  // We don't own this page's layout the way a native app owns its window,
  // so "push" the page over by nudging the real <html> element's margin -
  // the closest a content script can get to the flex-sibling reflow trick
  // used in a fully-owned layout. Reverted on unmount so nothing lingers if
  // the extension is reloaded/disabled mid-session.
  useEffect(() => {
    const root = document.documentElement
    root.style.transition = 'margin-right 300ms ease-out'
    root.style.marginRight = isOpen ? `${PANEL_WIDTH}px` : '0px'
    return () => {
      root.style.marginRight = '0px'
    }
  }, [isOpen])

  function close(): void {
    setIsOpen(false)
    tabRef.current?.focus()
  }

  function handleTabClick(): void {
    // A drag ends with a mouseup on the same element, which the browser
    // still treats as a click - swallow that one so dragging the tab
    // doesn't also toggle the panel.
    if (consumeDrag()) return
    setIsOpen((value) => !value)
  }

  return (
    <>
      <button
        ref={tabRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls="marketpane-sidebar-panel"
        onMouseDown={handleMouseDown}
        onClick={handleTabClick}
        style={{ right: isOpen ? PANEL_WIDTH : 0, top: topPx }}
        title="Drag to reposition"
        className="fixed z-[2147483647] flex -translate-y-1/2 cursor-grab select-none flex-col items-center gap-2 rounded-l-2xl border border-r-0 border-bone/15 bg-ink px-2.5 py-4 text-vermilion shadow-soft transition-[right] duration-300 ease-out focus-visible:ring-2 focus-visible:ring-vermilion active:cursor-grabbing"
      >
        <Languages size={16} aria-hidden="true" />
        <span className="text-[11px] font-medium tracking-wide text-bone/70 [writing-mode:vertical-rl]">Jargon Buster</span>
      </button>

      <aside
        id="marketpane-sidebar-panel"
        role="region"
        aria-label="Jargon Buster"
        style={{ width: isOpen ? PANEL_WIDTH : 0 }}
        className="fixed inset-y-0 right-0 z-[2147483646] h-full select-none overflow-hidden bg-bone shadow-soft transition-[width] duration-300 ease-out dark:bg-ink dark:shadow-softDark"
      >
        <div style={{ width: PANEL_WIDTH }} className="flex h-full flex-col">
          <header className="flex items-center justify-between gap-2.5 px-5 py-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-vermilion dark:bg-bone/10">
                <Sparkle size={18} aria-hidden="true" />
              </span>
              <div>
                <h1 className="font-display text-sm font-semibold tracking-tight text-ink dark:text-bone">MarketPane</h1>
                <p className="text-[11px] leading-relaxed text-ink/55 dark:text-bone/55">Learn the market as you browse it</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="rounded-full p-1.5 text-ink/60 transition-colors hover:bg-ink/6 hover:text-vermilion focus-visible:ring-2 focus-visible:ring-vermilion dark:text-bone/60 dark:hover:bg-bone/10"
              >
                {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
              </button>
              <button
                type="button"
                onClick={close}
                aria-label="Close panel"
                className="rounded-full p-1.5 text-ink/60 transition-colors hover:bg-ink/6 hover:text-vermilion focus-visible:ring-2 focus-visible:ring-vermilion dark:text-bone/60 dark:hover:bg-bone/10"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="scrollbar-spark flex-1 space-y-4 overflow-y-auto px-4 pb-5 dark:scrollbar-ink">
            {selectedStock ? (
              <StockDetail stat={selectedStock} onBack={() => setSelectedStock(null)} />
            ) : (
              <>
                <Translator highlight={highlight} />
                <StockStats symbols={tickers} onExplainTerm={onExplainTerm} onSelectStock={setSelectedStock} />
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
