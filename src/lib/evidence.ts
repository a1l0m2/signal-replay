import { SYNTHETIC_DISCLAIMER } from '../data/synthetic'
import type { DetectedMove, EvidenceItem, Story } from '../data/types'
import { SCRIPTED_MOVES } from './moves'

/**
 * After-action / evidence only. Must never feed onset or during forecasts.
 * “Unclear” is a valid outcome.
 */
export function buildEvidence(
  stories: Story[],
  moves: DetectedMove[] = SCRIPTED_MOVES,
  disclaimer: string = SYNTHETIC_DISCLAIMER,
): {
  items: EvidenceItem[]
  disclaimer: string
  movesWithoutCatalyst: number[]
} {
  const items: EvidenceItem[] = []

  for (const s of stories) {
    if (s.narrativeRole === 'quiet') {
      items.push({
        storyId: s.id,
        eventId: s.eventId,
        connection: 'unclear',
        note: 'Quiet-period calendar color; no claimed link to a large move.',
      })
      continue
    }
    if (s.narrativeRole === 'pre_move') {
      items.push({
        storyId: s.id,
        eventId: s.eventId,
        connection: s.kind === 'duplicate' ? 'rival' : 'aligned',
        note:
          s.kind === 'duplicate'
            ? 'Recycled coverage of the same logical event — not independent confirmation.'
            : 'Pre-move expectation narrative; timing precedes onset but causation is unproven.',
      })
      continue
    }
    if (s.narrativeRole === 'mid_move') {
      items.push({
        storyId: s.id,
        eventId: s.eventId,
        connection: s.kind === 'correction' ? 'conflicted' : 'followed_price',
        note:
          s.kind === 'correction'
            ? 'Correction conflicts with earlier magnitude claims; history keeps both versions.'
            : 'Appeared after threshold cross — may be chasing tape.',
      })
      continue
    }
    if (s.narrativeRole === 'post_move') {
      items.push({
        storyId: s.id,
        eventId: s.eventId,
        connection: s.firstAvailableAt - s.publishedAt > 10 ? 'followed_price' : 'unclear',
        note:
          s.firstAvailableAt - s.publishedAt > 10
            ? 'Publication stamp precedes availability; retrospective connection only.'
            : 'After-action commentary; Unclear whether narrative was connected.',
      })
    }
  }

  return {
    items,
    disclaimer,
    movesWithoutCatalyst: moves.filter((m) => !m.hasIdentifiedCatalyst).map((m) => m.onsetT),
  }
}

/** Guard used by tests: evidence module is a separate export path from forecasts. */
export const EVIDENCE_IS_NOT_A_FORECAST = true
