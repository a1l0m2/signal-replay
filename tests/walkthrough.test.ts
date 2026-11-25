import { describe, expect, it } from 'vitest'
import { WALKTHROUGH_STEPS } from '../src/components/Walkthrough'

describe('first-run walkthrough copy', () => {
  it('covers datasets, catalysts, live vs historical', () => {
    const ids = WALKTHROUGH_STEPS.map((s) => s.id)
    expect(ids).toEqual(['welcome', 'datasets', 'replay', 'catalysts', 'live', 'multi'])
    const blob = WALKTHROUGH_STEPS.map((s) => `${s.title} ${s.body}`).join(' ').toLowerCase()
    expect(blob).toContain('syn')
    expect(blob).toContain('spy')
    expect(blob).toContain('multi-asset')
    expect(blob).toContain('catalyst')
    expect(blob).toContain('live')
    expect(blob).toContain('delayed')
    expect(blob).toContain('historical')
  })
})
