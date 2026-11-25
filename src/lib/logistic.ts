/** Tiny L2 logistic regression — same model family for baseline vs news-aware. */

export interface LogisticModel {
  weights: number[]
  bias: number
  featureNames: string[]
}

function sigmoid(z: number): number {
  if (z >= 0) {
    const e = Math.exp(-z)
    return 1 / (1 + e)
  }
  const e = Math.exp(z)
  return e / (1 + e)
}

export function fitLogistic(
  X: number[][],
  y: number[],
  featureNames: string[],
  opts: { C?: number; steps?: number; lr?: number } = {},
): LogisticModel {
  const C = opts.C ?? 1
  const steps = opts.steps ?? 800
  const lr = opts.lr ?? 0.08
  const d = featureNames.length
  const w = new Array(d).fill(0)
  let b = 0
  const n = X.length
  if (!n) return { weights: w, bias: b, featureNames }

  // standardize
  const mean = new Array(d).fill(0)
  const sd = new Array(d).fill(1)
  for (let j = 0; j < d; j++) {
    let s = 0
    for (let i = 0; i < n; i++) s += X[i]![j]!
    mean[j] = s / n
    let v = 0
    for (let i = 0; i < n; i++) v += (X[i]![j]! - mean[j]!) ** 2
    sd[j] = Math.sqrt(v / n) || 1
  }
  const Xs = X.map((row) => row.map((v, j) => (v - mean[j]!) / sd[j]!))

  for (let step = 0; step < steps; step++) {
    const gw = new Array(d).fill(0)
    let gb = 0
    for (let i = 0; i < n; i++) {
      const z = b + Xs[i]!.reduce((s, x, j) => s + x * w[j]!, 0)
      const p = sigmoid(z)
      const err = p - y[i]!
      for (let j = 0; j < d; j++) gw[j]! += err * Xs[i]![j]!
      gb += err
    }
    for (let j = 0; j < d; j++) {
      gw[j] = gw[j]! / n + (1 / C) * w[j]! / n
      w[j]! -= lr * gw[j]!
    }
    b -= lr * (gb / n)
  }

  // store weights in original scale: w_orig = w_std / sd, b_orig = b - sum(w_std * mean / sd)
  const wOrig = w.map((wj, j) => wj / sd[j]!)
  let bOrig = b
  for (let j = 0; j < d; j++) bOrig -= (w[j]! * mean[j]!) / sd[j]!
  return { weights: wOrig, bias: bOrig, featureNames }
}

export function predictProba(model: LogisticModel, x: number[]): number {
  const z = model.bias + model.weights.reduce((s, w, j) => s + w * (x[j] ?? 0), 0)
  return sigmoid(z)
}

/** Choose lowest threshold with empirical FAR <= targetFar on negatives. */
export function thresholdForFar(
  scores: number[],
  labels: number[],
  targetFar: number,
): number {
  const neg = scores
    .map((s, i) => ({ s, y: labels[i]! }))
    .filter((r) => r.y === 0)
    .sort((a, b) => b.s - a.s)
  if (!neg.length) return 1
  const maxFalse = Math.floor(targetFar * neg.length)
  if (maxFalse <= 0) return neg[0]!.s + 1e-9
  const cut = neg[Math.min(maxFalse, neg.length - 1)]!.s
  return cut
}

export function confusionAtThreshold(
  scores: number[],
  labels: number[],
  thr: number,
): { tp: number; fp: number; tn: number; fn: number; far: number; hits: number } {
  let tp = 0
  let fp = 0
  let tn = 0
  let fn = 0
  for (let i = 0; i < scores.length; i++) {
    const pred = scores[i]! >= thr ? 1 : 0
    const y = labels[i]!
    if (pred === 1 && y === 1) tp++
    else if (pred === 1 && y === 0) fp++
    else if (pred === 0 && y === 0) tn++
    else fn++
  }
  const negatives = tn + fp
  const far = negatives ? fp / negatives : 0
  return { tp, fp, tn, fn, far, hits: tp }
}
