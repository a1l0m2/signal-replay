import { describe, expect, it } from 'vitest'
import { alertSeeds } from '../src/data/synthetic'
import { activeAlerts, fireAlerts, wouldDuplicateFire } from '../src/lib/alerts'

describe('alert deduplication', () => {
  it('duplicate alerts do not fire twice for the same logical event', () => {
    expect(wouldDuplicateFire(alertSeeds, 'evt-guidance-whisper')).toBe(true)

    const atDup = fireAlerts(alertSeeds, 22)
    const whisper = atDup.filter((a) => a.eventId === 'evt-guidance-whisper')
    const active = whisper.filter((a) => !a.suppressedDuplicate)
    const suppressed = whisper.filter((a) => a.suppressedDuplicate)

    expect(active).toHaveLength(1)
    expect(active[0]!.id).toBe('a1')
    expect(suppressed.some((a) => a.id === 'a1-dup')).toBe(true)

    const inbox = activeAlerts(alertSeeds, 22).filter(
      (a) => a.eventId === 'evt-guidance-whisper',
    )
    expect(inbox).toHaveLength(1)
  })

  it('correction may surface as a separate alert after the original', () => {
    const after = activeAlerts(alertSeeds, 36).filter(
      (a) => a.eventId === 'evt-guidance-whisper',
    )
    expect(after.map((a) => a.id).sort()).toEqual(['a1', 'a3'])
  })
})
