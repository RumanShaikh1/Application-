import { useId, useMemo } from 'react'
import type { SandboxDailyClose, StockAnalysisCheckpoint } from '@shared/types'
import { formatPrice } from '../lib/formatStats'

interface SandboxPriceChartProps {
  priceSeries: SandboxDailyClose[]
  /** Optional - marks the authored checkpoints on the real line, when analysis exists for this stock. */
  checkpoints?: StockAnalysisCheckpoint[]
}

const VIEW_WIDTH = 640
const VIEW_HEIGHT = 200
const PAD_X = 8
const PAD_TOP = 12
const PAD_BOTTOM = 24

/**
 * The real, full price window for one stock - not a decorative sparkline
 * (see MiniSparkline for that). Lives on the modal's normal surface color,
 * not a fixed-dark "terminal" card like ScenarioChart, since this is
 * presenting objective historical data, not a Decision Replay chart moment.
 */
export default function SandboxPriceChart({ priceSeries, checkpoints = [] }: SandboxPriceChartProps) {
  const gradientId = useId()

  const chart = useMemo(() => {
    if (priceSeries.length < 2) return null
    const closes = priceSeries.map((point) => point.close)
    const min = Math.min(...closes)
    const max = Math.max(...closes)
    const span = Math.max(max - min, 0.0001)
    const lastDay = priceSeries[priceSeries.length - 1].day

    const plotWidth = VIEW_WIDTH - PAD_X * 2
    const plotHeight = VIEW_HEIGHT - PAD_TOP - PAD_BOTTOM
    const toX = (day: number): number => PAD_X + (day / Math.max(lastDay, 1)) * plotWidth
    const toY = (close: number): number => PAD_TOP + plotHeight - ((close - min) / span) * plotHeight

    const linePath = priceSeries.map((point, i) => `${i === 0 ? 'M' : 'L'} ${toX(point.day).toFixed(2)} ${toY(point.close).toFixed(2)}`).join(' ')
    const baselineY = VIEW_HEIGHT - PAD_BOTTOM
    const areaPath = `${linePath} L ${toX(lastDay).toFixed(2)} ${baselineY} L ${toX(0).toFixed(2)} ${baselineY} Z`
    const isUp = closes[closes.length - 1] >= closes[0]

    const markers = checkpoints.map((checkpoint) => ({ ...checkpoint, x: toX(checkpoint.day), y: toY(checkpoint.close) }))

    return { linePath, areaPath, isUp, min, max, markers }
  }, [priceSeries, checkpoints])

  if (!chart) {
    return <p className="py-8 text-center text-sm text-ink/45">No price data available for this stock.</p>
  }

  const trendClass = chart.isUp ? 'text-lime' : 'text-vermilion'
  const first = priceSeries[0]
  const last = priceSeries[priceSeries.length - 1]

  return (
    <div>
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className="w-full" role="img" aria-label={`Price chart from ${first.date} to ${last.date}, ranging from ${formatPrice(chart.min)} to ${formatPrice(chart.max)}`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className={trendClass} stopColor="currentColor" stopOpacity={0.18} />
            <stop offset="100%" className={trendClass} stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        <line x1={PAD_X} y1={VIEW_HEIGHT - PAD_BOTTOM} x2={VIEW_WIDTH - PAD_X} y2={VIEW_HEIGHT - PAD_BOTTOM} className="stroke-ink/10" strokeWidth={1} />
        <path d={chart.areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <path d={chart.linePath} fill="none" className={trendClass} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {chart.markers.map((marker) => (
          <circle key={marker.label} cx={marker.x} cy={marker.y} r={3.5} className="fill-cobalt stroke-surface" strokeWidth={1.5} />
        ))}
        <text x={PAD_X} y={VIEW_HEIGHT - 6} className="fill-ink/45" fontSize={11}>
          {first.date}
        </text>
        <text x={VIEW_WIDTH - PAD_X} y={VIEW_HEIGHT - 6} textAnchor="end" className="fill-ink/45" fontSize={11}>
          {last.date}
        </text>
      </svg>
      <div className="mt-1 flex justify-between text-xs text-ink/45">
        <span>Low {formatPrice(chart.min)}</span>
        <span>High {formatPrice(chart.max)}</span>
      </div>
    </div>
  )
}
