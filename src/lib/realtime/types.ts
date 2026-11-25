export interface LiveQuote {
  symbol: string
  price: number
  previousClose: number | null
  change: number | null
  changePct: number | null
  /** Unix seconds from Yahoo meta.regularMarketTime */
  marketTime: number
  currency: string | null
  exchangeTz: string | null
  instrumentType: string | null
  /** Last N intraday closes for sparkline (5m) */
  spark: number[]
  fetchedAt: number
  source: 'yahoo-chart-v8'
  delayLabel: string
}

export interface LiveQuoteError {
  symbol: string
  message: string
  fetchedAt: number
}

export const YAHOO_DELAY_LABEL =
  'Yahoo public chart · typically delayed (US equity/ETF ~15m; crypto nearer continuous) — not licensed real-time'
