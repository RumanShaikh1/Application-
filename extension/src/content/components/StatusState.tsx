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
      <div className="flex animate-fade-in flex-col items-center justify-center gap-3 py-12 text-center">
        <Loader2 className="animate-spin text-vermilion" size={22} aria-hidden="true" />
        <p className="text-sm text-ink/60 dark:text-bone/60" role="status">
          {loadingLabel}
        </p>
      </div>
    )
  }

  if (state === 'empty') {
    return (
      <div className="flex animate-fade-in flex-col items-center justify-center gap-3 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink/6 text-ink/45 dark:bg-bone/8 dark:text-bone/45">
          <EmptyIcon size={20} aria-hidden="true" />
        </span>
        <p className="font-display text-sm font-medium text-ink dark:text-bone">{emptyTitle}</p>
        <p className="max-w-[240px] text-xs leading-relaxed text-ink/55 dark:text-bone/55">{emptyBody}</p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex animate-fade-in flex-col items-center justify-center gap-3 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-vermilion/10 text-vermilion">
          <AlertTriangle size={20} aria-hidden="true" />
        </span>
        <p className="max-w-[260px] text-sm text-ink dark:text-bone" role="alert">
          {errorMessage ?? 'Something went wrong.'}
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-vermilion px-4 py-1.5 text-xs font-semibold text-bone transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-bone dark:focus-visible:ring-offset-ink"
          >
            Retry
          </button>
        ) : null}
      </div>
    )
  }

  return <>{children}</>
}
