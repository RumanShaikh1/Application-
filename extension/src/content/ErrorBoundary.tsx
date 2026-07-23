import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Without this, an uncaught error anywhere in the sidebar's render/effect
 * tree makes React unmount the whole thing - not a broken feature, the
 * entire floating tab silently disappearing with no error visible on the
 * page (exactly what happened when chrome.storage access threw before a
 * permission reload). Catching it here means a future bug degrades to
 * "the panel is empty," never "there's nothing to click on the page at all."
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown): void {
    console.error('[MarketPane] sidebar crashed:', error)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'fixed',
            bottom: 12,
            right: 12,
            zIndex: 2147483647,
            background: '#16150F',
            color: '#F4F1EA',
            padding: '8px 12px',
            fontSize: 12,
            fontFamily: 'system-ui, sans-serif',
            borderRadius: 4
          }}
        >
          MarketPane hit an error. Reload the page to try again.
        </div>
      )
    }
    return this.props.children
  }
}
