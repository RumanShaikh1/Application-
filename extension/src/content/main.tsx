// Latin-only subsets - the multi-script default files pull in every
// unicode-range (cyrillic, vietnamese, greek, ...) as inlined base64 woff2,
// which bloated this content script's CSS to over 1MB for no reason.
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '../index.css'

import React, { useCallback, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import Sidebar from './components/Sidebar'
import ErrorBoundary from './ErrorBoundary'
import { watchHighlights } from './highlightWatcher'
import { watchTickers } from './tickerDetector'
import { useTheme } from './useTheme'
import type { HighlightPayload } from '@shared/types'

function Root({ hostElement, containerElement }: { hostElement: HTMLElement; containerElement: HTMLElement }) {
  const [highlight, setHighlight] = useState<HighlightPayload | null>(null)
  const [tickers, setTickers] = useState<string[]>([])
  const { theme, toggleTheme } = useTheme(containerElement)

  useEffect(() => watchHighlights(hostElement, setHighlight), [hostElement])
  useEffect(() => watchTickers((symbols) => setTickers(symbols)), [])

  // Lets a stat's lightbulb button reuse the exact same explain-it flow as
  // highlighting text on the page.
  const explainTerm = useCallback((text: string) => {
    setHighlight({ text, timestamp: Date.now() })
  }, [])

  return (
    <ErrorBoundary>
      <Sidebar
        highlight={highlight}
        tickers={tickers}
        onExplainTerm={explainTerm}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    </ErrorBoundary>
  )
}

async function mount(): Promise<void> {
  // Avoid double-injection if the content script somehow runs twice (e.g.
  // extension reload while a tab is already loaded).
  if (document.getElementById('marketpane-host')) return

  const host = document.createElement('div')
  host.id = 'marketpane-host'
  document.documentElement.appendChild(host)

  const shadowRoot = host.attachShadow({ mode: 'open' })

  // Fetched (not <link>-tagged) and awaited before the first render so the
  // floating tab never flashes unstyled for a frame.
  const cssUrl = chrome.runtime.getURL('content.css')
  const css = await fetch(cssUrl).then((res) => res.text())
  const styleTag = document.createElement('style')
  styleTag.textContent = css
  shadowRoot.appendChild(styleTag)

  const container = document.createElement('div')
  container.className = 'marketpane-root'
  shadowRoot.appendChild(container)

  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <Root hostElement={host} containerElement={container} />
    </React.StrictMode>
  )
}

void mount()
