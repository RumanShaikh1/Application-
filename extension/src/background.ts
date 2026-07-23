import type { ApiRequestMessage, ApiResponseMessage } from './lib/messages'

const SERVER_URL = 'http://localhost:8787'

async function handleRequest(message: ApiRequestMessage): Promise<ApiResponseMessage> {
  try {
    switch (message.endpoint) {
      case 'translate': {
        const res = await fetch(`${SERVER_URL}/api/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message.payload)
        })
        const body = await res.json()
        if (!res.ok) return { ok: false, error: body.error ?? 'Translation failed.' }
        return { ok: true, data: body.result }
      }
      case 'context': {
        const res = await fetch(`${SERVER_URL}/api/context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message.payload)
        })
        const body = await res.json()
        if (!res.ok) return { ok: false, error: body.error ?? 'Could not generate context.' }
        return { ok: true, data: body.result }
      }
      case 'stats': {
        const params = new URLSearchParams({ symbols: message.payload.symbols.join(',') })
        const res = await fetch(`${SERVER_URL}/api/stats?${params}`)
        const body = await res.json()
        if (!res.ok) return { ok: false, error: body.error ?? 'Could not load stock stats.' }
        return { ok: true, data: body }
      }
      case 'profile': {
        const res = await fetch(`${SERVER_URL}/api/profile/${encodeURIComponent(message.payload.symbol)}`)
        const body = await res.json()
        if (!res.ok) return { ok: false, error: body.error ?? 'Could not load insights.' }
        return { ok: true, data: body }
      }
      case 'news': {
        const res = await fetch(`${SERVER_URL}/api/news/${encodeURIComponent(message.payload.symbol)}`)
        const body = await res.json()
        if (!res.ok) return { ok: false, error: body.error ?? 'Could not load news.' }
        return { ok: true, data: body }
      }
      case 'chart': {
        const params = new URLSearchParams({ range: message.payload.range })
        const res = await fetch(`${SERVER_URL}/api/chart/${encodeURIComponent(message.payload.symbol)}?${params}`)
        const body = await res.json()
        if (!res.ok) return { ok: false, error: body.error ?? 'Could not load chart data.' }
        return { ok: true, data: body }
      }
    }
  } catch (error) {
    const message =
      error instanceof TypeError
        ? `Could not reach the MarketPane server at ${SERVER_URL}. Is it running? (npm run dev inside server/)`
        : error instanceof Error
          ? error.message
          : 'Unexpected error.'
    return { ok: false, error: message }
  }
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!message || typeof message !== 'object' || (message as { type?: string }).type !== 'api-request') {
    return undefined
  }
  handleRequest(message as ApiRequestMessage).then(sendResponse)
  return true // keep the message channel open for the async sendResponse above
})

// Toolbar icon click toggles the in-page sidebar (mirrors the old floating
// tab button - both do the same thing).
chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return
  chrome.tabs.sendMessage(tab.id, { type: 'toggle-sidebar' }).catch(() => {
    // No content script on this tab (e.g. a chrome:// page) - nothing to toggle.
  })
})
