import { useId, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { OHLCPoint } from '@shared/types'
import { formatDay, formatPrice } from '../lib/formatStats'

interface ScenarioChartProps {
  points: OHLCPoint[]
  /** If given, draws a vertical marker at this day - used on the Results page to show where the decision was made. */
  decisionDay?: number
}

const VIEW_WIDTH = 640
const VIEW_HEIGHT = 220
const PAD_X = 8
const PAD_TOP = 20
const PAD_BOTTOM = 28

// Rendered on a fixed-dark (carbon) card - see the carbon-tinted wrapper in
// whichever page uses this - because the trend colors (lime / vermilion) are
// calibrated against a dark backdrop and stay legible in both light and dark
// page themes only if this card never flips. Adapted from
// extension/src/content/components/PriceChart.tsx: Day-N axis instead of
// real dates (scenarios are anonymised), plus an optional decision marker.
export default function ScenarioChart({ points, decisionDay }: ScenarioChartProps) {
  const gradientId = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const chart = useMemo(() => {
    if (points.length === 0) return null

    const closes = points.map((point) => point.close)
    const minClose = Math.min(...closes)
    const maxClose = Math.max(...closes)
    const closeSpan = Math.max(maxClose - minClose, 0.0001)

    const minDay = points[0].day
    const maxDay = points[points.length - 1].day
    const daySpan = Math.max(maxDay - minDay, 1)

    const plotWidth = VIEW_WIDTH - PAD_X * 2
    const plotHeight = VIEW_HEIGHT - PAD_TOP - PAD_BOTTOM

    const toX = (day: number): number => PAD_X + ((day - minDay) / daySpan) * plotWidth
    const toY = (close: number): number => PAD_TOP + plotHeight - ((close - minClose) / closeSpan) * plotHeight

    const linePath = points.map((point, i) => `${i === 0 ? 'M' : 'L'} ${toX(point.day).toFixed(2)} ${toY(point.close).toFixed(2)}`).join(' ')
    const baselineY = VIEW_HEIGHT - PAD_BOTTOM
    const areaPath = `${linePath} L ${toX(maxDay).toFixed(2)} ${baselineY} L ${toX(minDay).toFixed(2)} ${baselineY} Z`

    const isUp = points[points.length - 1].close >= points[0].close
    const decisionX = decisionDay !== undefined && decisionDay >= minDay && decisionDay <= maxDay ? toX(decisionDay) : null

    return { toX, toY, linePath, areaPath, isUp, minClose, maxClose, minDay, maxDay, baselineY, decisionX }
  }, [points, decisionDay])

  if (!chart || points.length === 0) {
    return <p className="py-10 text-center text-sm text-chalk/50">No chart data available yet.</p>
  }

  const { toX, toY, linePath, areaPath, isUp, minClose, maxClose, minDay, maxDay, baselineY, decisionX } = chart
  const trendClass = isUp ? 'text-lime' : 'text-vermilion'

  function handleMouseMove(event: ReactMouseEvent<SVGSVGElement>): void {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const xInView = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH

    let nearest = 0
    let nearestDistance = Infinity
    points.forEach((point, index) => {
      const distance = Math.abs(toX(point.day) - xInView)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearest = index
      }
    })
    setHoverIndex(nearest)
  }

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null
  const hoverX = hoverPoint ? toX(hoverPoint.day) : null
  const hoverY = hoverPoint ? toY(hoverPoint.close) : null

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Price chart from ${formatDay(minDay)} to ${formatDay(maxDay)}, ranging from ${formatPrice(minClose)} to ${formatPrice(maxClose)}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className={trendClass} stopColor="currentColor" stopOpacity={0.3} />
            <stop offset="100%" className={trendClass} stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>

        <line x1={PAD_X} y1={baselineY} x2={VIEW_WIDTH - PAD_X} y2={baselineY} className="stroke-chalk/15" strokeWidth={1} />

        {decisionX !== null ? (
          <g>
            <line x1={decisionX} y1={PAD_TOP} x2={decisionX} y2={baselineY} className="stroke-chalk/40" strokeWidth={1} strokeDasharray="4 3" />
            <text x={decisionX} y={PAD_TOP - 6} textAnchor="middle" className="fill-chalk/60" fontSize={11}>
              Your decision
            </text>
          </g>
        ) : null}

        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <path d={linePath} fill="none" className={trendClass} stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {hoverX !== null && hoverY !== null ? (
          <g>
            <line x1={hoverX} y1={PAD_TOP} x2={hoverX} y2={baselineY} className="stroke-chalk/30" strokeWidth={1} strokeDasharray="2 2" />
            <circle cx={hoverX} cy={hoverY} r={4} className={trendClass} fill="currentColor" />
          </g>
        ) : null}

        <text x={PAD_X} y={VIEW_HEIGHT - 8} className="fill-chalk/50" fontSize={11}>
          {formatDay(minDay)}
        </text>
        <text x={VIEW_WIDTH - PAD_X} y={VIEW_HEIGHT - 8} textAnchor="end" className="fill-chalk/50" fontSize={11}>
          {formatDay(maxDay)}
        </text>
      </svg>

      {hoverPoint ? (
        <div className={`mt-2 text-sm ${trendClass}`}>
          <span className="font-semibold tabular-nums">{formatPrice(hoverPoint.close)}</span>
          <span className="ml-2 text-chalk/50">{formatDay(hoverPoint.day)}</span>
        </div>
      ) : (
        <div className="mt-2 flex justify-between text-sm text-chalk/50">
          <span>
            Low <span className="text-chalk/80">{formatPrice(minClose)}</span>
          </span>
          <span>
            High <span className="text-chalk/80">{formatPrice(maxClose)}</span>
          </span>
        </div>
      )}
    </div>
  )
}
