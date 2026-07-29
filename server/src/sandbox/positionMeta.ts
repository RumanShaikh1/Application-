import type { SandboxPositionMeta, ThesisTag, TradeSide } from '../../../shared/types.js'

/**
 * Keeps SandboxPositionMeta in lockstep with the plain Portfolio.holdings
 * array applyTrade already produces - see shared/types.ts's comment on
 * SandboxPositionMeta for why this stays a parallel structure instead of
 * extending Holding.
 *
 * A position's entryDay/thesisTag are locked in on first entry and never
 * overwritten by a later add-on buy - "why did you first get into this"
 * should reflect the original decision, not the most recent one. Assumes
 * the caller already validated `thesisTag` is present for a genuinely new
 * position (the route does this before calling in).
 */
export function updatePositionMeta(
  current: SandboxPositionMeta[],
  symbol: string,
  side: TradeSide,
  day: number,
  thesisTag: ThesisTag | undefined,
  resultingQuantity: number
): SandboxPositionMeta[] {
  const existing = current.find((meta) => meta.symbol === symbol)

  if (side === 'buy') {
    if (existing) return current
    if (!thesisTag) throw new Error(`A thesisTag is required to open a new position in ${symbol}.`)
    return [...current, { symbol, entryDay: day, thesisTag }]
  }

  // sell
  if (resultingQuantity === 0) {
    return current.filter((meta) => meta.symbol !== symbol)
  }
  return current
}

export function findPositionMeta(metas: SandboxPositionMeta[], symbol: string): SandboxPositionMeta | undefined {
  return metas.find((meta) => meta.symbol === symbol)
}
