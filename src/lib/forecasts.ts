import { SYNTHETIC_DISCLAIMER } from '../data/synthetic'
import type {
  Bar,
  DetectedMove,
  DuringForecast,
  DuringOutcome,
  OnsetForecast,
  Story,
} from '../data/types'
import { onsetEligibleStories, visibleStories } from './cutoff'
import { SCRIPTED_MOVES, moveContaining } from './moves'

const ONSET_HORIZON = 10

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

function realizedVol(bars: Bar[], t: number, lookback: number): number {
  const start = Math.max(1, t - lookback + 1)
  let sum = 0
  let n = 0
  for (let i = start; i <= t; i++) {
    const a = bars[i - 1]
    const b = bars[i]
    if (!a || !b) continue
    sum += Math.abs(Math.log(b.close / a.close))
    n++
  }
  return n ? sum / n : 0
}

function volumeZ(bars: Bar[], t: number, lookback: number): number {
  const slice = bars.slice(Math.max(0, t - lookback + 1), t + 1)
  if (slice.length < 2) return 0
  const mean = slice.reduce((s, b) => s + b.volume, 0) / slice.length
  const v = bars[t]?.volume ?? mean
  const var_ =
    slice.reduce((s, b) => s + (b.volume - mean) ** 2, 0) / slice.length
  const sd = Math.sqrt(var_) || 1
  return (v - mean) / sd
}

/**
 * Baseline onset score: price/volume only.
 * News-aware: adds heuristic from pre-move / quiet stories available at t.
 * Mid-move and later stories are excluded even if somehow visible.
 */
export function onsetForecast(
  bars: Bar[],
  stories: Story[],
  t: number,
  disclaimer: string = SYNTHETIC_DISCLAIMER,
): OnsetForecast {
  const vol = realizedVol(bars, t, 10)
  const vz = volumeZ(bars, t, 20)
  const baseline = clamp01(0.15 + vol * 18 + Math.max(0, vz) * 0.05)

  const eligible = onsetEligibleStories(stories, t)
  const tagBoost =
    eligible.filter((s) => s.tags.includes('expectation') || s.tags.includes('surprise'))
      .length * 0.08
  const correctionPenalty = eligible.some((s) => s.kind === 'correction') ? -0.05 : 0
  const newsAware = clamp01(baseline + tagBoost + correctionPenalty)

  const inputsChanged: string[] = []
  if (Math.abs(newsAware - baseline) > 1e-6) {
    inputsChanged.push(
      ...eligible.map((s) => `${s.id}@v${s.version}`),
      'tags:expectation|surprise',
    )
  }

  // Sanity: never let mid/post stories influence this number
  const leaked = visibleStories(stories, t).filter(
    (s) => s.narrativeRole === 'mid_move' || s.narrativeRole === 'post_move',
  )
  if (leaked.length && inputsChanged.some((x) => leaked.some((s) => x.startsWith(s.id)))) {
    throw new Error('Onset forecast leaked mid/post-move story')
  }

  return {
    t,
    baseline,
    newsAware,
    inputsChanged: [...new Set(inputsChanged)],
    disclaimer,
  }
}

export function willOnsetWithinHorizon(
  t: number,
  horizon = ONSET_HORIZON,
): boolean {
  return SCRIPTED_MOVES.some((m) => m.onsetT > t && m.onsetT <= t + horizon)
}

/**
 * During-move forecast from checkpoint (first bar after threshold / onset).
 * Uses only facts available at checkpoint — not later tape or late stories.
 */
export function duringForecast(
  bars: Bar[],
  stories: Story[],
  checkpointT: number,
  moves: DetectedMove[] = SCRIPTED_MOVES,
  disclaimer: string = SYNTHETIC_DISCLAIMER,
): DuringForecast {
  const move =
    moveContaining(checkpointT, moves) ?? moves.find((m) => m.onsetT === checkpointT)
  const visible = visibleStories(stories, checkpointT)
  const mid = visible.filter((s) => s.narrativeRole === 'mid_move')

  // Baseline uses only pre-checkpoint momentum (no look-ahead into the outcome window).
  const dir = move?.direction ?? 1
  const pre = bars.slice(Math.max(0, checkpointT - 5), checkpointT + 1)
  let preSigned = 0
  for (let i = 1; i < pre.length; i++) {
    preSigned += Math.sign(pre[i]!.close - pre[i - 1]!.close) === dir ? 1 : -1
  }
  const baseline: DuringOutcome =
    preSigned >= 2 ? 'continuation' : preSigned <= -1 ? 'reversal' : 'stall'

  let newsAware: DuringOutcome = baseline
  const inputsChanged: string[] = []
  if (mid.some((s) => s.tags.includes('disagreement'))) {
    newsAware = baseline === 'continuation' ? 'stall' : baseline
    inputsChanged.push(...mid.map((s) => s.id), 'tag:disagreement')
  }
  if (mid.some((s) => s.tags.includes('momentum')) && newsAware === 'stall') {
    newsAware = 'continuation'
    inputsChanged.push('tag:momentum')
  }

  return {
    checkpointT,
    baseline,
    newsAware,
    inputsChanged: [...new Set(inputsChanged)],
    disclaimer,
  }
}
