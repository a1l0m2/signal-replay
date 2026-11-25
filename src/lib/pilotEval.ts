/**
 * Chronological baseline vs news-aware evaluation (frozen features).
 * Run via: npx tsx src/lib/runPilotEval.ts
 */
import {
  BASELINE_FEATURE_NAMES,
  NEWS_FEATURE_NAMES,
  ONSET_HORIZON,
  allFeatures,
  assertNoMidPostInNewsFeatures,
  baselineFeatures,
  newsFeatures,
} from './features'
import {
  confusionAtThreshold,
  fitLogistic,
  predictProba,
  thresholdForFar,
} from './logistic'
import { detectMoves, labelOnsetWithinHorizon, onsetDays } from './moves'
import { chronoSplit, eligibleSampleIndices, splitBoundsDates } from './split'
import type { Bar, Story } from '../data/types'

export const TARGET_FAR = 0.2
export const BOOTSTRAP_ITERS = 1000

export interface PilotEvalResult {
  nBars: number
  nMoves: number
  splits: ReturnType<typeof splitBoundsDates>
  trainN: number
  tuneN: number
  testN: number
  testPositives: number
  targetFar: number
  baseline: { thr: number; far: number; hits: number; tp: number; fp: number }
  newsAware: { thr: number; far: number; hits: number; tp: number; fp: number }
  /** Diagnostics: FAR/hits when thresholds frozen on tune (may drift on test) */
  tuneCalibratedTestFar: {
    baseline: number
    newsAware: number
    baselineHits: number
    newsHits: number
  }
  extraHits: number
  bootstrapExtraHits: { mean: number; lo90: number; hi90: number }
  verdict: 'lift' | 'null'
  note: string
}

function rowBaseline(bars: Bar[], t: number): number[] {
  const f = baselineFeatures(bars, t)
  return BASELINE_FEATURE_NAMES.map((k) => f[k])
}

function rowNews(bars: Bar[], stories: Story[], t: number): number[] {
  const f = allFeatures(bars, stories, t)
  return [...BASELINE_FEATURE_NAMES, ...NEWS_FEATURE_NAMES].map((k) => f[k as keyof typeof f] as number)
}

export function runPilotEval(bars: Bar[], stories: Story[]): PilotEvalResult {
  const moves = detectMoves(bars, {
    catalystAt: (onsetT) =>
      stories.some(
        (s) =>
          s.narrativeRole === 'pre_move' &&
          s.firstAvailableAt < onsetT &&
          s.firstAvailableAt >= onsetT - 25,
      ),
  })
  const onsets = onsetDays(moves)
  const split = chronoSplit(bars.length)
  const bounds = splitBoundsDates(bars, split)

  const trainIdx = eligibleSampleIndices(split, 'train')
  const tuneIdx = eligibleSampleIndices(split, 'tune')
  const testIdx = eligibleSampleIndices(split, 'test')

  // Leakage self-check on a sample of train points
  for (const t of trainIdx.slice(0, 50)) {
    assertNoMidPostInNewsFeatures(stories, t)
    const nf = newsFeatures(stories, t)
    void nf
  }

  const yTrain = trainIdx.map((t) => labelOnsetWithinHorizon(t, onsets, ONSET_HORIZON))
  const yTune = tuneIdx.map((t) => labelOnsetWithinHorizon(t, onsets, ONSET_HORIZON))
  const yTest = testIdx.map((t) => labelOnsetWithinHorizon(t, onsets, ONSET_HORIZON))

  const XbTrain = trainIdx.map((t) => rowBaseline(bars, t))
  const XnTrain = trainIdx.map((t) => rowNews(bars, stories, t))
  const XbTune = tuneIdx.map((t) => rowBaseline(bars, t))
  const XnTune = tuneIdx.map((t) => rowNews(bars, stories, t))
  const XbTest = testIdx.map((t) => rowBaseline(bars, t))
  const XnTest = testIdx.map((t) => rowNews(bars, stories, t))

  const modelB = fitLogistic(XbTrain, yTrain, [...BASELINE_FEATURE_NAMES])
  const modelN = fitLogistic(XnTrain, yTrain, [
    ...BASELINE_FEATURE_NAMES,
    ...NEWS_FEATURE_NAMES,
  ])

  // Tune-calibrated thresholds (diagnostics — FAR may drift on test)
  const sbTune = XbTune.map((x) => predictProba(modelB, x))
  const snTune = XnTune.map((x) => predictProba(modelN, x))
  const thrBTune = thresholdForFar(sbTune, yTune, TARGET_FAR)
  const thrNTune = thresholdForFar(snTune, yTune, TARGET_FAR)

  const sbTest = XbTest.map((x) => predictProba(modelB, x))
  const snTest = XnTest.map((x) => predictProba(modelN, x))

  // Primary metric: match FAR on test negatives (same target), then compare hits.
  // Thresholds use negatives only — does not peek at positive labels for the cut rule.
  const thrB = thresholdForFar(sbTest, yTest, TARGET_FAR)
  const thrN = thresholdForFar(snTest, yTest, TARGET_FAR)
  const base = confusionAtThreshold(sbTest, yTest, thrB)
  const news = confusionAtThreshold(snTest, yTest, thrN)
  const extraHits = news.hits - base.hits

  const tuneDiag = {
    baseline: confusionAtThreshold(sbTest, yTest, thrBTune),
    newsAware: confusionAtThreshold(snTest, yTest, thrNTune),
  }

  // Block bootstrap by calendar month on test indices; re-match FAR inside each resample
  const monthOf = (t: number) => bars[t]!.time.slice(0, 7)
  const months = [...new Set(testIdx.map(monthOf))]
  const byMonth = new Map<string, number[]>()
  for (let i = 0; i < testIdx.length; i++) {
    const m = monthOf(testIdx[i]!)
    if (!byMonth.has(m)) byMonth.set(m, [])
    byMonth.get(m)!.push(i)
  }

  const extras: number[] = []
  for (let b = 0; b < BOOTSTRAP_ITERS; b++) {
    const pick: number[] = []
    for (let k = 0; k < months.length; k++) {
      const m = months[Math.floor(Math.random() * months.length)]!
      pick.push(...(byMonth.get(m) ?? []))
    }
    if (!pick.length) continue
    const y = pick.map((i) => yTest[i]!)
    const sb = pick.map((i) => sbTest[i]!)
    const sn = pick.map((i) => snTest[i]!)
    const tb = thresholdForFar(sb, y, TARGET_FAR)
    const tn = thresholdForFar(sn, y, TARGET_FAR)
    const cb = confusionAtThreshold(sb, y, tb)
    const cn = confusionAtThreshold(sn, y, tn)
    extras.push(cn.hits - cb.hits)
  }
  extras.sort((a, b) => a - b)
  const lo = extras[Math.floor(0.05 * extras.length)] ?? 0
  const hi = extras[Math.min(extras.length - 1, Math.floor(0.95 * extras.length))] ?? 0
  const mean = extras.length ? extras.reduce((s, x) => s + x, 0) / extras.length : 0

  const verdict: 'lift' | 'null' = hi > 0 && lo > 0 ? 'lift' : 'null'
  const note =
    verdict === 'null'
      ? 'News-aware does not improve extra large-move onset hits at matched FAR within 90% bootstrap CI (or CI includes ≤0). Honest null.'
      : 'News-aware shows positive extra hits at matched FAR with 90% CI entirely above 0. Still a small underpowered pilot — not trading evidence.'

  return {
    nBars: bars.length,
    nMoves: moves.length,
    splits: bounds,
    trainN: trainIdx.length,
    tuneN: tuneIdx.length,
    testN: testIdx.length,
    testPositives: yTest.filter((y) => y === 1).length,
    targetFar: TARGET_FAR,
    baseline: {
      thr: thrB,
      far: base.far,
      hits: base.hits,
      tp: base.tp,
      fp: base.fp,
    },
    newsAware: {
      thr: thrN,
      far: news.far,
      hits: news.hits,
      tp: news.tp,
      fp: news.fp,
    },
    tuneCalibratedTestFar: {
      baseline: tuneDiag.baseline.far,
      newsAware: tuneDiag.newsAware.far,
      baselineHits: tuneDiag.baseline.hits,
      newsHits: tuneDiag.newsAware.hits,
    },
    extraHits,
    bootstrapExtraHits: { mean, lo90: lo, hi90: hi },
    verdict,
    note,
  }
}
