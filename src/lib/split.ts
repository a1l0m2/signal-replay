import type { Bar } from '../data/types'
import { ONSET_HORIZON } from './features'

export type SplitName = 'train' | 'tune' | 'test'

export interface ChronoSplit {
  train: [number, number] // inclusive index range
  tune: [number, number]
  test: [number, number]
}

/** Contiguous 60/20/20 chronological split by bar index. */
export function chronoSplit(n: number): ChronoSplit {
  const trainEnd = Math.floor(n * 0.6)
  const tuneEnd = Math.floor(n * 0.8)
  return {
    train: [0, trainEnd - 1],
    tune: [trainEnd, tuneEnd - 1],
    test: [tuneEnd, n - 1],
  }
}

export function rangeOf(split: ChronoSplit, name: SplitName): [number, number] {
  return split[name]
}

/**
 * Sample t is valid in a split only if t and t+H both lie inside the split
 * (no overlapping outcome-window leakage across splits).
 */
export function eligibleSampleIndices(
  split: ChronoSplit,
  name: SplitName,
  horizon = ONSET_HORIZON,
): number[] {
  const [lo, hi] = rangeOf(split, name)
  const out: number[] = []
  for (let t = lo; t <= hi; t++) {
    if (t + horizon <= hi) out.push(t)
  }
  return out
}

export function splitBoundsDates(bars: Bar[], split: ChronoSplit) {
  const d = (i: number) => bars[i]?.time ?? '?'
  return {
    train: { start: d(split.train[0]), end: d(split.train[1]) },
    tune: { start: d(split.tune[0]), end: d(split.tune[1]) },
    test: { start: d(split.test[0]), end: d(split.test[1]) },
  }
}

/** True if any feature window or story availability index is after t. */
export function hasFutureLeakage(featureTimes: number[], t: number): boolean {
  return featureTimes.some((x) => x > t)
}
