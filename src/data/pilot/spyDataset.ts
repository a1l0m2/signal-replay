import type { AlertSeed, Bar, DetectedMove, Story } from '../types'
import spyBarsJson from './spy_bars.json'
import { detectMoves } from '../../lib/moves'

/**
 * SPY validation-pilot dataset.
 * News rows are DEMO paraphrases (not wire copy) with hand-assigned availability.
 */
export const PILOT_DISCLAIMER =
  'RESEARCH DEMO — SPY open snapshot + demo narratives. Not evidence a strategy works. Not trading advice.'

export const bars: Bar[] = (spyBarsJson as Bar[]).map((b, i) => ({ ...b, t: i }))

/** Event ids that count as identified catalysts when their stories predate onset. */
const CATALYST_EVENTS = new Set([
  'evt-spy-inflation-worry',
  'evt-spy-bank-stress',
  'evt-spy-vol-spike',
  'evt-spy-trade-scare',
])

/**
 * Demo narratives stamped to researched public windows.
 * publishedAt / firstAvailableAt are bar indices — cutoff uses firstAvailableAt only.
 */
export const stories: Story[] = [
  // Quiet period (no ensuing large move intended)
  {
    id: 'spy-quiet-1',
    eventId: 'evt-spy-calendar',
    version: 1,
    publishedAt: 60,
    firstAvailableAt: 64, // ~2022-03-01
    headline: '[DEMO] Routine Fed speakers calendar noted for SPY watchers',
    body: 'Demo quiet-period item. No claim of catalyst. Tests false-alarm / quiet coverage.',
    tags: ['calendar', 'quiet'],
    kind: 'story',
    narrativeRole: 'quiet',
  },
  // Early expectation before Apr/May 2022 drawdown
  {
    id: 'spy-early-v1',
    eventId: 'evt-spy-inflation-worry',
    version: 1,
    publishedAt: 90,
    firstAvailableAt: 93, // ~2022-04-11
    headline: '[DEMO] Desk notes float sticky-inflation risk into SPY',
    body: 'Demo pre-move expectation paraphrase. Timed before the spring 2022 large down-move.',
    tags: ['expectation', 'macro'],
    kind: 'story',
    narrativeRole: 'pre_move',
  },
  // Duplicate recycled coverage
  {
    id: 'spy-early-dup',
    eventId: 'evt-spy-inflation-worry',
    version: 1,
    publishedAt: 100,
    firstAvailableAt: 102, // ~2022-04-25
    headline: '[DEMO] Roundup restates same inflation worry for SPY',
    body: 'Demo duplicate — recycled coverage of evt-spy-inflation-worry without new claims.',
    tags: ['expectation', 'recycled'],
    kind: 'duplicate',
    narrativeRole: 'pre_move',
  },
  // Mid-move
  {
    id: 'spy-mid-1',
    eventId: 'evt-spy-mid-tape',
    version: 1,
    publishedAt: 110,
    firstAvailableAt: 113, // ~2022-05-10
    headline: '[DEMO] Mid-slide disagreement: capitulation vs dead-cat',
    body: 'Demo mid-move color after threshold breach. Must not score onset.',
    tags: ['disagreement', 'momentum', 'mid-move'],
    kind: 'story',
    narrativeRole: 'mid_move',
  },
  // Correction
  {
    id: 'spy-early-v2',
    eventId: 'evt-spy-inflation-worry',
    version: 2,
    publishedAt: 118,
    firstAvailableAt: 120,
    headline: '[DEMO] Correction: inflation-worry magnitude was overstated',
    body: 'Demo correction — appends version; does not rewrite as-of earlier cutoffs.',
    tags: ['expectation', 'correction'],
    kind: 'correction',
    narrativeRole: 'mid_move',
    supersedes: 'spy-early-v1',
  },
  // Late-available with early publishedAt (leakage trap)
  {
    id: 'spy-late-trap',
    eventId: 'evt-spy-channel-late',
    version: 1,
    publishedAt: 95,
    firstAvailableAt: 130,
    headline: '[DEMO] Channel note later stamped bullish into the slide',
    body: 'Demo leakage trap: early publication stamp, late first availability. Must not affect earlier snapshots.',
    tags: ['surprise', 'late-available'],
    kind: 'story',
    narrativeRole: 'post_move',
  },
  // Banking stress window Mar 2023 — early
  {
    id: 'spy-bank-v1',
    eventId: 'evt-spy-bank-stress',
    version: 1,
    publishedAt: 312,
    firstAvailableAt: 315, // ~2023-03-01
    headline: '[DEMO] Regional-bank stress chatter reaches SPY desks',
    body: 'Demo pre-move expectation around March 2023 banking stress window.',
    tags: ['expectation', 'surprise', 'banks'],
    kind: 'story',
    narrativeRole: 'pre_move',
  },
  {
    id: 'spy-bank-mid',
    eventId: 'evt-spy-bank-mid',
    version: 1,
    publishedAt: 324,
    firstAvailableAt: 325,
    headline: '[DEMO] Mid-move: policy backstop debate intensifies',
    body: 'Demo mid-move narrative during banking-stress tape.',
    tags: ['disagreement', 'mid-move'],
    kind: 'story',
    narrativeRole: 'mid_move',
  },
  // Aug 2024 vol spike window
  {
    id: 'spy-vol-early',
    eventId: 'evt-spy-vol-spike',
    version: 1,
    publishedAt: 664,
    firstAvailableAt: 667, // ~2024-07-25
    headline: '[DEMO] Soft-landing doubts resurface ahead of SPY',
    body: 'Demo expectation note ahead of early-August 2024 volatility window.',
    tags: ['expectation'],
    kind: 'story',
    narrativeRole: 'pre_move',
  },
  {
    id: 'spy-vol-late',
    eventId: 'evt-spy-vol-late',
    version: 1,
    publishedAt: 670,
    firstAvailableAt: 682, // after move underway
    headline: '[DEMO] After-the-fact vol postmortem recirculates',
    body: 'Demo post-move commentary; after-action only.',
    tags: ['retrospective'],
    kind: 'story',
    narrativeRole: 'post_move',
  },
  // Tune-period story (2025)
  {
    id: 'spy-tune-early',
    eventId: 'evt-spy-trade-scare',
    version: 1,
    publishedAt: 828,
    firstAvailableAt: 830, // ~2025-03-20
    headline: '[DEMO] Trade-policy scare sketches for SPY risk',
    body: 'Demo tune-split expectation narrative.',
    tags: ['expectation', 'surprise'],
    kind: 'story',
    narrativeRole: 'pre_move',
  },
  {
    id: 'spy-tune-dup',
    eventId: 'evt-spy-trade-scare',
    version: 1,
    publishedAt: 843,
    firstAvailableAt: 845,
    headline: '[DEMO] Same trade-scare talking points recirculate',
    body: 'Demo duplicate in tune window.',
    tags: ['expectation', 'recycled'],
    kind: 'duplicate',
    narrativeRole: 'pre_move',
  },
  // Test-period: catalyst-free move around late Oct 2026 — NO pre_move story
  {
    id: 'spy-test-mid',
    eventId: 'evt-spy-test-mid',
    version: 1,
    publishedAt: 1238,
    firstAvailableAt: 1240, // during Oct/Nov 2026 move
    headline: '[DEMO] Mid-move: desks chase tape without prior catalyst note',
    body: 'Demo mid-move only — paired with a catalyst-free onset (no pre-move story).',
    tags: ['momentum', 'mid-move'],
    kind: 'story',
    narrativeRole: 'mid_move',
  },
  {
    id: 'spy-test-post',
    eventId: 'evt-spy-test-oped',
    version: 1,
    publishedAt: 1244,
    firstAvailableAt: 1245,
    headline: '[DEMO] Op-ed asks if narrative followed the November tape',
    body: 'Demo after-action. Unclear connection is valid.',
    tags: ['retrospective'],
    kind: 'story',
    narrativeRole: 'post_move',
  },
]

function storyCatalystAt(onsetT: number): boolean {
  return stories.some(
    (s) =>
      CATALYST_EVENTS.has(s.eventId) &&
      s.narrativeRole === 'pre_move' &&
      s.firstAvailableAt < onsetT &&
      s.firstAvailableAt >= onsetT - 25,
  )
}

export const moves: DetectedMove[] = detectMoves(bars, { catalystAt: storyCatalystAt })

export const alertSeeds: AlertSeed[] = [
  {
    id: 'spy-a1',
    eventId: 'evt-spy-inflation-worry',
    fireAt: 93,
    title: 'Expectation: inflation-worry demo note',
    severity: 'watch',
  },
  {
    id: 'spy-a1-dup',
    eventId: 'evt-spy-inflation-worry',
    fireAt: 102,
    title: 'Duplicate: inflation-worry recirculated',
    severity: 'watch',
  },
  {
    id: 'spy-a2',
    eventId: 'evt-spy-mid-tape',
    fireAt: 113,
    title: 'Mid-move disagreement (demo)',
    severity: 'info',
  },
  {
    id: 'spy-a3',
    eventId: 'evt-spy-inflation-worry',
    fireAt: 120,
    title: 'Correction: inflation-worry walked back',
    severity: 'alert',
  },
  {
    id: 'spy-a4',
    eventId: 'evt-spy-bank-stress',
    fireAt: 315,
    title: 'Expectation: bank-stress demo note',
    severity: 'watch',
  },
  {
    id: 'spy-a5',
    eventId: 'evt-spy-trade-scare',
    fireAt: 830,
    title: 'Expectation: trade-scare demo note',
    severity: 'watch',
  },
]

export const ticker = {
  symbol: 'SPY',
  name: 'SPDR S&P 500 ETF (open snapshot)',
  disclaimer: PILOT_DISCLAIMER,
} as const

export const eventJumps = [
  { t: 64, label: 'Quiet calendar' },
  { t: 93, label: 'Early inflation worry' },
  { t: 102, label: 'Duplicate coverage' },
  { t: 113, label: 'Mid-move story' },
  { t: 120, label: 'Correction' },
  { t: 130, label: 'Late-available trap' },
  { t: 315, label: 'Bank-stress expectation' },
  { t: 667, label: 'Vol-window expectation' },
  { t: 830, label: 'Trade-scare (tune)' },
  { t: 1234, label: 'Catalyst-free move onset' },
  { t: 1245, label: 'After-action commentary' },
]
