import type { Story } from '../data/types'

/**
 * Cutoff-aware visibility: at time T, only facts with firstAvailableAt <= T.
 * Publication time is informational and must not grant earlier visibility.
 */

export function visibleStories(stories: Story[], t: number): Story[] {
  return stories.filter((s) => s.firstAvailableAt <= t)
}

/**
 * For each eventId, return the latest version whose firstAvailableAt <= t.
 * Prior versions remain in the corpus for as-of queries; this helper picks
 * the head version knowable at t without mutating history.
 */
function isBetterHead(candidate: Story, current: Story): boolean {
  if (candidate.version !== current.version) {
    return candidate.version > current.version
  }
  // Same logical version: prefer non-duplicate (original / correction body)
  const candDup = candidate.kind === 'duplicate'
  const curDup = current.kind === 'duplicate'
  if (candDup !== curDup) return !candDup
  // Prefer earlier availability as the canonical head for that version
  return candidate.firstAvailableAt < current.firstAvailableAt
}

export function latestVersionsAsOf(stories: Story[], t: number): Story[] {
  const visible = visibleStories(stories, t)
  const best = new Map<string, Story>()
  for (const s of visible) {
    const key = s.eventId
    const cur = best.get(key)
    if (!cur || isBetterHead(s, cur)) {
      best.set(key, s)
    }
  }
  return [...best.values()].sort((a, b) => a.firstAvailableAt - b.firstAvailableAt)
}

/** Exact story versions knowable at t (all versions, not just latest). */
export function versionsAsOf(stories: Story[], t: number): Story[] {
  return visibleStories(stories, t).sort(
    (a, b) => a.firstAvailableAt - b.firstAvailableAt || a.version - b.version,
  )
}

/** Stories allowed as onset-forecast inputs: available at t and not mid/post move. */
export function onsetEligibleStories(stories: Story[], t: number): Story[] {
  return visibleStories(stories, t).filter(
    (s) => s.narrativeRole === 'pre_move' || s.narrativeRole === 'quiet',
  )
}

export function storyKnowableAt(story: Story, t: number): boolean {
  return story.firstAvailableAt <= t
}
