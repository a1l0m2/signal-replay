import { describe, expect, it } from 'vitest'
import { catalystsForMove } from '../src/lib/catalysts'
import type { DetectedMove, Story } from '../src/data/types'

const move: DetectedMove = {
  onsetT: 100,
  endT: 110,
  direction: -1,
  peakAbsReturn: 0.1,
  hasIdentifiedCatalyst: true,
}

const stories: Story[] = [
  {
    id: 'e1',
    eventId: 'edgar-1',
    version: 1,
    publishedAt: 90,
    firstAvailableAt: 92,
    headline: '[EDGAR] 8-K',
    body: 'filing',
    tags: ['edgar', '8-k'],
    kind: 'story',
    narrativeRole: 'pre_move',
    source: 'edgar',
  },
  {
    id: 'g1',
    eventId: 'g-1',
    version: 1,
    publishedAt: 105,
    firstAvailableAt: 105,
    headline: '[GDELT] bad tape',
    body: 'tone=-2.5 Weak clock',
    tags: ['gdelt', 'surprise'],
    kind: 'story',
    narrativeRole: 'mid_move',
    source: 'gdelt-gkg',
  },
  {
    id: 'late',
    eventId: 'g-2',
    version: 1,
    publishedAt: 130,
    firstAvailableAt: 130,
    headline: 'too late',
    body: 'tone=1',
    tags: ['gdelt'],
    kind: 'story',
    narrativeRole: 'post_move',
    source: 'gdelt-gkg',
  },
]

describe('catalyst analysis windows', () => {
  it('buckets earnings/news before during after without claiming causation', () => {
    const r = catalystsForMove(move, stories)
    expect(r.before.map((h) => h.storyId)).toContain('e1')
    expect(r.before[0]?.lean).toBe('material_event')
    expect(r.during.map((h) => h.storyId)).toContain('g1')
    expect(r.during.find((h) => h.storyId === 'g1')?.lean).toBe('bearish')
    expect(r.after.map((h) => h.storyId)).not.toContain('late') // outside AFTER_BARS=8 from end 110
    expect(r.catalystFree).toBe(false)
  })

  it('marks catalyst-free when nothing in before/during', () => {
    const r = catalystsForMove(move, [
      {
        ...stories[2]!,
        firstAvailableAt: 112,
        id: 'after-only',
      },
    ])
    expect(r.before).toHaveLength(0)
    expect(r.during).toHaveLength(0)
    expect(r.after.length).toBeGreaterThan(0)
    expect(r.catalystFree).toBe(true)
  })
})
