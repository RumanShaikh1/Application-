import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

export type ViewState = 'loading' | 'empty' | 'error' | 'populated'

interface StatusStateProps {
  state: ViewState
  loadingLabel?: string
  emptyIcon?: LucideIcon
  emptyTitle?: string
  emptyBody?: string
  errorMessage?: string
  onRetry?: () => void
  children: ReactNode
}

export default function StatusState({
  state,
  loadingLabel = 'Loading...',
  emptyIcon: EmptyIcon = Inbox,
  emptyTitle = 'Nothing here yet',
  emptyBody = '',
  errorMessage,
  onRetry,
  children
}: StatusStateProps) {
  if (state === 'loading') {
    return (
      <div className="flex animate-fade-in flex-col items-center justify-center gap-3 py-16 text-center">
        <Loader2 className="animate-spin text-vermilion" size={24} aria-hidden="true" />
        <p className="text-sm text-ink/60" role="status">
          {loadingLabel}
        </p>
      </div>
    )
  }

  if (state === 'empty') {
    return (
      <div className="flex animate-fade-in flex-col items-center justify-center gap-3 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink/6 text-ink/45">
          <EmptyIcon size={22} aria-hidden="true" />
        </span>
        <p className="font-display text-base font-medium text-ink">{emptyTitle}</p>
        <p className="max-w-[320px] text-sm leading-relaxed text-ink/55">{emptyBody}</p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex animate-fade-in flex-col items-center justify-center gap-3 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-vermilion/10 text-vermilion">
          <AlertTriangle size={22} aria-hidden="true" />
        </span>
        <p className="max-w-[360px] text-sm text-ink" role="alert">
          {errorMessage ?? 'Something went wrong.'}
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-vermilion px-5 py-2 text-sm font-semibold text-chalk transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
          >
            Retry
          </button>
        ) : null}
      </div>
    )
  }

  return <>{children}</>
}
