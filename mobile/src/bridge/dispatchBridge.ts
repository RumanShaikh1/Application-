import { DeviceEventEmitter, NativeModules } from 'react-native'
// Must import before mobileDispatch below - see androidDataFs.ts's file
// comment for why the ordering itself (not just importing it somewhere) matters.
import './androidDataFs'
import { dispatch } from '../../../server/src/mobileDispatch'

const { MarketPaneBridge } = NativeModules

interface ApiRequestEvent {
  requestId: string
  method: string
  path: string
  query: string
  body: string
}

function parseJsonSafely(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// Registers the listener before starting the native HTTP server (see
// startDispatchBridge below) - a request arriving before this listener
// exists would just hang until MarketPaneHttpServer.kt's own timeout, so
// call order matters here even though both happen near-instantly.
DeviceEventEmitter.addListener('MarketPaneApiRequest', async (event: ApiRequestEvent) => {
  const query = (parseJsonSafely(event.query) as Record<string, string>) ?? {}
  const body = parseJsonSafely(event.body)

  try {
    const result = await dispatch({ method: event.method, path: event.path, query, body })
    MarketPaneBridge.respond(event.requestId, result.status, JSON.stringify(result.body))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error.'
    MarketPaneBridge.respond(event.requestId, 500, JSON.stringify({ error: message }))
  }
})

/** Call once, at app startup, before rendering the WebView - see App.tsx. */
export async function startDispatchBridge(port: number): Promise<void> {
  await MarketPaneBridge.startServer(port)
}
