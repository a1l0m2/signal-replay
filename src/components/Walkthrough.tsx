import { useEffect, useState } from 'react'

const STORAGE_KEY = 'sr-walkthrough-v1-done'

export const WALKTHROUGH_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Signal Replay',
    body: 'A Tideglass research demo: scrub history with a cutoff, inspect catalysts around large moves, and glance at a delayed live quote. Not a forecast product.',
  },
  {
    id: 'datasets',
    title: 'Four datasets',
    body: 'SYN (scripted M1) · SPY validation pilot · Powered panel (SPY + open news) · Multi-asset (FX, crypto, stocks, ETFs, commodities). Switch anytime from Dataset.',
  },
  {
    id: 'replay',
    title: 'Historical Replay',
    body: 'Replay is frozen pack history. The scrubber defines what was knowable “now.” Markers and news only appear when firstAvailableAt ≤ cutoff — no hindsight.',
  },
  {
    id: 'catalysts',
    title: 'Catalysts mode',
    body: 'Analysis around large bullish/bearish moves: before / during / after windows. Lean is heuristic (EDGAR material event, GDELT tone). Catalyst-free moves are valid — especially sparse FX.',
  },
  {
    id: 'live',
    title: 'Live tape ≠ history',
    body: 'Live tape is a separate delayed Yahoo public chart (often ~15m for US equities; crypto nearer continuous). It never rewrites historical bars, moves, or catalysts. Pause Auto anytime.',
  },
  {
    id: 'multi',
    title: 'Multi-asset filters',
    body: 'On Multi-asset, pick Class then Symbol. Catalysts and Live follow the selected name. Open/free data only — gaps (gold/silver/FX) stay honest.',
  },
] as const

interface Props {
  open: boolean
  onClose: () => void
}

export function Walkthrough({ open, onClose }: Props) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  if (!open) return null

  const cur = WALKTHROUGH_STEPS[step]!
  const last = step >= WALKTHROUGH_STEPS.length - 1

  const finish = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    onClose()
  }

  return (
    <div className="sr-wt-backdrop" role="presentation" onClick={finish}>
      <div
        className="sr-wt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sr-wt-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="sr-wt-kicker">
          First-run guide · {step + 1}/{WALKTHROUGH_STEPS.length}
        </p>
        <h2 id="sr-wt-title">{cur.title}</h2>
        <p className="sr-help">{cur.body}</p>
        <div className="sr-wt-dots" aria-hidden>
          {WALKTHROUGH_STEPS.map((s, i) => (
            <span key={s.id} className={i === step ? 'on' : ''} />
          ))}
        </div>
        <div className="sr-wt-actions">
          <button type="button" className="sr-jump-inline" onClick={finish}>
            Skip
          </button>
          <div className="sr-wt-nav">
            <button
              type="button"
              className="sr-jump-inline"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Back
            </button>
            {last ? (
              <button type="button" className="sr-wt-primary" onClick={finish}>
                Start exploring
              </button>
            ) : (
              <button
                type="button"
                className="sr-wt-primary"
                onClick={() => setStep((s) => s + 1)}
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function shouldAutoOpenWalkthrough(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '1'
  } catch {
    return true
  }
}
