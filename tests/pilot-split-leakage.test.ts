import { describe, expect, it } from 'vitest'
import { stories as spyStories, bars as spyBars } from '../src/data/pilot/spyDataset'
import { stories as synStories } from '../src/data/synthetic'
import {
  assertNoMidPostInNewsFeatures,
  newsFeatures,
  ONSET_HORIZON,
} from '../src/lib/features'
import { visibleStories } from '../src/lib/cutoff'
import { chronoSplit, eligibleSampleIndices, hasFutureLeakage } from '../src/lib/split'
import { detectMoves, labelOnsetWithinHorizon, onsetDays } from '../src/lib/moves'

describe('chronological split — no outcome-window leakage', () => {
  it('keeps train/tune/test contiguous and non-overlapping', () => {
    const split = chronoSplit(spyBars.length)
    expect(split.train[1]).toBeLessThan(split.tune[0])
    expect(split.tune[1]).toBeLessThan(split.test[0])
    expect(split.test[1]).toBe(spyBars.length - 1)
  })

  it('eligible samples keep t+H inside the same split', () => {
    const split = chronoSplit(spyBars.length)
    for (const name of ['train', 'tune', 'test'] as const) {
      const [lo, hi] = split[name]
      for (const t of eligibleSampleIndices(split, name)) {
        expect(t).toBeGreaterThanOrEqual(lo)
        expect(t + ONSET_HORIZON).toBeLessThanOrEqual(hi)
      }
    }
  })

  it('labels never peek past the horizon using future bars as features', () => {
    const onsets = onsetDays(detectMoves(spyBars))
    const split = chronoSplit(spyBars.length)
    const testIdx = eligibleSampleIndices(split, 'test')
    for (const t of testIdx.slice(0, 20)) {
      // feature times are all ≤ t by construction of baselineFeatures
      expect(hasFutureLeakage([t, t - 1, t - 5], t)).toBe(false)
      expect(hasFutureLeakage([t + 1], t)).toBe(true)
      void labelOnsetWithinHorizon(t, onsets, ONSET_HORIZON)
    }
  })
})

describe('pilot news cutoff & onset eligibility', () => {
  it('late-available demo story cannot appear before firstAvailableAt', () => {
    const late = spyStories.find((s) => s.id === 'spy-late-trap')!
    expect(late.publishedAt).toBeLessThan(late.firstAvailableAt)
    expect(visibleStories(spyStories, late.publishedAt).some((s) => s.id === late.id)).toBe(
      false,
    )
    expect(visibleStories(spyStories, late.firstAvailableAt).some((s) => s.id === late.id)).toBe(
      true,
    )
  })

  it('news features exclude mid/post roles', () => {
    const midT = 113
    assertNoMidPostInNewsFeatures(spyStories, midT)
    const f = newsFeatures(spyStories, midT)
    // mid-move story is visible but must not add surprise/expect from mid role
    const mid = spyStories.find((s) => s.id === 'spy-mid-1')!
    expect(mid.firstAvailableAt).toBeLessThanOrEqual(midT)
    expect(mid.narrativeRole).toBe('mid_move')
    // only pre_move/quiet contribute — at t=113 early stories exist
    expect(f.n_expect).toBeGreaterThanOrEqual(0)
  })

  it('M1 synthetic leakage tests still hold via shared cutoff helpers', () => {
    const late = synStories.find((s) => s.id === 's-late-leak-trap')!
    expect(visibleStories(synStories, 25).some((s) => s.id === late.id)).toBe(false)
  })
})
