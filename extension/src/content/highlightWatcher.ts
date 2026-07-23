import type { HighlightPayload } from '@shared/types'

/**
 * Watches for text the user highlights on the page. Ported from the old
 * Electron webview-preload's selection listeners - same debounce logic,
 * just calling a plain callback instead of ipcRenderer.send, since the
 * content script and its React tree already share one JS context (no IPC
 * boundary to cross here).
 *
 * Unlike the Electron version - where the browsable page and the sidebar
 * lived in fully separate documents - both now share one page, so
 * selections made *inside our own injected sidebar* (e.g. copying a
 * translation) would otherwise be misread as "highlight this to
 * translate." `sidebarHost` is excluded via composedPath(), which (unlike
 * Node.contains()) reliably crosses the shadow-DOM boundary.
 */
function isInsideHost(node: Node | null, host: HTMLElement): boolean {
  let current: Node | null = node
  while (current) {
    if (current === host) return true
    const root = current.getRootNode()
    current = root instanceof ShadowRoot ? root.host : current.parentNode
  }
  return false
}

export function watchHighlights(sidebarHost: HTMLElement, onHighlight: (payload: HighlightPayload) => void): () => void {
  let lastSentText = ''
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function readSelection(): Selection | null {
    return window.getSelection()
  }

  function sendIfChanged(text: string): void {
    if (text && text !== lastSentText) {
      lastSentText = text
      onHighlight({ text, timestamp: Date.now(), url: window.location.href })
    }
  }

  function handleMouseUp(event: MouseEvent): void {
    if (event.composedPath().includes(sidebarHost)) return
    const selection = readSelection()
    sendIfChanged(selection ? selection.toString().trim() : '')
  }

  function handleSelectionChange(): void {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      const selection = readSelection()
      const text = selection ? selection.toString().trim() : ''
      if (!text) {
        lastSentText = ''
        return
      }
      if (selection?.anchorNode && isInsideHost(selection.anchorNode, sidebarHost)) return
      sendIfChanged(text)
    }, 200)
  }

  window.addEventListener('mouseup', handleMouseUp)
  document.addEventListener('selectionchange', handleSelectionChange)

  return () => {
    window.removeEventListener('mouseup', handleMouseUp)
    document.removeEventListener('selectionchange', handleSelectionChange)
    if (debounceTimer) clearTimeout(debounceTimer)
  }
}
