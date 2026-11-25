import { useMemo, useState } from 'react'
import type { DetectedMove, Story } from '../data/types'
import {
  buildCatalystReports,
  type CatalystHit,
  type MoveCatalystReport,
} from '../lib/catalysts'

interface Props {
  stories: Story[]
  moves: DetectedMove[]
  onJump: (t: number) => void
  disclaimer: string
  symbolLabel?: string
  assetClassLabel?: string
}

const LEAN_LABEL: Record<string, string> = {
  bullish: 'Bullish lean',
  bearish: 'Bearish lean',
  unclear: 'Unclear',
  material_event: 'Material filing',
}

function HitList({
  title,
  hits,
  onJump,
}: {
  title: string
  hits: CatalystHit[]
  onJump: (t: number) => void
}) {
  if (!hits.length) {
    return (
      <p className="sr-help" style={{ marginTop: '0.35rem' }}>
        {title}: none in window
      </p>
    )
  }
  return (
    <div style={{ marginTop: '0.55rem' }}>
      <strong style={{ color: '#eef4f8', fontSize: '0.85rem' }}>{title}</strong>
      <ul className="sr-evidence-list">
        {hits.map((h) => (
          <li key={h.storyId}>
            <span className="sr-conn">{LEAN_LABEL[h.lean] ?? h.lean}</span>
            <strong style={{ display: 'block', color: '#eef4f8' }}>{h.headline}</strong>
            <p className="sr-summary">{h.summary}</p>
            <div className="sr-meta">
              <span className="sr-chip">{h.source}</span>
              <span className="sr-chip">available day {h.availableT}</span>
            </div>
            <p className="sr-help" style={{ marginTop: '0.25rem' }}>
              {h.note}
            </p>
            <button type="button" className="sr-jump-inline" onClick={() => onJump(h.availableT)}>
              Jump to availability →
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MoveCard({
  report,
  onJump,
}: {
  report: MoveCatalystReport
  onJump: (t: number) => void
}) {
  const m = report.move
  const dir = m.direction === 1 ? 'bullish tape' : 'bearish tape'
  return (
    <article className="sr-catalyst-card">
      <header className="sr-solo-banner" style={{ marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', color: '#f2f7fa' }}>
          {dir} · day {m.onsetT}→{m.endT}
        </h3>
        <button type="button" className="sr-jump-inline" onClick={() => onJump(m.onsetT)}>
          Jump to onset →
        </button>
      </header>
      <p className="sr-help">
        Peak |move| ≈ {((m.peakAbsReturn ?? 0) * 100).toFixed(1)}%. Catalysts use first-available
        time only. Timing ≠ causation.
      </p>
      {report.catalystFree && (
        <p className="sr-badge" style={{ marginTop: '0.5rem' }}>
          No catalyst in before/during window
        </p>
      )}
      <HitList title="Before onset" hits={report.before} onJump={onJump} />
      <HitList title="During move" hits={report.during} onJump={onJump} />
      <HitList title="After (may follow price)" hits={report.after} onJump={onJump} />
    </article>
  )
}

export function CatalystsView({
  stories,
  moves,
  onJump,
  disclaimer,
  symbolLabel,
  assetClassLabel,
}: Props) {
  const [filter, setFilter] = useState<'all' | 'with' | 'free'>('all')
  const reports = useMemo(() => buildCatalystReports(moves, stories, { limit: 50 }), [moves, stories])
  const shown = reports.filter((r) => {
    if (filter === 'with') return !r.catalystFree
    if (filter === 'free') return r.catalystFree
    return true
  })

  return (
    <div className="sr-solo">
      <div className="sr-solo-banner">
        <h2>Catalysts{symbolLabel ? ` · ${symbolLabel}` : ''}</h2>
        <span className="sr-badge">Analysis · not a forecast</span>
      </div>
      <p className="sr-help">
        {assetClassLabel ? `${assetClassLabel}. ` : ''}
        Earnings filings, open news, and topic proxies around large moves — bullish/bearish lean when
        the proxy allows it, otherwise unclear. FX/commodities use free GDELT GKG (+ topic proxies);
        still may be sparse — catalyst-free moves are valid. Historical pack only (Live tape is
        separate).
      </p>
      <div className="sr-toggle" style={{ margin: '0.85rem 0', maxWidth: '28rem' }} role="group">
        <button
          type="button"
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          All moves
          <small>Top |moves| in panel replay</small>
        </button>
        <button
          type="button"
          className={filter === 'with' ? 'active' : ''}
          onClick={() => setFilter('with')}
        >
          With catalysts
          <small>Something in before/during</small>
        </button>
        <button
          type="button"
          className={filter === 'free' ? 'active' : ''}
          onClick={() => setFilter('free')}
        >
          Catalyst-free
          <small>No before/during hits</small>
        </button>
      </div>

      <div className="sr-catalyst-stack">
        {shown.map((r) => (
          <MoveCard
            key={`${r.move.onsetT}-${r.move.endT}`}
            report={r}
            onJump={onJump}
          />
        ))}
        {!shown.length && <p className="sr-empty">No moves in this filter.</p>}
      </div>

      <p className="sr-footer" style={{ borderTop: 'none', marginTop: '1.25rem' }}>
        <strong>Research demo.</strong> {disclaimer}
      </p>
    </div>
  )
}
