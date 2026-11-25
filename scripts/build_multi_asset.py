#!/usr/bin/env python3
"""Build multi-asset moves + open catalysts (EDGAR stocks, GDELT cross-asset)."""
from __future__ import annotations

import csv
import io
import json
import math
import re
import time
import urllib.request
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parents[1]
META = json.loads((ROOT / "public/data/powered/multi_asset_ohlcv_meta.json").read_text())
OHLCV = ROOT / "public/data/powered/ohlcv"
OUT = ROOT / "public/data/multi-asset"
OUT.mkdir(parents=True, exist_ok=True)

ALIASES = {
    "SPY": [" SPY ", "S&P 500", "S&P500"],
    "QQQ": [" QQQ ", "Nasdaq-100", "Nasdaq 100"],
    "IWM": [" IWM ", "Russell 2000"],
    "DIA": [" DIA ", "Dow Jones"],
    "XLF": [" XLF ", "financial sector"],
    "XLE": [" XLE ", "energy sector ETF"],
    "XLK": [" XLK ", "technology sector ETF"],
    "GLD": [" GLD ", "gold ETF"],
    "USO": [" USO ", "oil ETF"],
    "TLT": [" TLT ", "Treasury bond ETF"],
    "AAPL": ["AAPL", "Apple Inc", "Apple "],
    "MSFT": ["MSFT", "Microsoft"],
    "AMZN": ["AMZN", "Amazon.com", "Amazon "],
    "GOOGL": ["GOOGL", "Alphabet", "Google"],
    "META": ["Meta Platforms", "Facebook"],
    "NVDA": ["NVDA", "NVIDIA", "Nvidia"],
    "JPM": ["JPM", "JPMorgan", "JP Morgan"],
    "XOM": ["XOM", "Exxon"],
    "EURUSD=X": ["EURUSD", "EUR/USD", "euro dollar", "EUR-USD"],
    "GBPUSD=X": ["GBPUSD", "GBP/USD", "pound dollar"],
    "USDJPY=X": ["USDJPY", "USD/JPY", "dollar yen"],
    "USDCHF=X": ["USDCHF", "USD/CHF", "dollar swiss"],
    "AUDUSD=X": ["AUDUSD", "AUD/USD", "aussie dollar"],
    "USDCAD=X": ["USDCAD", "USD/CAD"],
    "BTC-USD": ["Bitcoin", " BTC ", "BTCUSD", "BTC-USD"],
    "ETH-USD": ["Ethereum", " ETH ", "ETHUSD", "ETH-USD"],
    "SOL-USD": ["Solana", " SOL ", "SOLUSD"],
    "GC=F": ["gold price", "spot gold", "XAUUSD", "gold futures"],
    "SI=F": ["silver price", "XAGUSD", "silver futures"],
    "CL=F": ["crude oil", "WTI", "Brent crude", "oil futures"],
    "NG=F": ["natural gas", "Henry Hub"],
    "HG=F": ["copper price", "copper futures"],
}

WINDOW, LOOKBACK, MULT, SUSTAIN = 20, 60, 2.5, 3


def file_key(sym: str) -> str:
    return sym.replace("=", "_").replace("/", "_")


def detect(rows: list[dict]) -> list[dict]:
    # skip nonpositive closes (e.g. WTI 2020-04-20)
    closes = []
    for r in rows:
        c = r["close"]
        closes.append(c if c and c > 0 else None)
    n = len(closes)
    abs_rets = [0.0]
    for i in range(1, n):
        if closes[i] is None or closes[i - 1] is None:
            abs_rets.append(0.0)
        else:
            abs_rets.append(abs(math.log(closes[i] / closes[i - 1])))
    moves = []
    i = WINDOW
    while i < n:
        if closes[i] is None or closes[i - WINDOW] is None:
            i += 1
            continue
        wr = math.log(closes[i] / closes[i - WINDOW])
        aw = abs(wr)
        look = [x for x in abs_rets[max(1, i - LOOKBACK) : i] if x > 0]
        thr = (median(look) if look else 0.002) * MULT
        if aw > thr:
            direction = 1 if wr > 0 else -1
            sustained = True
            for k in range(1, SUSTAIN + 1):
                if i + k >= n or closes[i + k] is None or closes[i + k - 1] is None:
                    sustained = False
                    break
                step = math.log(closes[i + k] / closes[i + k - 1])
                if abs(step) > 0.001 and (1 if step > 0 else -1) != direction:
                    sustained = False
                    break
            if sustained:
                end_t = i
                peak = aw
                while end_t + 1 < n:
                    if closes[end_t + 1] is None or closes[end_t] is None:
                        break
                    step = math.log(closes[end_t + 1] / closes[end_t])
                    if (1 if step > 0 else -1) != direction and abs(step) > 0.004:
                        break
                    if end_t - i > 25:
                        break
                    end_t += 1
                    if abs(step) < 0.0015 and end_t - i > 5:
                        break
                    if (1 if step > 0 else -1) == direction and closes[i - WINDOW]:
                        peak = max(peak, abs(math.log(closes[end_t] / closes[i - WINDOW])))
                moves.append(
                    {
                        "onsetT": i,
                        "endT": end_t,
                        "onsetDate": rows[i]["time"],
                        "endDate": rows[end_t]["time"],
                        "direction": direction,
                        "peakAbsReturn": peak,
                        "hasIdentifiedCatalyst": False,
                    }
                )
                i = end_t + 1
                continue
        i += 1
    return moves


def match_symbols(text: str) -> list[str]:
    hits = []
    low = text.lower()
    for sym, als in ALIASES.items():
        for a in als:
            if a.lower() in low:
                hits.append(sym)
                break
    return hits


def role_for(avail_t: int, moves: list[dict]) -> str:
    for m in moves:
        if m["onsetT"] <= avail_t <= m["endT"]:
            return "mid_move"
        if avail_t > m["endT"] and avail_t <= m["endT"] + 5:
            return "post_move"
    for m in moves:
        if m["onsetT"] - 25 <= avail_t < m["onsetT"]:
            return "pre_move"
    return "quiet"


def main() -> None:
    panel: dict = {}
    for t in META["tickers"]:
        sym, key, cls = t["symbol"], t["file"], t["class"]
        rows = json.loads((OHLCV / f"{key}.json").read_text())
        for i, r in enumerate(rows):
            r["t"] = i
        moves = detect(rows)
        panel[sym] = {
            "class": cls,
            "file": key,
            "bars": rows,
            "dateToT": {r["time"]: r["t"] for r in rows},
            "moves": moves,
        }
        print(f"moves {cls:10s} {sym:12s} {len(moves):3d}")

    gdelt_stories = []
    seen: set = set()
    old = ROOT / "public/data/powered/news_gdelt.json"
    if old.exists():
        for s in json.loads(old.read_text())["stories"]:
            if s.get("symbol") in panel:
                gdelt_stories.append(s)
                seen.add((s["symbol"], s.get("url") or s["id"]))

    csv.field_size_limit(10_000_000)
    UA = "SignalReplayResearch/1.0"
    stamps = []
    for y in range(2018, 2027):
        for m in (2, 5, 8, 11):
            stamps.append(f"{y}{m:02d}15")
    extra = 0
    for day in stamps:
        stamp = f"{day}120000"
        url = f"http://data.gdeltproject.org/gdeltv2/{stamp}.gkg.csv.zip"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=90) as r:
                blob = r.read()
            with zipfile.ZipFile(io.BytesIO(blob)) as zf:
                with zf.open(zf.namelist()[0]) as f:
                    text = io.TextIOWrapper(f, encoding="utf-8", errors="replace")
                    for row in csv.reader(text, delimiter="\t"):
                        if len(row) < 16:
                            continue
                        url_doc, orgs, themes, tone_s, date_raw = (
                            row[4],
                            row[13] or "",
                            row[7] or "",
                            row[15] or "0",
                            row[1],
                        )
                        if len(date_raw) < 8:
                            continue
                        dayiso = f"{date_raw[:4]}-{date_raw[4:6]}-{date_raw[6:8]}"
                        syms = match_symbols(f"{orgs} {themes} {url_doc}")
                        if not syms:
                            continue
                        try:
                            tone = float(tone_s.split(",")[0])
                        except Exception:
                            tone = 0.0
                        for sym in syms:
                            if sym not in panel:
                                continue
                            key = (sym, url_doc)
                            if key in seen:
                                continue
                            seen.add(key)
                            tags = ["gdelt", "expectation"]
                            if tone <= -1:
                                tags.append("surprise")
                            gdelt_stories.append(
                                {
                                    "id": f"gkg-{file_key(sym)}-{abs(hash(url_doc)) % 10**12}",
                                    "eventId": f"gkg-url-{abs(hash(url_doc)) % 10**10}",
                                    "symbol": sym,
                                    "version": 1,
                                    "publishedAt": dayiso,
                                    "firstAvailableAt": dayiso,
                                    "headline": f"[GDELT-GKG] {sym} mention {dayiso}",
                                    "body": f"GKG sample. url={url_doc}. tone={tone}. Weak clock: GKG DATE.",
                                    "tags": tags,
                                    "kind": "story",
                                    "narrativeRole": "pre_move",
                                    "source": "gdelt-gkg",
                                    "url": url_doc,
                                }
                            )
                            extra += 1
            print("GKG", stamp, "extra_total", extra)
            time.sleep(0.3)
        except Exception as e:
            print("GKG fail", stamp, e)
            time.sleep(0.4)

    edgar = []
    ep = ROOT / "public/data/powered/news_edgar.json"
    if ep.exists():
        for s in json.loads(ep.read_text())["stories"]:
            if s.get("symbol") in panel:
                edgar.append(s)

    stories_out = []
    for s in edgar + gdelt_stories:
        sym = s["symbol"]
        if sym not in panel:
            continue
        day = s.get("firstAvailableDate") or s.get("publishedDate")
        if not isinstance(day, str):
            fa = s.get("firstAvailableAt")
            day = fa if isinstance(fa, str) else s.get("publishedAt")
        if not isinstance(day, str):
            continue
        d2t = panel[sym]["dateToT"]
        if day in d2t:
            t = d2t[day]
        else:
            t = next((b["t"] for b in panel[sym]["bars"] if b["time"] >= day), None)
            if t is None:
                continue
        role = role_for(t, panel[sym]["moves"])
        stories_out.append(
            {
                **{k: s[k] for k in s if k not in ("publishedAt", "firstAvailableAt")},
                "publishedAt": t,
                "firstAvailableAt": t,
                "publishedDate": day,
                "firstAvailableDate": day,
                "narrativeRole": role,
                "assetClass": panel[sym]["class"],
            }
        )

    for sym, p in panel.items():
        for m in p["moves"]:
            m["hasIdentifiedCatalyst"] = any(
                s["symbol"] == sym
                and s["narrativeRole"] == "pre_move"
                and s["firstAvailableAt"] < m["onsetT"]
                and s["firstAvailableAt"] >= m["onsetT"] - 25
                for s in stories_out
            )

    cov = defaultdict(lambda: {"symbols": 0, "moves": 0, "stories": 0})
    for sym, p in panel.items():
        cov[p["class"]]["symbols"] += 1
        cov[p["class"]]["moves"] += len(p["moves"])
    for s in stories_out:
        cov[s["assetClass"]]["stories"] += 1

    manifest = {
        "universe": META["universe"],
        "coverage": {k: dict(v) for k, v in cov.items()},
        "nStories": len(stories_out),
        "nGdelt": len(gdelt_stories),
        "nEdgar": len(edgar),
        "gaps": META.get("failures", []),
        "symbols": [
            {**t, "nMoves": len(panel[t["symbol"]]["moves"])} for t in META["tickers"]
        ],
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))
    (OUT / "news.json").write_text(json.dumps({"stories": stories_out}))
    (OUT / "moves.json").write_text(
        json.dumps({sym: p["moves"] for sym, p in panel.items()})
    )
    print("stories", len(stories_out), Counter(s["assetClass"] for s in stories_out))
    print(json.dumps(manifest["coverage"], indent=2))


if __name__ == "__main__":
    main()
