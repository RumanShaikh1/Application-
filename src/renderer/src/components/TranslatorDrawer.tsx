import { useEffect, useRef, useState } from 'react'
import { Languages, Sparkle, X } from 'lucide-react'
import Translator from './Translator'
import StockStats from './StockStats'
import StockDetail from './StockDetail'
import type { HighlightPayload, StockStats as StockStatsData } from '@shared/ipc-channels'

interface TranslatorDrawerProps {
  highlight: HighlightPayload | null
  tickers: string[]
  onExplainTerm: (text: string) => void
}

const PANEL_WIDTH = 400

export default function TranslatorDrawer({ highlight, tickers, onExplainTerm }: TranslatorDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedStock, setSelectedStock] = useState<StockStatsData | null>(null)
  const tabRef = useRef<HTMLButtonElement>(null)

  // Pop the drawer open automatically whenever a fresh highlight arrives.
  // It never auto-closes - only the tab, the close button, or Esc do that -
  // so the browser pane stays clickable/selectable underneath the whole time.
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

  function close(): void {
    setIsOpen(false)
    tabRef.current?.focus()
  }

  return (
    <>
      <button
        ref={tabRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls="translator-drawer-panel"
        onClick={() => setIsOpen((value) => !value)}
        style={{ right: isOpen ? PANEL_WIDTH : 0 }}
        className="fixed top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-2 border border-r-0 border-bone/15 bg-ink px-2 py-4 text-vermilion transition-[right] duration-300 ease-out focus-visible:ring-2 focus-visible:ring-vermilion"
      >
        <Languages size={16} aria-hidden="true" />
        <span className="text-[11px] font-medium tracking-wide text-bone/70 [writing-mode:vertical-rl]">Jargon Buster</span>
      </button>

      {/* This wrapper is the flex sibling that actually claims layout space -
          animating its width (0 -> PANEL_WIDTH) is what shrinks the browser
          pane, instead of floating the panel on top of it. */}
      <aside
        style={{ width: isOpen ? PANEL_WIDTH : 0 }}
        className="h-full shrink-0 overflow-hidden transition-[width] duration-300 ease-out"
      >
        <div
          id="translator-drawer-panel"
          role="region"
          aria-label="Jargon Buster"
          style={{ width: PANEL_WIDTH }}
          className="flex h-full flex-col border-l border-hairline border-ink/15 bg-bone"
        >
          <header className="flex items-center justify-between gap-2.5 border-b border-hairline border-ink/15 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center bg-ink text-vermilion">
                <Sparkle size={18} aria-hidden="true" />
              </span>
              <div>
                <h1 className="font-display text-sm font-semibold tracking-tight text-ink">MarketPane</h1>
                <p className="text-[11px] text-ink/55">Learn the market as you browse it</p>
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close panel"
              className="p-1.5 text-ink/60 transition-colors hover:text-vermilion focus-visible:ring-2 focus-visible:ring-vermilion"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </header>

          <div className="scrollbar-spark flex-1 space-y-4 overflow-y-auto p-4">
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
