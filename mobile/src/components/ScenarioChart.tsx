import { useId, useMemo, useState } from 'react'
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native'
import { Text, View } from 'react-native'
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg'
import type { OHLCPoint } from '../../../shared/types'
import { formatDay, formatPrice } from '../lib/formatStats'
import { colors } from '../theme'

interface ScenarioChartProps {
  points: OHLCPoint[]
  /** If given, draws a vertical marker at this day - used on the Results screen to show where the decision was made. */
  decisionDay?: number
}

const VIEW_WIDTH = 340
const VIEW_HEIGHT = 200
const PAD_X = 8
const PAD_TOP = 20
const PAD_BOTTOM = 26

// Ported from web/src/components/ScenarioChart.tsx (itself adapted from
// extension/src/content/components/PriceChart.tsx) - same toX/toY math,
// react-native-svg elements instead of DOM <svg>. Rendered on an ink card,
// same reasoning as the web version: the trend colors are near-illegible
// against the bone page background.
export default function ScenarioChart({ points, decisionDay }: ScenarioChartProps) {
  const rawId = useId()
  const gradientId = `grad-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  // The Svg's viewBox is a fixed internal coordinate space (VIEW_WIDTH),
  // but it's scaled to whatever width it actually renders at on screen -
  // a touch's `locationX` arrives in that *rendered* pixel space, so it
  // has to be rescaled back into viewBox units before it means anything
  // to toX/toY below (the web version does the equivalent via
  // getBoundingClientRect since browsers don't give touch-relative coords
  // for free the way RN's GestureResponderEvent does).
  const [renderedWidth, setRenderedWidth] = useState(VIEW_WIDTH)

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
    return <Text className="py-10 text-center text-sm text-bone/50">No chart data available yet.</Text>
  }

  const { toX, toY, linePath, areaPath, isUp, minClose, maxClose, minDay, maxDay, baselineY, decisionX } = chart
  const trendColor = isUp ? colors.lime : colors.vermilion

  function handleTouch(event: GestureResponderEvent): void {
    const xInView = (event.nativeEvent.locationX / renderedWidth) * VIEW_WIDTH
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

  function handleLayout(event: LayoutChangeEvent): void {
    setRenderedWidth(event.nativeEvent.layout.width)
  }

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null
  const hoverX = hoverPoint ? toX(hoverPoint.day) : null
  const hoverY = hoverPoint ? toY(hoverPoint.close) : null

  return (
    <View>
      <Svg
        width="100%"
        height={VIEW_HEIGHT}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        onLayout={handleLayout}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onTouchEnd={() => setHoverIndex(null)}
        accessibilityRole="image"
        accessibilityLabel={`Price chart from ${formatDay(minDay)} to ${formatDay(maxDay)}, ranging from ${formatPrice(minClose)} to ${formatPrice(maxClose)}`}
      >
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={trendColor} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={trendColor} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        <Line x1={PAD_X} y1={baselineY} x2={VIEW_WIDTH - PAD_X} y2={baselineY} stroke={colors.bone} strokeOpacity={0.15} strokeWidth={1} />

        {decisionX !== null ? (
          <>
            <Line x1={decisionX} y1={PAD_TOP} x2={decisionX} y2={baselineY} stroke={colors.bone} strokeOpacity={0.4} strokeWidth={1} strokeDasharray="4 3" />
            <SvgText x={decisionX} y={PAD_TOP - 6} textAnchor="middle" fill={colors.bone} fillOpacity={0.6} fontSize={10}>
              Your decision
            </SvgText>
          </>
        ) : null}

        <Path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <Path d={linePath} fill="none" stroke={trendColor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {hoverX !== null && hoverY !== null ? (
          <>
            <Line x1={hoverX} y1={PAD_TOP} x2={hoverX} y2={baselineY} stroke={colors.bone} strokeOpacity={0.3} strokeWidth={1} strokeDasharray="2 2" />
            <Circle cx={hoverX} cy={hoverY} r={4} fill={trendColor} />
          </>
        ) : null}

        <SvgText x={PAD_X} y={VIEW_HEIGHT - 8} fill={colors.bone} fillOpacity={0.5} fontSize={11}>
          {formatDay(minDay)}
        </SvgText>
        <SvgText x={VIEW_WIDTH - PAD_X} y={VIEW_HEIGHT - 8} textAnchor="end" fill={colors.bone} fillOpacity={0.5} fontSize={11}>
          {formatDay(maxDay)}
        </SvgText>
      </Svg>

      {hoverPoint ? (
        <View className="mt-2 flex-row items-center">
          <Text className="text-sm font-semibold" style={{ color: trendColor }}>
            {formatPrice(hoverPoint.close)}
          </Text>
          <Text className="ml-2 text-sm text-bone/50">{formatDay(hoverPoint.day)}</Text>
        </View>
      ) : (
        <View className="mt-2 flex-row justify-between">
          <Text className="text-sm text-bone/50">
            Low <Text className="text-bone/80">{formatPrice(minClose)}</Text>
          </Text>
          <Text className="text-sm text-bone/50">
            High <Text className="text-bone/80">{formatPrice(maxClose)}</Text>
          </Text>
        </View>
      )}
    </View>
  )
}
