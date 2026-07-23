import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'

const STORAGE_KEY = 'tabTopFraction'
const EDGE_MARGIN = 40
const DRAG_THRESHOLD_PX = 4

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// chrome.storage is only defined at all when the "storage" permission is
// granted - on an extension that was loaded before that permission was
// added to the manifest, chrome.storage is undefined and reading
// chrome.storage.local throws synchronously. Uncaught, that throw happens
// inside a useEffect with no error boundary above it, which makes React
// unmount this entire component tree - not just fail to load a saved
// position, but make the whole floating tab disappear. Position
// persistence is a nice-to-have; it must never be able to take the tab
// down with it.
function loadStoredFraction(): Promise<number | null> {
  try {
    return chrome.storage.local.get(STORAGE_KEY).then(
      (result) => (typeof result[STORAGE_KEY] === 'number' ? result[STORAGE_KEY] : null),
      () => null
    )
  } catch {
    return Promise.resolve(null)
  }
}

function saveFraction(fraction: number): void {
  try {
    void chrome.storage.local.set({ [STORAGE_KEY]: fraction }).catch(() => {})
  } catch {
    // Position just won't persist across reloads - not worth surfacing.
  }
}

/**
 * Lets the floating tab be dragged up/down along the page's right edge.
 * Position is stored as a fraction of viewport height (so it stays sensible
 * across differently-sized windows) in chrome.storage - not page-scoped
 * localStorage, which would reset every time you visit a different site.
 */
export function useDraggableTab(defaultFraction = 0.5): {
  topPx: number
  handleMouseDown: (event: ReactMouseEvent<HTMLButtonElement>) => void
  /** Call from onClick: returns true (and resets) if the preceding mouse-up was actually a drag, not a click. */
  consumeDrag: () => boolean
} {
  const [fraction, setFraction] = useState(defaultFraction)
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight)
  const [isDragging, setIsDragging] = useState(false)
  const fractionRef = useRef(fraction)
  const dragStartRef = useRef<{ startY: number; startTopPx: number } | null>(null)
  const didDragRef = useRef(false)

  useEffect(() => {
    loadStoredFraction().then((stored) => {
      if (stored !== null) {
        fractionRef.current = stored
        setFraction(stored)
      }
    })
  }, [])

  useEffect(() => {
    function handleResize(): void {
      setViewportHeight(window.innerHeight)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const topPx = clamp(fraction * viewportHeight, EDGE_MARGIN, viewportHeight - EDGE_MARGIN)

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return
      dragStartRef.current = { startY: event.clientY, startTopPx: topPx }
      didDragRef.current = false
      setIsDragging(true)
    },
    [topPx]
  )

  useEffect(() => {
    if (!isDragging) return

    function handleMouseMove(event: MouseEvent): void {
      if (!dragStartRef.current) return
      const delta = event.clientY - dragStartRef.current.startY
      if (Math.abs(delta) > DRAG_THRESHOLD_PX) didDragRef.current = true
      const newTopPx = clamp(dragStartRef.current.startTopPx + delta, EDGE_MARGIN, window.innerHeight - EDGE_MARGIN)
      const newFraction = newTopPx / window.innerHeight
      fractionRef.current = newFraction
      setFraction(newFraction)
    }

    function handleMouseUp(): void {
      setIsDragging(false)
      dragStartRef.current = null
      if (didDragRef.current) {
        saveFraction(fractionRef.current)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  const consumeDrag = useCallback(() => {
    const dragged = didDragRef.current
    didDragRef.current = false
    return dragged
  }, [])

  return { topPx, handleMouseDown, consumeDrag }
}
