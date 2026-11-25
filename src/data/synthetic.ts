import type { AlertSeed, Bar, Story } from './types'

/**
 * Synthetic ticker SYN — scripted scenario for Milestone 1.
 * All content is demonstration-only; not market evidence.
 *
 * Timeline (bar index ≈ trading day):
 *  0–24   quiet grind
 *  18     early expectation story available
 *  22     duplicate / recycled coverage of same event
 *  28–45  large up-move (onset ~30)
 *  33     mid-move “momentum / continuation” story
 *  36     correction to early story (new version; does not rewrite past)
 *  42     late story: publishedAt=20 but firstAvailableAt=42 (leakage trap)
 *  46–58  cool-off / quiet
 *  59–70  second move WITHOUT identified catalyst
 *  72     post-move retrospective commentary (after-action only)
 */

const DISCLAIMER =
  'SYNTHETIC DEMONSTRATION — not evidence that news improves forecasts.'

export const SYNTHETIC_DISCLAIMER = DISCLAIMER

function day(t: number): string {
  const base = Date.UTC(2024, 0, 2)
  return new Date(base + t * 86_400_000).toISOString().slice(0, 10)
}

function buildBars(): Bar[] {
  const bars: Bar[] = []
  let price = 100
  for (let t = 0; t <= 80; t++) {
    let ret = 0
    let vol = 1_000_000

    if (t < 25) {
      ret = ((t % 5) - 2) * 0.0015
      vol = 900_000 + (t % 7) * 20_000
    } else if (t >= 28 && t <= 45) {
      // Scripted large up-move
      ret = 0.012 + (t % 3) * 0.002
      vol = 2_200_000 + (t - 28) * 80_000
    } else if (t >= 46 && t < 59) {
      ret = ((t % 4) - 1.5) * 0.002
      vol = 1_100_000
    } else if (t >= 59 && t <= 70) {
      // Catalyst-free down-move
      ret = -0.011 - (t % 2) * 0.0015
      vol = 1_800_000 + (t - 59) * 50_000
    } else {
      ret = ((t % 3) - 1) * 0.001
      vol = 950_000
    }

    const open = price
    const close = price * (1 + ret)
    const high = Math.max(open, close) * (1 + 0.003)
    const low = Math.min(open, close) * (1 - 0.003)
    bars.push({
      t,
      time: day(t),
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume: Math.round(vol),
    })
    price = close
  }
  return bars
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

export const bars: Bar[] = buildBars()

/**
 * Versioned stories. Corrections append versions; never mutate prior rows.
 * Late story deliberately has early publishedAt and late firstAvailableAt.
 */
export const stories: Story[] = [
  {
    id: 's-early-v1',
    eventId: 'evt-guidance-whisper',
    version: 1,
    publishedAt: 16,
    firstAvailableAt: 18,
    headline: 'Analysts float upside to SYN guidance',
    body: 'A handful of sell-side notes sketch a constructive path for SYN into the next print. Tone is tentative — expectations, not confirmation.',
    tags: ['expectation', 'guidance', 'sell-side'],
    kind: 'story',
    narrativeRole: 'pre_move',
  },
  {
    id: 's-early-dup',
    eventId: 'evt-guidance-whisper',
    version: 1,
    publishedAt: 21,
    firstAvailableAt: 22,
    headline: 'Roundup: same SYN guidance chatter recirculates',
    body: 'Wire roundup restates earlier analyst notes without new claims. Recycled coverage of evt-guidance-whisper.',
    tags: ['expectation', 'recycled', 'roundup'],
    kind: 'duplicate',
    narrativeRole: 'pre_move',
  },
  {
    id: 's-mid-momentum',
    eventId: 'evt-mid-tape',
    version: 1,
    publishedAt: 32,
    firstAvailableAt: 33,
    headline: 'Tape watch: SYN extension draws momentum desks',
    body: 'After the threshold breach, desks debate continuation versus fade. This is mid-move color — not an onset predictor.',
    tags: ['disagreement', 'momentum', 'mid-move'],
    kind: 'story',
    narrativeRole: 'mid_move',
  },
  {
    id: 's-early-v2',
    eventId: 'evt-guidance-whisper',
    version: 2,
    publishedAt: 35,
    firstAvailableAt: 36,
    headline: 'Correction: guidance whisper was overstated',
    body: 'Original notes walked back magnitude. Prior version remains historically true as-of earlier cutoffs; this version does not rewrite them.',
    tags: ['expectation', 'correction', 'guidance'],
    kind: 'correction',
    narrativeRole: 'mid_move',
    supersedes: 's-early-v1',
  },
  {
    id: 's-late-leak-trap',
    eventId: 'evt-channel-check',
    version: 1,
    // Published "on paper" early, but not verifiably available until late
    publishedAt: 20,
    firstAvailableAt: 42,
    headline: 'Channel checks later claimed bullish SYN read-through',
    body: 'Story carries an early publication stamp but first verifiable availability is bar 42 — after much of the move. Must not affect earlier snapshots.',
    tags: ['surprise', 'channel', 'late-available'],
    kind: 'story',
    narrativeRole: 'post_move',
  },
  {
    id: 's-post-retrospective',
    eventId: 'evt-aftermath-oped',
    version: 1,
    publishedAt: 71,
    firstAvailableAt: 72,
    headline: 'Op-ed: did the narrative chase the tape?',
    body: 'After-action commentary asking whether coverage followed price. Valid evidence question; not a forecast input.',
    tags: ['narrative-spread', 'retrospective'],
    kind: 'story',
    narrativeRole: 'post_move',
  },
  {
    id: 's-quiet-filler',
    eventId: 'evt-calendar-note',
    version: 1,
    publishedAt: 8,
    firstAvailableAt: 9,
    headline: 'SYN on deck for routine industry conference',
    body: 'Calendar item only. No claim of catalyst. Lives in the quiet period.',
    tags: ['calendar', 'quiet'],
    kind: 'story',
    narrativeRole: 'quiet',
  },
]

/** Scripted alert fires — duplicates share eventId and must dedupe. */
export const alertSeeds: AlertSeed[] = [
  {
    id: 'a1',
    eventId: 'evt-guidance-whisper',
    fireAt: 18,
    title: 'Expectation shift: SYN guidance whisper',
    severity: 'watch',
  },
  {
    id: 'a1-dup',
    eventId: 'evt-guidance-whisper',
    fireAt: 22,
    title: 'Duplicate: same guidance whisper recirculated',
    severity: 'watch',
  },
  {
    id: 'a2',
    eventId: 'evt-mid-tape',
    fireAt: 33,
    title: 'Mid-move disagreement on SYN extension',
    severity: 'info',
  },
  {
    id: 'a3',
    eventId: 'evt-guidance-whisper',
    fireAt: 36,
    title: 'Correction: guidance whisper walked back',
    severity: 'alert',
  },
  {
    id: 'a4',
    eventId: 'evt-channel-check',
    fireAt: 42,
    title: 'Late-available channel check now visible',
    severity: 'info',
  },
]

export const ticker = {
  symbol: 'SYN',
  name: 'SyntheticCo',
  disclaimer: DISCLAIMER,
} as const
