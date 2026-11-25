/**
 * FROZEN feature definitions for the validation pilot.
 * Do not change after looking at test lift — see validation-pilot-report.md §2.
 */
import type { Bar, Story } from '../data/types'
import { onsetEligibleStories } from './cutoff'

export const ONSET_HORIZON = 10

export const BASELINE_FEATURE_NAMES = [
  'rv10',
  'vol_z20',
  'abs_ret5',
  'abs_ret1',
] as const

export const NEWS_FEATURE_NAMES = [
  'n_expect',
  'n_surprise',
  'has_correction',
  'recency',
] as const

export type BaselineFeatures = Record<(typeof BASELINE_FEATURE_NAMES)[number], number>
export type NewsFeatures = Record<(typeof NEWS_FEATURE_NAMES)[number], number>
export type AllFeatures = BaselineFeatures & NewsFeatures

function logReturn(a: number, b: number): number {
  return Math.log(b / a)
}

export function baselineFeatures(bars: Bar[], t: number): BaselineFeatures {
  const rv10 = meanAbsRet(bars, t, 10)
  const vol_z20 = volumeZ(bars, t, 20)
  const abs_ret5 = t >= 5 ? Math.abs(logReturn(bars[t - 5]!.close, bars[t]!.close)) : 0
  const abs_ret1 = t >= 1 ? Math.abs(logReturn(bars[t - 1]!.close, bars[t]!.close)) : 0
  return { rv10, vol_z20, abs_ret5, abs_ret1 }
}

export function newsFeatures(stories: Story[], t: number): NewsFeatures {
  const eligible = onsetEligibleStories(stories, t)
  const n_expect = eligible.filter((s) => s.tags.includes('expectation')).length
  const n_surprise = eligible.filter((s) => s.tags.includes('surprise')).length
  const has_correction = eligible.some(
    (s) => s.kind === 'correction' || s.kind === 'revision',
  )
    ? 1
    : 0
  let recency = 0
  if (eligible.length) {
    const latest = Math.max(...eligible.map((s) => s.firstAvailableAt))
    const days = Math.max(0, t - latest)
    recency = Math.exp(-days / 10)
  }
  return { n_expect, n_surprise, has_correction, recency }
}

export function allFeatures(bars: Bar[], stories: Story[], t: number): AllFeatures {
  return { ...baselineFeatures(bars, t), ...newsFeatures(stories, t) }
}

/** Guard: news features must ignore mid/post even if present in corpus at t. */
export function assertNoMidPostInNewsFeatures(stories: Story[], t: number): void {
  const eligible = onsetEligibleStories(stories, t)
  if (eligible.some((s) => s.narrativeRole === 'mid_move' || s.narrativeRole === 'post_move')) {
    throw new Error('Feature freeze violated: mid/post story in onset-eligible set')
  }
}

function meanAbsRet(bars: Bar[], t: number, lookback: number): number {
  const start = Math.max(1, t - lookback + 1)
  let sum = 0
  let n = 0
  for (let i = start; i <= t; i++) {
    sum += Math.abs(logReturn(bars[i - 1]!.close, bars[i]!.close))
    n++
  }
  return n ? sum / n : 0
}

function volumeZ(bars: Bar[], t: number, lookback: number): number {
  const slice = bars.slice(Math.max(0, t - lookback + 1), t + 1)
  if (slice.length < 2) return 0
  const mean = slice.reduce((s, b) => s + b.volume, 0) / slice.length
  const v = bars[t]!.volume
  const variance = slice.reduce((s, b) => s + (b.volume - mean) ** 2, 0) / slice.length
  const sd = Math.sqrt(variance) || 1
  return (v - mean) / sd
}
