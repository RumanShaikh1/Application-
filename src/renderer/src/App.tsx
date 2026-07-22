import { useCallback, useEffect, useState } from 'react'
import BrowserPane from './components/BrowserPane'
import TranslatorDrawer from './components/TranslatorDrawer'
import type { HighlightPayload } from '@shared/ipc-channels'

const DEFAULT_URL = 'https://finance.yahoo.com'

export default function App() {
  const [webviewPreloadPath] = useState(() => window.api.getWebviewPreloadPath())
  const [highlight, setHighlight] = useState<HighlightPayload | null>(null)
  const [tickers, setTickers] = useState<string[]>([])

  useEffect(() => {
    const unsubscribe = window.api.onHighlight((payload) => setHighlight(payload))
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = window.api.onTickers((payload) => setTickers(payload.symbols))
    return unsubscribe
  }, [])

  // Lets a stat's lightbulb button reuse the exact same explain-it flow as
  // highlighting text in the browser pane.
  const explainTerm = useCallback((text: string) => {
    setHighlight({ text, timestamp: Date.now() })
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bone">
      <main className="h-full min-w-0 flex-1">
        <BrowserPane initialUrl={DEFAULT_URL} preloadPath={webviewPreloadPath} />
      </main>

      <TranslatorDrawer highlight={highlight} tickers={tickers} onExplainTerm={explainTerm} />
    </div>
  )
}
