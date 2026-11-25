import type { AlertSeed } from '../data/types'
import { fireAlerts } from '../lib/alerts'

interface Props {
  seeds: AlertSeed[]
  t: number
  onJump: (fireAt: number) => void
}

export function Inbox({ seeds, t, onJump }: Props) {
  const fired = fireAlerts(seeds, t)
  const active = fired.filter((a) => !a.suppressedDuplicate)
  const suppressed = fired.filter((a) => a.suppressedDuplicate)

  return (
    <div className="sr-solo">
      <div className="sr-solo-banner">
        <h2>Alert inbox</h2>
        <span className="sr-badge">Simulated</span>
      </div>
      <p className="sr-help">
        In-app only for now. Tap an alert to jump the replay to when it fired. Duplicate coverage
        of the same event is suppressed.
      </p>

      {active.length === 0 ? (
        <p className="sr-empty">
          No alerts yet at day {t}. Jump ahead in Replay, or keep playing.
        </p>
      ) : (
        <ul className="sr-inbox-list">
          {active.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => onJump(a.fireAt)}>
                {a.title}
              </button>
              <div className="sr-meta">
                <span className="sr-chip">{a.severity}</span>
                <span className="sr-chip">fired day {a.fireAt}</span>
              </div>
              <button
                type="button"
                className="sr-jump-inline"
                onClick={() => onJump(a.fireAt)}
              >
                Jump to fire time →
              </button>
            </li>
          ))}
        </ul>
      )}

      {suppressed.length > 0 && (
        <>
          <p className="sr-help" style={{ marginTop: '1.25rem' }}>
            Suppressed duplicates
          </p>
          <ul className="sr-inbox-list">
            {suppressed.map((a) => (
              <li key={a.id} className="sr-suppressed">
                <strong>{a.title}</strong>
                <div className="sr-meta">
                  <span className="sr-chip">day {a.fireAt}</span>
                  <span className="sr-chip">same event — not fired twice</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
