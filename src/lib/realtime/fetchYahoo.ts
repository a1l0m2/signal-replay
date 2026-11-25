import { YAHOO_DELAY_LABEL, type LiveQuote } from './types'

/** Same-origin proxy path — Vite forwards to query1.finance.yahoo.com */
export const YAHOO_PROXY_PREFIX = '/api/yahoo'

export function yahooChartUrl(
  symbol: string,
  opts: { range?: string; interval?: string } = {},
): string {
  const range = opts.range ?? '1d'
  const interval = opts.interval ?? '5m'
  const enc = encodeURIComponent(symbol)
  const qs = new URLSearchParams({ range, interval })
  return `${YAHOO_PROXY_PREFIX}/v8/finance/chart/${enc}?${qs.toString()}`
}

interface YahooChartJson {
  chart?: {
    result?: Array<{
      meta?: Record<string, unknown>
      timestamp?: number[]
      indicators?: { quote?: Array<Record<string, Array<number | null>>> }
    }>
    error?: { description?: string }
  }
}

/**
 * Fetch near-real-time (delayed) quote via local Yahoo proxy.
 * Does not touch historical Catalysts packs.
 */
export async function fetchYahooLiveQuote(
  symbol: string,
  init?: RequestInit,
): Promise<LiveQuote> {
  const url = yahooChartUrl(symbol)
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      res.status === 404
        ? `Live proxy missing (${res.status}). Run via npm run dev so /api/yahoo is available.`
        : `Yahoo live fetch failed (${res.status}): ${text.slice(0, 120)}`,
    )
  }
  const data = (await res.json()) as YahooChartJson
  if (data.chart?.error?.description) {
    throw new Error(data.chart.error.description)
  }
  const result = data.chart?.result?.[0]
  if (!result?.meta) {
    throw new Error('Yahoo chart returned no result')
  }
  return parseYahooChart(symbol, result)
}

export function parseYahooChart(
  symbol: string,
  result: {
    meta?: Record<string, unknown>
    timestamp?: number[]
    indicators?: { quote?: Array<Record<string, Array<number | null>>> }
  },
): LiveQuote {
  const meta = result.meta ?? {}
  const priceRaw = meta.regularMarketPrice ?? meta.chartPreviousClose
  const price = Number(priceRaw)
  if (!Number.isFinite(price)) {
    throw new Error('Yahoo meta missing regularMarketPrice')
  }
  const prevRaw = meta.chartPreviousClose ?? meta.previousClose
  const previousClose =
    prevRaw != null && Number.isFinite(Number(prevRaw)) ? Number(prevRaw) : null
  const change = previousClose != null ? price - previousClose : null
  const changePct =
    previousClose != null && previousClose !== 0 ? (change! / previousClose) * 100 : null
  const marketTime = Number(meta.regularMarketTime ?? 0)
  const closes = result.indicators?.quote?.[0]?.close ?? []
  const spark = closes.filter((c): c is number => c != null && Number.isFinite(c)).slice(-48)

  return {
    symbol: String(meta.symbol ?? symbol),
    price,
    previousClose,
    change,
    changePct,
    marketTime: Number.isFinite(marketTime) ? marketTime : Math.floor(Date.now() / 1000),
    currency: meta.currency != null ? String(meta.currency) : null,
    exchangeTz: meta.exchangeTimezoneName != null ? String(meta.exchangeTimezoneName) : null,
    instrumentType: meta.instrumentType != null ? String(meta.instrumentType) : null,
    spark,
    fetchedAt: Date.now(),
    source: 'yahoo-chart-v8',
    delayLabel: YAHOO_DELAY_LABEL,
  }
}
