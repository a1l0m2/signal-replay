import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  fetchYahooLiveQuote,
  parseYahooChart,
  yahooChartUrl,
  YAHOO_PROXY_PREFIX,
} from '../src/lib/realtime/fetchYahoo'

describe('yahoo live quote (free delayed chart)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds same-origin proxy URL with encoded symbol', () => {
    const url = yahooChartUrl('EURUSD=X', { range: '1d', interval: '5m' })
    expect(url.startsWith(YAHOO_PROXY_PREFIX)).toBe(true)
    expect(url).toContain(encodeURIComponent('EURUSD=X'))
    expect(url).toContain('interval=5m')
  })

  it('parses Yahoo chart meta into a delayed LiveQuote', () => {
    const q = parseYahooChart('BTC-USD', {
      meta: {
        symbol: 'BTC-USD',
        regularMarketPrice: 60000,
        chartPreviousClose: 59000,
        regularMarketTime: 1_700_000_000,
        currency: 'USD',
        exchangeTimezoneName: 'UTC',
        instrumentType: 'CRYPTOCURRENCY',
      },
      timestamp: [1, 2, 3],
      indicators: { quote: [{ close: [59000, 59500, 60000] }] },
    })
    expect(q.price).toBe(60000)
    expect(q.change).toBe(1000)
    expect(q.changePct).toBeCloseTo(1000 / 59000 * 100, 5)
    expect(q.spark).toEqual([59000, 59500, 60000])
    expect(q.source).toBe('yahoo-chart-v8')
    expect(q.delayLabel.toLowerCase()).toContain('delayed')
  })

  it('fetchYahooLiveQuote uses proxy and maps JSON', async () => {
    const payload = {
      chart: {
        result: [
          {
            meta: {
              symbol: 'SPY',
              regularMarketPrice: 500,
              chartPreviousClose: 495,
              regularMarketTime: 1_700_000_100,
              currency: 'USD',
            },
            indicators: { quote: [{ close: [494, 498, 500] }] },
          },
        ],
      },
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    })
    vi.stubGlobal('fetch', fetchMock)

    const q = await fetchYahooLiveQuote('SPY')
    expect(fetchMock).toHaveBeenCalled()
    const calledUrl = String(fetchMock.mock.calls[0]?.[0])
    expect(calledUrl.startsWith('/api/yahoo/')).toBe(true)
    expect(q.symbol).toBe('SPY')
    expect(q.price).toBe(500)
  })

  it('surfaces honest error when proxy is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'not found',
      }),
    )
    await expect(fetchYahooLiveQuote('AAPL')).rejects.toThrow(/proxy/i)
  })
})
