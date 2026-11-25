import type { Story } from '../data/types'
import { latestVersionsAsOf, versionsAsOf } from '../lib/cutoff'
import { StorySummary } from './StorySummary'

interface Props {
  stories: Story[]
  t: number
  selectedId: string | null
  onSelect: (id: string) => void
}

export function NewsPanel({ stories, t, selectedId, onSelect }: Props) {
  const visible = versionsAsOf(stories, t)
  const heads = latestVersionsAsOf(stories, t)
  const selected = stories.find((s) => s.id === selectedId) ?? null
  const selectedVisible = selected && selected.firstAvailableAt <= t ? selected : null

  return (
    <section className="sr-section" aria-labelledby="news-heading">
      <h2 id="news-heading">News known now</h2>
      <p className="sr-help">
        Only stories first available by day {t}. Published date can be earlier — that does not
        make them knowable sooner. Click a marker on the chart or a row below. Summaries are 1–2
        offline paragraphs from title, source text, tags, tone, and filing fields — not an LLM,
        and not invented causes.
      </p>

      {visible.length === 0 ? (
        <p className="sr-empty">Nothing in the feed yet. Play or jump forward.</p>
      ) : (
        <ul className="sr-news-list">
          {visible.map((s) => {
            const isHead = heads.some((h) => h.id === s.id)
            return (
              <li key={`${s.id}-${s.version}`} className={selectedId === s.id ? 'selected' : ''}>
                <button type="button" onClick={() => onSelect(s.id)}>
                  <strong>
                    {s.headline}
                    {!isHead ? ' · older version' : ''}
                  </strong>
                  <StorySummary story={s} />
                  <div className="sr-meta">
                    <span className="sr-chip">{s.kind}</span>
                    <span className="sr-chip">v{s.version}</span>
                    <span className="sr-chip">available day {s.firstAvailableAt}</span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {selectedVisible && (
        <div className="sr-detail">
          <strong>{selectedVisible.headline}</strong>
          <StorySummary story={selectedVisible} label="Summary" />
          <p className="sr-help" style={{ marginTop: '0.55rem' }}>
            Raw body (provenance):
          </p>
          <p>{selectedVisible.body}</p>
          <div className="sr-meta">
            <span className="sr-chip">{selectedVisible.source ?? 'story'}</span>
            <span className="sr-chip">{selectedVisible.tags.join(' · ')}</span>
            <span className="sr-chip">
              published day {selectedVisible.publishedAt}
            </span>
            <span className="sr-chip">
              first available day {selectedVisible.firstAvailableAt}
            </span>
          </div>
        </div>
      )}
    </section>
  )
}
