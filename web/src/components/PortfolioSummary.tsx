import type { PortfolioValuation } from '@shared/types'
import { formatPercent, formatPrice } from '../lib/formatStats'

interface PortfolioSummaryProps {
  valuation: PortfolioValuation
}

export default function PortfolioSummary({ valuation }: PortfolioSummaryProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-ink/10 bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Total value</p>
          <p className="mt-1 font-display text-lg font-semibold text-ink">{formatPrice(valuation.totalValue)}</p>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Cash</p>
          <p className="mt-1 font-display text-lg font-semibold text-ink">{formatPrice(valuation.cashBalance)}</p>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Holdings</p>
          <p className="mt-1 font-display text-lg font-semibold text-ink">{formatPrice(valuation.holdingsValue)}</p>
        </div>
      </div>

      {valuation.positions.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-ink/10 bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
                  <th className="whitespace-nowrap px-4 py-2.5">Symbol</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Qty</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Avg cost</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Price</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Value</th>
                  <th className="whitespace-nowrap px-4 py-2.5">P&amp;L</th>
                  <th className="whitespace-nowrap px-4 py-2.5">% of portfolio</th>
                </tr>
              </thead>
              <tbody>
                {valuation.positions.map((position) => (
                  <tr key={position.symbol} className="border-b border-ink/5 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-ink">{position.symbol}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-ink/80">{position.quantity}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-ink/60">{formatPrice(position.averageCost)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-ink/80">{formatPrice(position.currentPrice)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-ink/80">{formatPrice(position.marketValue)}</td>
                    <td className={`whitespace-nowrap px-4 py-2.5 tabular-nums font-medium ${position.unrealizedPnLPercent >= 0 ? 'text-lime' : 'text-vermilion'}`}>
                      {formatPercent(position.unrealizedPnLPercent)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-ink/60">{position.percentOfPortfolio.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
