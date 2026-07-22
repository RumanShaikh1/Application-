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
    <section className="border border-hairline border-ink/15 bg-bone">
      <header className="flex items-center justify-between gap-3 border-b border-hairline border-ink/15 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center ${iconClassName}`}>
            <Icon size={18} strokeWidth={2.25} />
          </span>
          <div>
            <h2 className="font-display text-[15px] font-medium tracking-tight text-ink">{title}</h2>
            {subtitle ? <p className="text-xs text-ink/60">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}
