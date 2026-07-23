import { useId, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { ChartPoint } from '@shared/types'
import { formatPrice } from '../../lib/formatStats'

interface PriceChartProps {
  points: ChartPoint[]
  currency: string
}

const VIEW_WIDTH = 320
const VIEW_HEIGHT = 150
const PAD_X = 6
const PAD_TOP = 10
const PAD_BOTTOM = 22

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Rendered on an ink (dark) surface - see StockDetail's "Price Chart" section -
// because the trend colors (lime / vermilion) are near-illegible against bone.
export default function PriceChart({ points, currency }: PriceChartProps) {
  const gradientId = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const chart = useMemo(() => {
    if (points.length === 0) return null

    const closes = points.map((p) => p.close)
    const minClose = Math.min(...closes)
    const maxClose = Math.max(...closes)
    const closeSpan = Math.max(maxClose - minClose, 0.0001)

    const minTime = points[0].timestamp
    const maxTime = points[points.length - 1].timestamp
    const timeSpan = Math.max(maxTime - minTime, 1)

    const plotWidth = VIEW_WIDTH - PAD_X * 2
    const plotHeight = VIEW_HEIGHT - PAD_TOP - PAD_BOTTOM

    const toX = (timestamp: number): number => PAD_X + ((timestamp - minTime) / timeSpan) * plotWidth
    const toY = (close: number): number => PAD_TOP + plotHeight - ((close - minClose) / closeSpan) * plotHeight

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.timestamp).toFixed(2)} ${toY(p.close).toFixed(2)}`).join(' ')
    const baselineY = VIEW_HEIGHT - PAD_BOTTOM
    const areaPath = `${linePath} L ${toX(maxTime).toFixed(2)} ${baselineY} L ${toX(minTime).toFixed(2)} ${baselineY} Z`

    const isUp = points[points.length - 1].close >= points[0].close

    return { toX, toY, linePath, areaPath, isUp, minClose, maxClose, minTime, maxTime, baselineY }
  }, [points])

  if (!chart || points.length === 0) {
    return <p className="py-6 text-center text-xs text-bone/50">No chart data available.</p>
  }

  const { toX, toY, linePath, areaPath, isUp, minClose, maxClose, minTime, maxTime, baselineY } = chart
  const trendClass = isUp ? 'text-lime' : 'text-vermilion'

  function handleMouseMove(event: ReactMouseEvent<SVGSVGElement>): void {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const xInView = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH

    let nearest = 0
    let nearestDistance = Infinity
    points.forEach((point, index) => {
      const distance = Math.abs(toX(point.timestamp) - xInView)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearest = index
      }
    })
    setHoverIndex(nearest)
  }

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null
  const hoverX = hoverPoint ? toX(hoverPoint.timestamp) : null
  const hoverY = hoverPoint ? toY(hoverPoint.close) : null

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Price chart from ${formatDate(minTime)} to ${formatDate(maxTime)}, ranging from ${formatPrice(minClose, currency)} to ${formatPrice(maxClose, currency)}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className={trendClass} stopColor="currentColor" stopOpacity={0.3} />
            <stop offset="100%" className={trendClass} stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Recessive baseline */}
        <line x1={PAD_X} y1={baselineY} x2={VIEW_WIDTH - PAD_X} y2={baselineY} className="stroke-bone/15" strokeWidth={1} />

        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <path d={linePath} fill="none" className={trendClass} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {hoverX !== null && hoverY !== null ? (
          <g>
            <line x1={hoverX} y1={PAD_TOP} x2={hoverX} y2={baselineY} className="stroke-bone/30" strokeWidth={1} strokeDasharray="2 2" />
            <circle cx={hoverX} cy={hoverY} r={3} className={trendClass} fill="currentColor" />
          </g>
        ) : null}

        <text x={PAD_X} y={VIEW_HEIGHT - 6} className="fill-bone/50" fontSize={9}>
          {formatDate(minTime)}
        </text>
        <text x={VIEW_WIDTH - PAD_X} y={VIEW_HEIGHT - 6} textAnchor="end" className="fill-bone/50" fontSize={9}>
          {formatDate(maxTime)}
        </text>
      </svg>

      {hoverPoint ? (
        <div className={`mt-1 text-[11px] ${trendClass}`}>
          <span className="font-semibold tabular-nums">{formatPrice(hoverPoint.close, currency)}</span>
          <span className="ml-1.5 text-bone/50">{formatDate(hoverPoint.timestamp)}</span>
        </div>
      ) : (
        <div className="mt-1 flex justify-between text-[11px] text-bone/50">
          <span>
            Low <span className="text-bone/80">{formatPrice(minClose, currency)}</span>
          </span>
          <span>
            High <span className="text-bone/80">{formatPrice(maxClose, currency)}</span>
          </span>
        </div>
      )}
    </div>
  )
}
