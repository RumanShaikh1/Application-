import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { WebviewTag } from 'electron'
import { AlertTriangle, ArrowLeft, ArrowRight, Globe2, RotateCw } from 'lucide-react'

interface BrowserPaneProps {
  initialUrl: string
  preloadPath: string
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return 'https://finance.yahoo.com'
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/i.test(trimmed) && !trimmed.includes(' ')) return `https://${trimmed}`
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
}

export default function BrowserPane({ initialUrl, preloadPath }: BrowserPaneProps) {
  const webviewRef = useRef<WebviewTag | null>(null)
  const [addressInput, setAddressInput] = useState(initialUrl)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const handleStart = (): void => {
      setIsLoading(true)
      setLoadError(null)
    }
    const handleStop = (): void => {
      setIsLoading(false)
      setCanGoBack(webview.canGoBack())
      setCanGoForward(webview.canGoForward())
    }
    const handleNavigate = (event: Electron.DidNavigateEvent): void => {
      setAddressInput(event.url)
    }
    const handleFail = (event: Electron.DidFailLoadEvent): void => {
      if (event.errorCode === -3) return // ERR_ABORTED - benign redirect/cancel, not a real failure
      setIsLoading(false)
      setLoadError(event.errorDescription || 'Failed to load this page.')
    }

    webview.addEventListener('did-start-loading', handleStart)
    webview.addEventListener('did-stop-loading', handleStop)
    webview.addEventListener('did-navigate', handleNavigate)
    webview.addEventListener('did-navigate-in-page', handleNavigate)
    webview.addEventListener('did-fail-load', handleFail)

    return () => {
      webview.removeEventListener('did-start-loading', handleStart)
      webview.removeEventListener('did-stop-loading', handleStop)
      webview.removeEventListener('did-navigate', handleNavigate)
      webview.removeEventListener('did-navigate-in-page', handleNavigate)
      webview.removeEventListener('did-fail-load', handleFail)
    }
  }, [])

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    webviewRef.current?.loadURL(normalizeUrl(addressInput))
  }

  return (
    <div className="flex h-full flex-col bg-ink">
      <div className="flex items-center gap-2 border-b border-bone/15 bg-ink px-3 py-2.5">
        <button
          type="button"
          aria-label="Go back"
          disabled={!canGoBack}
          onClick={() => webviewRef.current?.goBack()}
          className="p-1.5 text-bone/70 transition-colors hover:text-bone disabled:pointer-events-none disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-vermilion"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Go forward"
          disabled={!canGoForward}
          onClick={() => webviewRef.current?.goForward()}
          className="p-1.5 text-bone/70 transition-colors hover:text-bone disabled:pointer-events-none disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-vermilion"
        >
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Reload page"
          onClick={() => webviewRef.current?.reload()}
          className="p-1.5 text-bone/70 transition-colors hover:text-bone focus-visible:ring-2 focus-visible:ring-vermilion"
        >
          <RotateCw size={15} aria-hidden="true" className={isLoading ? 'animate-spin' : ''} />
        </button>
        <form
          onSubmit={handleSubmit}
          className="flex min-w-0 flex-1 items-center gap-2 border border-hairline border-bone/20 bg-bone/[0.06] px-3 py-1.5 focus-within:border-vermilion"
        >
          <Globe2 size={14} className="shrink-0 text-bone/50" aria-hidden="true" />
          <label htmlFor="address-bar" className="sr-only">
            Address bar
          </label>
          <input
            id="address-bar"
            value={addressInput}
            onChange={(event) => setAddressInput(event.target.value)}
            spellCheck={false}
            className="w-full min-w-0 truncate bg-transparent font-mono text-xs text-bone placeholder:text-bone/40 focus:outline-none"
            placeholder="Search or enter a URL"
          />
        </form>
      </div>

      <div className="relative flex-1 bg-ink">
        <div
          className={`absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-bone/10 transition-opacity ${
            isLoading ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="h-full w-1/3 animate-loading-bar bg-vermilion" />
        </div>

        {loadError ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-ink p-6 text-center">
            <span className="flex h-11 w-11 items-center justify-center border border-hairline border-vermilion/40 text-vermilion">
              <AlertTriangle size={20} aria-hidden="true" />
            </span>
            <p className="max-w-sm text-sm text-bone" role="alert">
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => webviewRef.current?.reload()}
              className="rounded-full bg-vermilion px-4 py-1.5 text-xs font-semibold text-bone transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              Retry
            </button>
          </div>
        ) : null}

        <webview ref={webviewRef} src={initialUrl} preload={preloadPath} className="h-full w-full" />
      </div>
    </div>
  )
}
