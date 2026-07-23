import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface PanelProps {
  icon: LucideIcon
  iconClassName?: string
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
}

export default function Panel({
  icon: Icon,
  iconClassName = 'text-vermilion bg-vermilion/10',
  title,
  subtitle,
  action,
  children
}: PanelProps) {
  return (
    <section className="rounded-2xl border border-hairline border-ink/10 bg-bone shadow-soft dark:border-bone/10 dark:bg-ink dark:shadow-softDark">
      <header className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}>
            <Icon size={18} strokeWidth={2.25} />
          </span>
          <div>
            <h2 className="font-display text-[15px] font-medium tracking-tight text-ink dark:text-bone">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs leading-relaxed text-ink/55 dark:text-bone/55">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </header>
      <div className="px-5 pb-5">{children}</div>
    </section>
  )
}
