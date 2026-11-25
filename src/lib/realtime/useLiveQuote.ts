import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchYahooLiveQuote } from './fetchYahoo'
import type { LiveQuote, LiveQuoteError } from './types'

const DEFAULT_POLL_MS = 60_000

export function useLiveQuote(
  symbol: string | null,
  opts: { enabled?: boolean; pollMs?: number } = {},
) {
  const enabled = opts.enabled ?? true
  const pollMs = opts.pollMs ?? DEFAULT_POLL_MS
  const [quote, setQuote] = useState<LiveQuote | null>(null)
  const [error, setError] = useState<LiveQuoteError | null>(null)
  const [loading, setLoading] = useState(false)
  const [liveOn, setLiveOn] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    if (!symbol || !enabled || !liveOn) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setLoading(true)
    try {
      const q = await fetchYahooLiveQuote(symbol, { signal: ac.signal })
      if (ac.signal.aborted) return
      setQuote(q)
      setError(null)
    } catch (e) {
      if (ac.signal.aborted) return
      const message = e instanceof Error ? e.message : String(e)
      setError({ symbol, message, fetchedAt: Date.now() })
    } finally {
      if (!ac.signal.aborted) setLoading(false)
    }
  }, [symbol, enabled, liveOn])

  useEffect(() => {
    setQuote(null)
    setError(null)
  }, [symbol])

  useEffect(() => {
    if (!symbol || !enabled || !liveOn) return
    void refresh()
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      void refresh()
    }, pollMs)
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
      abortRef.current?.abort()
    }
  }, [symbol, enabled, liveOn, pollMs, refresh])

  return {
    quote,
    error,
    loading,
    liveOn,
    setLiveOn,
    refresh,
    pollMs,
  }
}
