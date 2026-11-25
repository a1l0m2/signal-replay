#!/usr/bin/env python3
"""Powered-panel eval: frozen features, matched FAR, N>=200 test-onset gate.

Mirrors src/lib/features.ts + logistic.ts + pilotEval matched-FAR protocol.
No feature expansion. Open snapshots only.
"""
from __future__ import annotations

import json
import math
import random
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parents[1]
OHLCV = ROOT / "public/data/powered/ohlcv"
NEWS = ROOT / "public/data/powered/news_panel.json"
OUT = ROOT / "public/data/powered/powered_eval_result.json"

TARGET_FAR = 0.2
ONSET_HORIZON = 10
MIN_TEST_ONSETS = 200
BOOTSTRAP = 1000
C = 1.0
STEPS = 600
LR = 0.08
SEED = 42

BASELINE_NAMES = ["rv10", "vol_z20", "abs_ret5", "abs_ret1"]
NEWS_NAMES = ["n_expect", "n_surprise", "has_correction", "recency"]


def logret(a, b):
    return math.log(b / a)


def detect_moves(closes):
    n = len(closes)
    abs_rets = [0.0] + [abs(logret(closes[i - 1], closes[i])) for i in range(1, n)]
    moves = []
    i = 20
    while i < n:
        wr = logret(closes[i - 20], closes[i])
        aw = abs(wr)
        look = [x for x in abs_rets[max(1, i - 60) : i] if x > 0]
        thr = (median(look) if look else 0.002) * 2.5
        if aw > thr:
            direction = 1 if wr > 0 else -1
            sustained = True
            for k in range(1, 4):
                if i + k >= n:
                    break
                step = logret(closes[i + k - 1], closes[i + k])
                if abs(step) > 0.001 and (1 if step > 0 else -1) != direction:
                    sustained = False
                    break
            if sustained:
                end_t = i
                while end_t + 1 < n:
                    step = logret(closes[end_t], closes[end_t + 1])
                    if (1 if step > 0 else -1) != direction and abs(step) > 0.004:
                        break
                    if end_t - i > 25:
                        break
                    end_t += 1
                    if abs(step) < 0.0015 and end_t - i > 5:
                        break
                moves.append(i)
                i = end_t + 1
                continue
        i += 1
    return moves


def baseline_features(bars, t):
    def mean_abs(lookback):
        start = max(1, t - lookback + 1)
        s = n = 0
        for i in range(start, t + 1):
            s += abs(logret(bars[i - 1]["close"], bars[i]["close"]))
            n += 1
        return s / n if n else 0.0

    def vol_z(lookback):
        sl = bars[max(0, t - lookback + 1) : t + 1]
        if len(sl) < 2:
            return 0.0
        mean = sum(b["volume"] for b in sl) / len(sl)
        var = sum((b["volume"] - mean) ** 2 for b in sl) / len(sl)
        sd = math.sqrt(var) or 1.0
        return (bars[t]["volume"] - mean) / sd

    abs_ret5 = abs(logret(bars[t - 5]["close"], bars[t]["close"])) if t >= 5 else 0.0
    abs_ret1 = abs(logret(bars[t - 1]["close"], bars[t]["close"])) if t >= 1 else 0.0
    return {
        "rv10": mean_abs(10),
        "vol_z20": vol_z(20),
        "abs_ret5": abs_ret5,
        "abs_ret1": abs_ret1,
    }


def news_features(stories, t):
    eligible = [
        s
        for s in stories
        if s["firstAvailableAt"] <= t and s["narrativeRole"] in ("pre_move", "quiet")
    ]
    n_expect = sum(1 for s in eligible if "expectation" in s["tags"])
    n_surprise = sum(1 for s in eligible if "surprise" in s["tags"])
    has_correction = 1 if any(s["kind"] in ("correction", "revision") for s in eligible) else 0
    recency = 0.0
    if eligible:
        latest = max(s["firstAvailableAt"] for s in eligible)
        recency = math.exp(-max(0, t - latest) / 10)
    return {
        "n_expect": n_expect,
        "n_surprise": n_surprise,
        "has_correction": has_correction,
        "recency": recency,
    }


def sigmoid(z):
    if z >= 0:
        e = math.exp(-z)
        return 1 / (1 + e)
    e = math.exp(z)
    return e / (1 + e)


def fit_logistic(X, y, names):
    n = len(X)
    d = len(names)
    if n == 0:
        return {"w": [0.0] * d, "b": 0.0, "names": names}
    mean = [0.0] * d
    sd = [1.0] * d
    for j in range(d):
        mean[j] = sum(row[j] for row in X) / n
        var = sum((row[j] - mean[j]) ** 2 for row in X) / n
        sd[j] = math.sqrt(var) or 1.0
    Xs = [[(row[j] - mean[j]) / sd[j] for j in range(d)] for row in X]
    w = [0.0] * d
    b = 0.0
    for _ in range(STEPS):
        gw = [0.0] * d
        gb = 0.0
        for i in range(n):
            z = b + sum(Xs[i][j] * w[j] for j in range(d))
            p = sigmoid(z)
            err = p - y[i]
            for j in range(d):
                gw[j] += err * Xs[i][j]
            gb += err
        for j in range(d):
            gw[j] = gw[j] / n + (1 / C) * w[j] / n
            w[j] -= LR * gw[j]
        b -= LR * (gb / n)
    w_orig = [w[j] / sd[j] for j in range(d)]
    b_orig = b - sum(w[j] * mean[j] / sd[j] for j in range(d))
    return {"w": w_orig, "b": b_orig, "names": names}


def predict(model, x):
    z = model["b"] + sum(model["w"][j] * x[j] for j in range(len(model["w"])))
    return sigmoid(z)


def threshold_for_far(scores, labels, target):
    neg = sorted((s for s, y in zip(scores, labels) if y == 0), reverse=True)
    if not neg:
        return 1.0
    max_false = int(target * len(neg))
    if max_false <= 0:
        return neg[0] + 1e-9
    return neg[min(max_false, len(neg) - 1)]


def confusion(scores, labels, thr):
    tp = fp = tn = fn = 0
    for s, y in zip(scores, labels):
        pred = 1 if s >= thr else 0
        if pred == 1 and y == 1:
            tp += 1
        elif pred == 1 and y == 0:
            fp += 1
        elif pred == 0 and y == 0:
            tn += 1
        else:
            fn += 1
    neg = tn + fp
    far = fp / neg if neg else 0.0
    return {"tp": tp, "fp": fp, "tn": tn, "fn": fn, "far": far, "hits": tp}


def main():
    random.seed(SEED)
    news_all = json.loads(NEWS.read_text())["stories"]
    by_sym_news = {}
    for s in news_all:
        by_sym_news.setdefault(s["symbol"], []).append(s)

    # shared calendar from SPY
    spy = json.loads((OHLCV / "SPY.json").read_text())
    cal = [r["time"] for r in spy]
    ncal = len(cal)
    train_end = cal[int(ncal * 0.6)]
    tune_end = cal[int(ncal * 0.8)]
    date_split = {"train_end": train_end, "tune_end": tune_end, "test_end": cal[-1]}

    samples = {"train": [], "tune": [], "test": []}
    test_onset_count = 0
    total_moves = 0

    for path in sorted(OHLCV.glob("*.json")):
        sym = path.stem
        bars = json.loads(path.read_text())
        for i, b in enumerate(bars):
            b["t"] = i
        closes = [b["close"] for b in bars]
        onsets = set(detect_moves(closes))
        total_moves += len(onsets)
        stories = by_sym_news.get(sym, [])
        # chronological membership by bar date
        for t in range(len(bars)):
            day = bars[t]["time"]
            if day < train_end:
                split = "train"
                hi = train_end
            elif day < tune_end:
                split = "tune"
                hi = tune_end
            else:
                split = "test"
                hi = cal[-1]
            # outcome window must stay in split: t+H date <= split hi and index exists
            if t + ONSET_HORIZON >= len(bars):
                continue
            end_day = bars[t + ONSET_HORIZON]["time"]
            if split == "train" and end_day >= train_end:
                continue
            if split == "tune" and (end_day < train_end or end_day >= tune_end):
                continue
            if split == "test" and end_day < tune_end:
                continue
            y = 1 if any((t + h) in onsets for h in range(1, ONSET_HORIZON + 1)) else 0
            bf = baseline_features(bars, t)
            nf = news_features(stories, t)
            xb = [bf[k] for k in BASELINE_NAMES]
            xn = xb + [nf[k] for k in NEWS_NAMES]
            month = day[:7]
            samples[split].append({"y": y, "xb": xb, "xn": xn, "month": month, "sym": sym, "t": t})
        test_onset_count += sum(1 for o in onsets if bars[o]["time"] >= tune_end)

    result = {
        "gate": {
            "minTestOnsets": MIN_TEST_ONSETS,
            "testOnsets": test_onset_count,
            "passed": test_onset_count >= MIN_TEST_ONSETS,
            "meaning": "N>=200 counts large-move onset episodes whose onsetDate falls in the test calendar window (not train/tune).",
        },
        "nSymbols": len(list(OHLCV.glob('*.json'))),
        "nMovesTotal": total_moves,
        "splits": date_split,
        "trainN": len(samples["train"]),
        "tuneN": len(samples["tune"]),
        "testN": len(samples["test"]),
        "testPositives": sum(s["y"] for s in samples["test"]),
        "targetFar": TARGET_FAR,
        "featureFreeze": BASELINE_NAMES + NEWS_NAMES,
    }

    if test_onset_count < MIN_TEST_ONSETS:
        result["verdict"] = "underpowered"
        result["note"] = (
            f"Abort: test onsets={test_onset_count} < {MIN_TEST_ONSETS}. "
            "Do not interpret lift. Pre-registered power gate failed."
        )
        OUT.write_text(json.dumps(result, indent=2))
        print(json.dumps(result, indent=2))
        return 2

    y_tr = [s["y"] for s in samples["train"]]
    Xb_tr = [s["xb"] for s in samples["train"]]
    Xn_tr = [s["xn"] for s in samples["train"]]
    model_b = fit_logistic(Xb_tr, y_tr, BASELINE_NAMES)
    model_n = fit_logistic(Xn_tr, y_tr, BASELINE_NAMES + NEWS_NAMES)

    def scores(model, key):
        return [predict(model, s[key]) for s in samples["test"]]

    y_te = [s["y"] for s in samples["test"]]
    sb = scores(model_b, "xb")
    sn = scores(model_n, "xn")
    thr_b = threshold_for_far(sb, y_te, TARGET_FAR)
    thr_n = threshold_for_far(sn, y_te, TARGET_FAR)
    base = confusion(sb, y_te, thr_b)
    news = confusion(sn, y_te, thr_n)
    extra = news["hits"] - base["hits"]

    # month block bootstrap with FAR rematch
    by_month = {}
    for i, s in enumerate(samples["test"]):
        by_month.setdefault(s["month"], []).append(i)
    months = list(by_month.keys())
    extras = []
    for _ in range(BOOTSTRAP):
        pick = []
        for _m in months:
            m = random.choice(months)
            pick.extend(by_month[m])
        if not pick:
            continue
        y = [y_te[i] for i in pick]
        sb_p = [sb[i] for i in pick]
        sn_p = [sn[i] for i in pick]
        tb = threshold_for_far(sb_p, y, TARGET_FAR)
        tn = threshold_for_far(sn_p, y, TARGET_FAR)
        extras.append(confusion(sn_p, y, tn)["hits"] - confusion(sb_p, y, tb)["hits"])
    extras.sort()
    lo = extras[int(0.05 * len(extras))] if extras else 0
    hi = extras[min(len(extras) - 1, int(0.95 * len(extras)))] if extras else 0
    mean = sum(extras) / len(extras) if extras else 0.0
    verdict = "lift" if hi > 0 and lo > 0 else "null"
    note = (
        "News-aware shows positive extra hits at matched FAR with 90% CI entirely above 0. Research demo only — not trading evidence."
        if verdict == "lift"
        else "Honest null: news-aware does not improve extra onset hits at matched FAR within 90% bootstrap CI (includes ≤0). No feature expansion."
    )

    result.update(
        {
            "baseline": {"thr": thr_b, **base},
            "newsAware": {"thr": thr_n, **news},
            "extraHits": extra,
            "bootstrapExtraHits": {"mean": mean, "lo90": lo, "hi90": hi, "iters": BOOTSTRAP},
            "verdict": verdict,
            "note": note,
        }
    )
    OUT.write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
