import type { Bar, DetectedMove } from '../data/types'

const WINDOW = 20
const MEDIAN_LOOKBACK = 60
const THRESHOLD_MULT = 2.5
const SUSTAIN_BARS = 3

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

function logReturn(a: number, b: number): number {
  return Math.log(b / a)
}

export interface DetectMovesOptions {
  /** Optional map onsetT → whether a curated catalyst story exists */
  catalystAt?: (onsetT: number) => boolean
}

/**
 * Detect unusually large moves per decision-note definition.
 * onsetT = first bar where the rolling window breaches the threshold (no look-back pad).
 */
export function detectMoves(bars: Bar[], opts: DetectMovesOptions = {}): DetectedMove[] {
  const absRets: number[] = bars.map((b, i) => {
    if (i === 0) return 0
    return Math.abs(logReturn(bars[i - 1]!.close, b.close))
  })

  const moves: DetectedMove[] = []
  let i = WINDOW
  while (i < bars.length) {
    const start = bars[i - WINDOW]!.close
    const end = bars[i]!.close
    const windowRet = logReturn(start, end)
    const absWindow = Math.abs(windowRet)
    const lookback = absRets.slice(Math.max(1, i - MEDIAN_LOOKBACK), i)
    const med = median(lookback.filter((x) => x > 0))
    const threshold = (med || 0.002) * THRESHOLD_MULT

    if (absWindow > threshold) {
      const direction = (windowRet > 0 ? 1 : -1) as 1 | -1
      let sustained = true
      for (let k = 1; k <= SUSTAIN_BARS && i + k < bars.length; k++) {
        const step = logReturn(bars[i + k - 1]!.close, bars[i + k]!.close)
        if (Math.sign(step) !== 0 && Math.sign(step) !== direction && Math.abs(step) > 0.001) {
          sustained = false
          break
        }
      }
      if (sustained) {
        let endT = i
        let peak = absWindow
        while (endT + 1 < bars.length) {
          const step = logReturn(bars[endT]!.close, bars[endT + 1]!.close)
          if (Math.sign(step) !== direction && Math.abs(step) > 0.004) break
          if (Math.sign(step) === direction) {
            peak = Math.max(peak, Math.abs(logReturn(start, bars[endT + 1]!.close)))
          }
          if (endT - i > 25) break
          endT++
          if (Math.abs(step) < 0.0015 && endT - i > 5) break
        }
        const onsetT = i
        moves.push({
          onsetT,
          endT,
          direction,
          peakAbsReturn: peak,
          hasIdentifiedCatalyst: opts.catalystAt?.(onsetT) ?? false,
        })
        i = endT + 1
        continue
      }
    }
    i++
  }
  return moves
}

/** Onset days for labeling: unique onsetT values. */
export function onsetDays(moves: DetectedMove[]): Set<number> {
  return new Set(moves.map((m) => m.onsetT))
}

export function labelOnsetWithinHorizon(
  t: number,
  onsets: Set<number>,
  horizon = 10,
): 0 | 1 {
  for (let h = 1; h <= horizon; h++) {
    if (onsets.has(t + h)) return 1
  }
  return 0
}

/** Scripted move anchors for deterministic demo UX (detector may still run). */
export const SCRIPTED_MOVES: DetectedMove[] = [
  {
    onsetT: 30,
    endT: 45,
    direction: 1,
    peakAbsReturn: 0.22,
    hasIdentifiedCatalyst: true,
  },
  {
    onsetT: 59,
    endT: 70,
    direction: -1,
    peakAbsReturn: 0.14,
    hasIdentifiedCatalyst: false,
  },
]

export function moveContaining(t: number, moves: DetectedMove[] = SCRIPTED_MOVES): DetectedMove | undefined {
  return moves.find((m) => t >= m.onsetT && t <= m.endT)
}

export function isBeforeAnyOnset(t: number, moves: DetectedMove[] = SCRIPTED_MOVES): boolean {
  return moves.every((m) => t < m.onsetT)
}
