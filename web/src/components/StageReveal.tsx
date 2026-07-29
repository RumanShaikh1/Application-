import { BarChart3, FileText, Newspaper, TrendingUp, type LucideIcon } from 'lucide-react'
import type { ScenarioStage } from '@shared/types'

interface StageRevealProps {
  stage: ScenarioStage
}

const KIND_META: Record<ScenarioStage['kind'], { icon: LucideIcon; label: string }> = {
  headline: { icon: Newspaper, label: 'Headline' },
  filing: { icon: FileText, label: 'Filing' },
  fundamentals: { icon: BarChart3, label: 'Fundamentals' },
  price: { icon: TrendingUp, label: 'Price update' }
}

export default function StageReveal({ stage }: StageRevealProps) {
  const { icon: Icon, label } = KIND_META[stage.kind]

  return (
    <div className="animate-fade-in rounded-2xl border border-ink/10 bg-surface p-4 shadow-liftedSm">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink/45">
        <Icon size={14} aria-hidden="true" />
        {label}
      </div>

      {stage.kind === 'headline' && stage.headline ? <p className="font-display text-base font-medium leading-snug text-ink">{stage.headline}</p> : null}

      {stage.kind === 'filing' && stage.filingSummary ? <p className="text-sm leading-relaxed text-ink/80">{stage.filingSummary}</p> : null}

      {stage.kind === 'fundamentals' && stage.fundamentals ? (
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Object.entries(stage.fundamentals).map(([key, value]) => (
            <div key={key} className="rounded-xl bg-ink/[0.03] p-2.5">
              <dt className="text-xs text-ink/50">{key}</dt>
              <dd className="text-sm font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {stage.kind === 'price' ? (
        <p className="text-sm leading-relaxed text-ink/80">{stage.note ?? 'The price has moved since the last update.'}</p>
      ) : stage.note ? (
        <p className="mt-2 text-xs italic leading-relaxed text-ink/50">{stage.note}</p>
      ) : null}
    </div>
  )
}
