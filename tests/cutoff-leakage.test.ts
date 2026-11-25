import { describe, expect, it } from 'vitest'
import { stories } from '../src/data/synthetic'
import {
  latestVersionsAsOf,
  onsetEligibleStories,
  storyKnowableAt,
  visibleStories,
} from '../src/lib/cutoff'
import { onsetForecast } from '../src/lib/forecasts'
import { bars } from '../src/data/synthetic'

describe('cutoff-aware visibility', () => {
  it('late stories cannot affect earlier snapshots', () => {
    const late = stories.find((s) => s.id === 's-late-leak-trap')!
    expect(late.publishedAt).toBeLessThan(late.firstAvailableAt)

    const earlyT = 25
    expect(storyKnowableAt(late, earlyT)).toBe(false)
    expect(visibleStories(stories, earlyT).some((s) => s.id === late.id)).toBe(false)

    const afterAvail = 42
    expect(storyKnowableAt(late, afterAvail)).toBe(true)

    const fEarly = onsetForecast(bars, stories, earlyT)
    const withoutLate = onsetForecast(
      bars,
      stories.filter((s) => s.id !== late.id),
      earlyT,
    )
    expect(fEarly.baseline).toBe(withoutLate.baseline)
    expect(fEarly.newsAware).toBe(withoutLate.newsAware)
    expect(fEarly.inputsChanged.join(',')).not.toContain(late.id)
  })

  it('publication time alone does not grant visibility', () => {
    const late = stories.find((s) => s.id === 's-late-leak-trap')!
    const t = late.publishedAt
    expect(visibleStories(stories, t).map((s) => s.id)).not.toContain(late.id)
  })
})

describe('versioned corrections', () => {
  it('corrections cannot rewrite history', () => {
    const v1 = stories.find((s) => s.id === 's-early-v1')!
    const v2 = stories.find((s) => s.id === 's-early-v2')!
    expect(v2.supersedes).toBe(v1.id)
    expect(v2.version).toBeGreaterThan(v1.version)

    const beforeCorrection = 30
    const headsBefore = latestVersionsAsOf(stories, beforeCorrection)
    const head = headsBefore.find((s) => s.eventId === v1.eventId)!
    expect(head.id).toBe(v1.id)
    expect(head.version).toBe(1)

    const afterCorrection = 36
    const headsAfter = latestVersionsAsOf(stories, afterCorrection)
    const headAfter = headsAfter.find((s) => s.eventId === v1.eventId)!
    expect(headAfter.id).toBe(v2.id)
    expect(headAfter.version).toBe(2)

    // As-of earlier cutoff still returns v1 — history preserved
    const asOfAgain = latestVersionsAsOf(stories, beforeCorrection).find(
      (s) => s.eventId === v1.eventId,
    )!
    expect(asOfAgain.version).toBe(1)
    expect(asOfAgain.headline).toContain('upside')
  })
})

describe('onset isolation from mid-move info', () => {
  it('mid-move info cannot predict onset', () => {
    const preOnset = 29
    const eligible = onsetEligibleStories(stories, preOnset)
    expect(eligible.every((s) => s.narrativeRole !== 'mid_move')).toBe(true)
    expect(eligible.every((s) => s.narrativeRole !== 'post_move')).toBe(true)

    // Even if we force mid-move stories to be "available" early, onsetEligible excludes them
    const poisoned = stories.map((s) =>
      s.id === 's-mid-momentum' ? { ...s, firstAvailableAt: 10 } : s,
    )
    const still = onsetEligibleStories(poisoned, preOnset)
    expect(still.some((s) => s.id === 's-mid-momentum')).toBe(false)

    const forecast = onsetForecast(bars, poisoned, preOnset)
    expect(forecast.inputsChanged.join(',')).not.toContain('s-mid-momentum')
  })
})
