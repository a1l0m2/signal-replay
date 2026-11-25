import type { DetectedMove, Story } from '../data/types'
import { summarizeStory } from './summarizeStory'

export type CatalystLean = 'bullish' | 'bearish' | 'unclear' | 'material_event'
export type CatalystTiming = 'before' | 'during' | 'after'

export interface CatalystHit {
  storyId: string
  eventId: string
  headline: string
  /** Offline 1–2 paragraph narrative from title/tags/tone/filing — not an LLM. */
  summary: string
  source: string
  timing: CatalystTiming
  lean: CatalystLean
  availableT: number
  note: string
}

export interface MoveCatalystReport {
  move: DetectedMove
  before: CatalystHit[]
  during: CatalystHit[]
  after: CatalystHit[]
  catalystFree: boolean
}

const BEFORE_BARS = 15
const AFTER_BARS = 8

function leanFor(story: Story): CatalystLean {
  const src = story.source ?? ''
  if (src === 'edgar' || story.tags.includes('edgar') || story.tags.includes('8-k')) {
    if (story.kind === 'correction') return 'unclear'
    return 'material_event'
  }
  // GDELT / open news: parse tone= from body if present
  const m = story.body.match(/tone=([-+]?\d*\.?\d+)/i)
  if (m) {
    const tone = Number(m[1])
    if (!Number.isNaN(tone)) {
      if (tone <= -1) return 'bearish'
      if (tone >= 1) return 'bullish'
    }
  }
  if (story.tags.includes('surprise') && story.tags.includes('expectation')) return 'unclear'
  return 'unclear'
}

function sourceLabel(story: Story): string {
  if (story.source === 'edgar' || story.tags.includes('edgar')) return 'earnings/filing (EDGAR 8-K)'
  if (story.source?.includes('gdelt') || story.tags.includes('gdelt')) return 'open news (GDELT proxy)'
  return story.source ?? 'story'
}

function noteFor(lean: CatalystLean, timing: CatalystTiming): string {
  if (lean === 'material_event') {
    return `Material SEC filing ${timing} the move — direction not inferred from 8-K alone. Causation unproven.`
  }
  if (lean === 'unclear') {
    return `Lean unclear ${timing} the move. Unclear is valid.`
  }
  return `${lean} lean ${timing} the move (heuristic from open proxy). Not proof of causation.`
}

/**
 * After-action style: catalysts around a move. Never feeds onset forecasts.
 */
export function catalystsForMove(move: DetectedMove, stories: Story[]): MoveCatalystReport {
  const lo = Math.max(0, move.onsetT - BEFORE_BARS)
  const hi = move.endT + AFTER_BARS
  const before: CatalystHit[] = []
  const during: CatalystHit[] = []
  const after: CatalystHit[] = []

  for (const s of stories) {
    const t = s.firstAvailableAt
    if (t < lo || t > hi) continue
    let timing: CatalystTiming
    if (t < move.onsetT) timing = 'before'
    else if (t <= move.endT) timing = 'during'
    else timing = 'after'
    const lean = leanFor(s)
    const hit: CatalystHit = {
      storyId: s.id,
      eventId: s.eventId,
      headline: s.headline,
      summary: summarizeStory(s),
      source: sourceLabel(s),
      timing,
      lean,
      availableT: t,
      note: noteFor(lean, timing),
    }
    if (timing === 'before') before.push(hit)
    else if (timing === 'during') during.push(hit)
    else after.push(hit)
  }

  const sortHits = (a: CatalystHit, b: CatalystHit) => a.availableT - b.availableT
  before.sort(sortHits)
  during.sort(sortHits)
  after.sort(sortHits)

  return {
    move,
    before,
    during,
    after,
    catalystFree: before.length === 0 && during.length === 0,
  }
}

export function buildCatalystReports(
  moves: DetectedMove[],
  stories: Story[],
  opts: { limit?: number; minPeak?: number } = {},
): MoveCatalystReport[] {
  const limit = opts.limit ?? 40
  const ranked = [...moves].sort(
    (a, b) => (b.peakAbsReturn ?? 0) - (a.peakAbsReturn ?? 0),
  )
  return ranked.slice(0, limit).map((m) => catalystsForMove(m, stories))
}
