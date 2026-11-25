import type { LiveQuote, LiveQuoteError } from '../lib/realtime/types'

interface Props {
  symbol: string
  quote: LiveQuote | null
  error: LiveQuoteError | null
  loading: boolean
  liveOn: boolean
  onToggle: (on: boolean) => void
  onRefresh: () => void
  pollMs: number
}

function fmtPrice(n: number, currency: string | null): string {
  const abs = Math.abs(n)
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6
  const body = n.toLocaleString(undefined, {
    minimumFractionDigits: Math.min(2, digits),
    maximumFractionDigits: digits,
  })
  return currency ? `${body} ${currency}` : body
}

function fmtTime(unixSec: number): string {
  try {
    return new Date(unixSec * 1000).toLocaleString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return String(unixSec)
  }
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const w = 120
  const h = 28
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / span) * (h - 2) - 1
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const up = values[values.length - 1]! >= values[0]!
  return (
    <svg className="sr-live-spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden>
      <polyline
        fill="none"
        stroke={up ? 'var(--cyan)' : 'var(--sand)'}
        strokeWidth="1.6"
        points={pts}
      />
    </svg>
  )
}

export function LiveTape({
  symbol,
  quote,
  error,
  loading,
  liveOn,
  onToggle,
  onRefresh,
  pollMs,
}: Props) {
  const ch = quote?.change
  const chPct = quote?.changePct
  const up = ch != null ? ch >= 0 : null

  return (
    <section
      className={`sr-live${liveOn ? '' : ' is-off'}`}
      aria-label="Near-real-time quote"
      data-live={liveOn ? 'on' : 'off'}
    >
      <div className="sr-live-top">
        <div className="sr-live-title">
          <span className="sr-live-dot" data-on={liveOn && !error ? '1' : '0'} aria-hidden />
          <strong>Live tape</strong>
          <span className="sr-chip">{symbol}</span>
          <span className={`sr-live-state ${liveOn ? 'on' : 'off'}`}>
            {liveOn ? 'LIVE ON' : 'LIVE OFF'}
          </span>
          <span className="sr-badge">Yahoo delayed · not licensed RT</span>
        </div>
        <div className="sr-live-actions">
          <label className="sr-live-toggle">
            <input
              type="checkbox"
              checked={liveOn}
              onChange={(e) => onToggle(e.target.checked)}
              aria-label="Enable live refresh"
            />
            Auto {Math.round(pollMs / 1000)}s
          </label>
          <button
            type="button"
            className="sr-jump-inline"
            onClick={onRefresh}
            disabled={!liveOn || loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <p className="sr-live-sep">
        Separate from historical Replay/Catalysts below — delayed Yahoo quote only; never rewrites
        frozen packs.
      </p>

      {liveOn && quote && (
        <div className="sr-live-body">
          <div className="sr-live-price">
            <span className="sr-live-last">{fmtPrice(quote.price, quote.currency)}</span>
            {ch != null && chPct != null && (
              <span className={`sr-live-chg ${up ? 'up' : 'down'}`}>
                {up ? '+' : ''}
                {ch.toFixed(4)} ({up ? '+' : ''}
                {chPct.toFixed(2)}%)
              </span>
            )}
          </div>
          <Spark values={quote.spark} />
          <div className="sr-meta">
            <span className="sr-chip">market {fmtTime(quote.marketTime)}</span>
            <span className="sr-chip">fetched {new Date(quote.fetchedAt).toLocaleTimeString()}</span>
            {quote.instrumentType && <span className="sr-chip">{quote.instrumentType}</span>}
            {quote.exchangeTz && <span className="sr-chip">{quote.exchangeTz}</span>}
          </div>
          <p className="sr-help" style={{ marginTop: '0.35rem' }}>
            {quote.delayLabel}
          </p>
        </div>
      )}

      {liveOn && !quote && !error && (
        <p className="sr-help">{loading ? 'Fetching delayed Yahoo quote…' : 'Waiting for quote…'}</p>
      )}

      {liveOn && error && (
        <p className="sr-help" role="alert">
          Live unavailable: {error.message}
        </p>
      )}

      {!liveOn && (
        <p className="sr-help sr-live-off-msg">
          Live refresh is off. You are viewing <strong>historical</strong> Replay / Catalysts only
          (frozen open packs). Turn Auto on for a delayed Yahoo glance — still not licensed
          real-time.
        </p>
      )}
    </section>
  )
}
