/** Shared domain types for Signal Replay (synthetic M1). */

export type NarrativeRole = 'pre_move' | 'mid_move' | 'post_move' | 'uncatalyzed' | 'quiet'

export type StoryKind = 'story' | 'correction' | 'duplicate' | 'revision'

export interface Bar {
  t: number
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Story {
  id: string
  /** Logical event identity for dedupe / recycled coverage */
  eventId: string
  version: number
  publishedAt: number
  /** First verifiable availability — cutoff uses this, not publishedAt */
  firstAvailableAt: number
  headline: string
  body: string
  tags: string[]
  kind: StoryKind
  /** Authoring role relative to the scripted large move (not a live label) */
  narrativeRole: NarrativeRole
  /** Prior version id this corrects/revises, if any */
  supersedes?: string
  /** Panel symbol when story is name-specific (powered panel) */
  symbol?: string
  source?: string
}

export interface AlertSeed {
  id: string
  eventId: string
  fireAt: number
  title: string
  severity: 'info' | 'watch' | 'alert'
}

export type MovePhase = 'quiet' | 'onset' | 'during' | 'after'

export interface DetectedMove {
  onsetT: number
  endT: number
  direction: 1 | -1
  peakAbsReturn: number
  hasIdentifiedCatalyst: boolean
}

export type DuringOutcome = 'continuation' | 'reversal' | 'stall'

export interface OnsetForecast {
  t: number
  baseline: number
  newsAware: number
  inputsChanged: string[]
  disclaimer: string
}

export interface DuringForecast {
  checkpointT: number
  baseline: DuringOutcome
  newsAware: DuringOutcome
  inputsChanged: string[]
  disclaimer: string
}

export interface EvidenceItem {
  storyId: string
  eventId: string
  connection: 'aligned' | 'conflicted' | 'rival' | 'followed_price' | 'unclear'
  note: string
}
