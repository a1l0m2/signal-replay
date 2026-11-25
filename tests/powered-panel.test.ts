import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chronoSplit, eligibleSampleIndices } from '../src/lib/split'
import { ONSET_HORIZON } from '../src/lib/features'
import { visibleStories, onsetEligibleStories } from '../src/lib/cutoff'
import type { Story } from '../src/data/types'

const result = JSON.parse(
  readFileSync(new URL('../public/data/powered/powered_eval_result.json', import.meta.url), 'utf8'),
) as {
  gate: { minTestOnsets: number; testOnsets: number; passed: boolean }
  verdict: string
  extraHits: number
  bootstrapExtraHits: { lo90: number; hi90: number }
  featureFreeze: string[]
}

describe('powered panel power gate', () => {
  it('documents N>=200 as test-split onset count and passes on this snapshot', () => {
    expect(result.gate.minTestOnsets).toBe(200)
    expect(result.gate.testOnsets).toBeGreaterThanOrEqual(200)
    expect(result.gate.passed).toBe(true)
  })

  it('keeps the frozen feature set (no expansion)', () => {
    expect(result.featureFreeze).toEqual([
      'rv10',
      'vol_z20',
      'abs_ret5',
      'abs_ret1',
      'n_expect',
      'n_surprise',
      'has_correction',
      'recency',
    ])
  })

  it('records honest null when CI includes <=0 (this run)', () => {
    expect(result.verdict).toBe('null')
    expect(result.bootstrapExtraHits.lo90).toBeLessThanOrEqual(0)
  })
})

describe('powered panel leakage helpers', () => {
  it('eligible samples still keep t+H inside split', () => {
    const split = chronoSplit(4250)
    for (const name of ['train', 'tune', 'test'] as const) {
      const [, hi] = split[name]
      for (const t of eligibleSampleIndices(split, name, ONSET_HORIZON).slice(0, 20)) {
        expect(t + ONSET_HORIZON).toBeLessThanOrEqual(hi)
      }
    }
  })

  it('open-news stories respect firstAvailable cutoff', () => {
    const raw = JSON.parse(
      readFileSync(new URL('../public/data/powered/news_panel.json', import.meta.url), 'utf8'),
    ) as { stories: Story[] }
    const sample = raw.stories.filter((s) => s.symbol === 'AAPL').slice(0, 20)
    expect(sample.length).toBeGreaterThan(0)
    for (const s of sample) {
      const early = s.firstAvailableAt - 1
      if (early < 0) continue
      expect(visibleStories([s], early).length).toBe(0)
      expect(visibleStories([s], s.firstAvailableAt).length).toBe(1)
      if (s.narrativeRole === 'mid_move' || s.narrativeRole === 'post_move') {
        expect(onsetEligibleStories([s], s.firstAvailableAt + 5).length).toBe(0)
      }
    }
  })
})
