import type { AlertSeed } from '../data/types'

export interface FiredAlert {
  id: string
  eventId: string
  fireAt: number
  title: string
  severity: AlertSeed['severity']
  suppressedDuplicate?: boolean
}

/**
 * Fire alerts chronologically with dedupe by logical event identity.
 * First fire for an eventId wins; later seeds with the same eventId are
 * marked suppressed (except corrections bump — see note).
 *
 * M1 rule: duplicate alerts don't fire twice for the same eventId.
 * Corrections share eventId with the original whisper; for inbox UX we
 * allow a second fire when the seed title indicates Correction, tracked
 * under a derived key `${eventId}::correction`. Pure duplicates stay suppressed.
 */
export function fireAlerts(seeds: AlertSeed[], asOfT: number): FiredAlert[] {
  const ordered = [...seeds]
    .filter((s) => s.fireAt <= asOfT)
    .sort((a, b) => a.fireAt - b.fireAt || a.id.localeCompare(b.id))

  const seen = new Set<string>()
  const out: FiredAlert[] = []

  for (const s of ordered) {
    const isCorrection = /correction/i.test(s.title)
    const key = isCorrection ? `${s.eventId}::correction` : s.eventId
    if (seen.has(key)) {
      out.push({
        id: s.id,
        eventId: s.eventId,
        fireAt: s.fireAt,
        title: s.title,
        severity: s.severity,
        suppressedDuplicate: true,
      })
      continue
    }
    seen.add(key)
    out.push({
      id: s.id,
      eventId: s.eventId,
      fireAt: s.fireAt,
      title: s.title,
      severity: s.severity,
    })
  }
  return out
}

/** Active (non-suppressed) alerts for the inbox. */
export function activeAlerts(seeds: AlertSeed[], asOfT: number): FiredAlert[] {
  return fireAlerts(seeds, asOfT).filter((a) => !a.suppressedDuplicate)
}

export function wouldDuplicateFire(seeds: AlertSeed[], eventId: string): boolean {
  const fires = fireAlerts(
    seeds.filter((s) => s.eventId === eventId && !/correction/i.test(s.title)),
    Number.POSITIVE_INFINITY,
  )
  const active = fires.filter((f) => !f.suppressedDuplicate)
  const suppressed = fires.filter((f) => f.suppressedDuplicate)
  return active.length === 1 && suppressed.length >= 1
}
