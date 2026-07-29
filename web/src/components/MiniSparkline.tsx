import { useId, useMemo } from 'react'
import type { ChartPoint } from '@shared/types'

interface MiniSparklineProps {
  points: ChartPoint[]
}

const VIEW_WIDTH = 160
const VIEW_HEIGHT = 44
const PAD_Y = 4

/** A tiny, label-free trend line for the stock icon grid's cards - deliberately not ScenarioChart, which is built for a full price-history read, not a glanceable "which way has this been going" cue. */
export default function MiniSparkline({ points }: MiniSparklineProps) {
  const gradientId = useId()

  const chart = useMemo(() => {
    if (points.length < 2) return null
    const closes = points.map((point) => point.close)
    const min = Math.min(...closes)
    const max = Math.max(...closes)
    const span = Math.max(max - min, 0.0001)
    const plotHeight = VIEW_HEIGHT - PAD_Y * 2

    const toX = (index: number): number => (index / (points.length - 1)) * VIEW_WIDTH
    const toY = (close: number): number => PAD_Y + plotHeight - ((close - min) / span) * plotHeight

    const linePath = points.map((point, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(2)} ${toY(point.close).toFixed(2)}`).join(' ')
    const areaPath = `${linePath} L ${VIEW_WIDTH} ${VIEW_HEIGHT} L 0 ${VIEW_HEIGHT} Z`
    const isUp = closes[closes.length - 1] >= closes[0]

    return { linePath, areaPath, isUp }
  }, [points])

  if (!chart) {
    return <div className="h-11 w-full animate-pulse-soft rounded-lg bg-ink/5" aria-hidden="true" />
  }

  const trendClass = chart.isUp ? 'text-lime' : 'text-vermilion'

  return (
    <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className="h-11 w-full" role="presentation" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className={trendClass} stopColor="currentColor" stopOpacity={0.25} />
          <stop offset="100%" className={trendClass} stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={chart.areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <path d={chart.linePath} fill="none" className={trendClass} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
