import type { BrokerageRule, ChargeLineItem, TaxRateSet, TaxTradeInput } from '../../../shared/types.js'

function computeBrokerage(turnover: number, rule: BrokerageRule): number {
  if (rule.useLowerOf) {
    return Math.min(rule.flatFeeRupees, turnover * rule.percentOfTurnover)
  }
  return rule.flatFeeRupees + turnover * rule.percentOfTurnover
}

/**
 * Itemised, per-leg transaction charges - brokerage, STT, exchange
 * transaction charge, SEBI turnover fee, stamp duty, GST. Every figure
 * comes from rateSet.transactionCharges; nothing here is a hardcoded
 * number. No rounding anywhere in this module - that happens at display
 * time only, so the reconciliation property (net proceeds = gross minus
 * every line, exactly) never drifts from float rounding done too early.
 */
export function computeCharges(trade: TaxTradeInput, rateSet: TaxRateSet): ChargeLineItem[] {
  const { tradeType, fnoInstrument, quantity, buyPrice, sellPrice } = trade
  const buyTurnover = buyPrice * quantity
  const sellTurnover = sellPrice * quantity
  const tc = rateSet.transactionCharges
  const charges: ChargeLineItem[] = []

  // Brokerage - one order per leg.
  const brokerageRule = tradeType === 'equity_delivery' ? tc.brokerage.delivery : tradeType === 'equity_intraday' ? tc.brokerage.intraday : tc.brokerage.fno
  const buyBrokerage = computeBrokerage(buyTurnover, brokerageRule)
  const sellBrokerage = computeBrokerage(sellTurnover, brokerageRule)
  charges.push({ id: 'brokerage_buy', label: 'Brokerage (buy)', leg: 'buy', amount: buyBrokerage })
  charges.push({ id: 'brokerage_sell', label: 'Brokerage (sell)', leg: 'sell', amount: sellBrokerage })

  // STT - which side(s) it applies to, and at what rate, depends entirely on trade type.
  let sttBuy = 0
  let sttSell = 0
  if (tradeType === 'equity_delivery') {
    sttBuy = buyTurnover * tc.stt.equityDeliveryBuyPercent
    sttSell = sellTurnover * tc.stt.equityDeliverySellPercent
  } else if (tradeType === 'equity_intraday') {
    sttSell = sellTurnover * tc.stt.equityIntradaySellPercent
  } else {
    sttSell = fnoInstrument === 'options' ? sellTurnover * tc.stt.optionsSellOnPremiumPercent : sellTurnover * tc.stt.futuresSellPercent
  }
  charges.push({ id: 'stt_buy', label: 'Securities Transaction Tax (buy)', leg: 'buy', amount: sttBuy })
  charges.push({ id: 'stt_sell', label: 'Securities Transaction Tax (sell)', leg: 'sell', amount: sttSell })

  // Exchange transaction charge - both legs.
  const exchangeRate =
    tradeType === 'fno'
      ? fnoInstrument === 'options'
        ? tc.exchangeTransactionChargePercent.optionsOnPremium
        : tc.exchangeTransactionChargePercent.futures
      : tc.exchangeTransactionChargePercent.equity
  const exchangeBuy = buyTurnover * exchangeRate
  const exchangeSell = sellTurnover * exchangeRate
  charges.push({ id: 'exchange_charge_buy', label: 'Exchange transaction charge (buy)', leg: 'buy', amount: exchangeBuy })
  charges.push({ id: 'exchange_charge_sell', label: 'Exchange transaction charge (sell)', leg: 'sell', amount: exchangeSell })

  // SEBI turnover fee - both legs.
  const sebiBuy = buyTurnover * tc.sebiTurnoverFeePercent
  const sebiSell = sellTurnover * tc.sebiTurnoverFeePercent
  charges.push({ id: 'sebi_fee_buy', label: 'SEBI turnover fee (buy)', leg: 'buy', amount: sebiBuy })
  charges.push({ id: 'sebi_fee_sell', label: 'SEBI turnover fee (sell)', leg: 'sell', amount: sebiSell })

  // Stamp duty - buy leg only, ad valorem on the buy-side transaction.
  const stampDutyRate =
    tradeType === 'equity_delivery'
      ? tc.stampDutyPercent.equityDeliveryBuy
      : tradeType === 'equity_intraday'
        ? tc.stampDutyPercent.equityIntradayBuy
        : fnoInstrument === 'options'
          ? tc.stampDutyPercent.optionsBuyOnPremium
          : tc.stampDutyPercent.futuresBuy
  charges.push({ id: 'stamp_duty_buy', label: 'Stamp duty (buy)', leg: 'buy', amount: buyTurnover * stampDutyRate })

  // GST - on brokerage + exchange charge + SEBI fee, per leg.
  const gstBuy = (buyBrokerage + exchangeBuy + sebiBuy) * tc.gstRateOnBrokerageAndFees
  const gstSell = (sellBrokerage + exchangeSell + sebiSell) * tc.gstRateOnBrokerageAndFees
  charges.push({ id: 'gst_buy', label: 'GST on charges (buy)', leg: 'buy', amount: gstBuy })
  charges.push({ id: 'gst_sell', label: 'GST on charges (sell)', leg: 'sell', amount: gstSell })

  return charges
}
