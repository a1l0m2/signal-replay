import type { Bar, DetectedMove, Story } from '../data/types'
import { duringForecast, onsetForecast } from '../lib/forecasts'
import { moveContaining } from '../lib/moves'

interface Props {
  bars: Bar[]
  stories: Story[]
  moves: DetectedMove[]
  disclaimer: string
  t: number
  mode: 'baseline' | 'news'
  onMode: (m: 'baseline' | 'news') => void
}

export function ForecastPanel({
  bars,
  stories,
  moves,
  disclaimer,
  t,
  mode,
  onMode,
}: Props) {
  const onset = onsetForecast(bars, stories, t, disclaimer)
  const inMove = moveContaining(t, moves)
  const checkpoint = inMove?.onsetT ?? moves[0]?.onsetT ?? t
  const during =
    inMove && t >= inMove.onsetT
      ? duringForecast(bars, stories, checkpoint, moves, disclaimer)
      : null

  const onsetValue = mode === 'baseline' ? onset.baseline : onset.newsAware
  const duringValue = during
    ? mode === 'baseline'
      ? during.baseline
      : during.newsAware
    : null

  return (
    <section className="sr-section" aria-labelledby="forecast-heading">
      <h2 id="forecast-heading">What might happen?</h2>
      <p className="sr-help">
        Demo scores only — compare two ways of guessing, not proof that news helps.{' '}
        <span
          className="sr-help"
          title="Before = chance a large move starts soon. During = after a move has begun, will it continue, reverse, or stall? After-action lives in its own mode and never feeds these scores."
        >
          Before vs during vs after
        </span>
      </p>

      <div className="sr-toggle" role="group" aria-label="Forecast inputs">
        <button
          type="button"
          className={mode === 'baseline' ? 'active' : ''}
          onClick={() => onMode('baseline')}
        >
          Price &amp; volume
          <small>Baseline — no news</small>
        </button>
        <button
          type="button"
          className={mode === 'news' ? 'active' : ''}
          onClick={() => onMode('news')}
        >
          News-aware
          <small>Adds stories known by now</small>
        </button>
      </div>

      <div className="sr-question">
        <div className="sr-q-label">
          <span>Before a move</span>
          <strong>{(onsetValue * 100).toFixed(0)}%</strong>
        </div>
        <p className="sr-q-plain">
          Chance an unusually large move <em>starts</em> within the next 10 days.
        </p>
        <div className="sr-bar" aria-hidden>
          <i style={{ width: `${Math.round(onsetValue * 100)}%` }} />
        </div>
        {mode === 'news' && (
          <p className="sr-inputs">
            Extra inputs:{' '}
            <code>
              {onset.inputsChanged.length
                ? onset.inputsChanged.join(', ')
                : 'none vs baseline'}
            </code>
          </p>
        )}
      </div>

      {during ? (
        <div className="sr-question">
          <div className="sr-q-label">
            <span>During a move</span>
            <strong>{duringValue}</strong>
          </div>
          <p className="sr-q-plain">
            From this checkpoint (day {during.checkpointT}): continue, reverse, or stall?
          </p>
          <div className="sr-bar" aria-hidden>
            <i
              style={{
                width:
                  duringValue === 'continuation'
                    ? '85%'
                    : duringValue === 'stall'
                      ? '50%'
                      : '30%',
              }}
            />
          </div>
          {mode === 'news' && (
            <p className="sr-inputs">
              Extra inputs:{' '}
              <code>
                {during.inputsChanged.length
                  ? during.inputsChanged.join(', ')
                  : 'none vs baseline'}
              </code>
            </p>
          )}
        </div>
      ) : (
        <div className="sr-question">
          <div className="sr-q-label">
            <span>During a move</span>
            <strong>—</strong>
          </div>
          <p className="sr-q-plain">
            Appears once price has crossed into a large move. Scrub into a shaded band to see
            it.
          </p>
        </div>
      )}
    </section>
  )
}
