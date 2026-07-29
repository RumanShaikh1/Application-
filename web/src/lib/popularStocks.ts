/**
 * A curated, recognizable basket of large-cap Indian stocks shown as a
 * browsable grid on the trade ticket - so a newcomer can pick a company
 * they recognize instead of needing to already know its exchange ticker
 * (e.g. that Reliance trades as "RELIANCE.NS"). Purely a presentation list;
 * the Simulator still trades any real NSE/BSE symbol via the manual search
 * below the grid - this doesn't restrict what can be traded, only what's
 * offered as a one-tap shortcut.
 */
export interface PopularStock {
  symbol: string
  name: string
  /** Short (<=5 char) label for the monogram icon tile - not an official ticker, just a recognizable shorthand. */
  initials: string
  sector: string
}

export const POPULAR_STOCKS: PopularStock[] = [
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries', initials: 'RIL', sector: 'Energy' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', initials: 'HDFC', sector: 'Banking' },
  { symbol: 'ICICIBANK.NS', name: 'ICICI Bank', initials: 'ICICI', sector: 'Banking' },
  { symbol: 'INFY.NS', name: 'Infosys', initials: 'INFY', sector: 'IT Services' },
  { symbol: 'TCS.NS', name: 'Tata Consultancy Services', initials: 'TCS', sector: 'IT Services' },
  { symbol: 'LT.NS', name: 'Larsen & Toubro', initials: 'L&T', sector: 'Engineering' },
  { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel', initials: 'ARTL', sector: 'Telecom' },
  { symbol: 'ITC.NS', name: 'ITC', initials: 'ITC', sector: 'FMCG' },
  { symbol: 'SBIN.NS', name: 'State Bank of India', initials: 'SBI', sector: 'Banking' },
  { symbol: 'HINDUNILVR.NS', name: 'Hindustan Unilever', initials: 'HUL', sector: 'FMCG' },
  { symbol: 'KOTAKBANK.NS', name: 'Kotak Mahindra Bank', initials: 'KTAK', sector: 'Banking' },
  { symbol: 'AXISBANK.NS', name: 'Axis Bank', initials: 'AXIS', sector: 'Banking' },
  { symbol: 'BAJFINANCE.NS', name: 'Bajaj Finance', initials: 'BJFN', sector: 'Consumer Lending' },
  { symbol: 'MARUTI.NS', name: 'Maruti Suzuki', initials: 'MSIL', sector: 'Automobiles' },
  { symbol: 'SUNPHARMA.NS', name: 'Sun Pharmaceutical', initials: 'SUN', sector: 'Pharmaceuticals' },
  { symbol: 'TITAN.NS', name: 'Titan Company', initials: 'TTAN', sector: 'Jewellery & Watches' },
  { symbol: 'NTPC.NS', name: 'NTPC', initials: 'NTPC', sector: 'Power Generation' },
  { symbol: 'M&M.NS', name: 'Mahindra & Mahindra', initials: 'M&M', sector: 'Automobiles' },
  { symbol: 'ULTRACEMCO.NS', name: 'UltraTech Cement', initials: 'UTCM', sector: 'Cement' },
  { symbol: 'ASIANPAINT.NS', name: 'Asian Paints', initials: 'APNT', sector: 'Paints & Chemicals' }
]
