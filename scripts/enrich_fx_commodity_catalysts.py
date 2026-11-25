#!/usr/bin/env python3
"""Denser free FX/commodity catalysts from GDELT GKG (open, no credentials).

Expands aliases + topic proxies, samples more monthly GKG snapshots, merges into
existing multi-asset packs without touching OHLCV/moves detection.
Honest: still a weak GKG clock; topic proxies are labeled.
"""
from __future__ import annotations

import csv
import io
import json
import time
import urllib.request
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/data/multi-asset"
SYM_DIR = OUT / "symbols"
UA = "SignalReplayResearch/1.0"

# Broader free aliases + topic proxies (mapped to symbols; tagged topic-proxy when proxy-only)
FX_CMDTY_ALIASES: dict[str, list[str]] = {
    "EURUSD=X": [
        "EURUSD",
        "EUR/USD",
        "EUR-USD",
        "euro dollar",
        "euro-dollar",
        "EUR USD",
        "european central bank",
        " ECB ",
        "eurozone",
        "euro zone",
        "ECB rate",
        "ECB policy",
    ],
    "GBPUSD=X": [
        "GBPUSD",
        "GBP/USD",
        "pound dollar",
        "cable FX",
        "Bank of England",
        " BOE ",
        "sterling",
        "pound sterling",
        "UK rate decision",
    ],
    "USDJPY=X": [
        "USDJPY",
        "USD/JPY",
        "dollar yen",
        "yen dollar",
        "Bank of Japan",
        " BOJ ",
        "yen intervention",
        "Japanese yen",
    ],
    "USDCHF=X": [
        "USDCHF",
        "USD/CHF",
        "dollar swiss",
        "Swiss franc",
        "SNB ",
        "Swiss National Bank",
    ],
    "AUDUSD=X": [
        "AUDUSD",
        "AUD/USD",
        "aussie dollar",
        "Australian dollar",
        "RBA rate",
        "Reserve Bank of Australia",
    ],
    "USDCAD=X": [
        "USDCAD",
        "USD/CAD",
        "loonie",
        "Canadian dollar",
        "Bank of Canada",
        " BoC ",
    ],
    "GC=F": [
        "gold price",
        "spot gold",
        "XAUUSD",
        "XAU/USD",
        "gold futures",
        "COMEX gold",
        "bullion",
        "gold market",
        "gold rally",
        "gold falls",
    ],
    "SI=F": [
        "silver price",
        "XAGUSD",
        "XAG/USD",
        "silver futures",
        "COMEX silver",
        "silver market",
        "silver rally",
    ],
    "CL=F": [
        "crude oil",
        "WTI",
        "Brent crude",
        "oil futures",
        "oil price",
        "OPEC",
        "crude inventory",
        "oil rally",
        "oil falls",
        "petroleum",
    ],
    "NG=F": [
        "natural gas",
        "natgas",
        "natural-gas",
        "Henry Hub",
        "LNG price",
        "gas futures",
    ],
    "HG=F": [
        "copper price",
        "copper futures",
        "LME copper",
        "copper market",
        "copper rally",
    ],
}

# Aliases that are topic proxies (not direct ticker string) — for tagging
TOPIC_HINTS = (
    "european central bank",
    " ecb ",
    "eurozone",
    "euro zone",
    "ecb rate",
    "ecb policy",
    "bank of england",
    " boe ",
    "sterling",
    "pound sterling",
    "uk rate",
    "bank of japan",
    " boj ",
    "yen intervention",
    "japanese yen",
    "swiss franc",
    "snb ",
    "swiss national bank",
    "aussie dollar",
    "australian dollar",
    "rba rate",
    "reserve bank of australia",
    "loonie",
    "canadian dollar",
    "bank of canada",
    " boc ",
    "comex gold",
    "bullion",
    "gold market",
    "gold rally",
    "gold falls",
    "comex silver",
    "silver market",
    "silver rally",
    "opec",
    "crude inventory",
    "oil rally",
    "oil falls",
    "petroleum",
    "natgas",
    "natural-gas",
    "henry hub",
    "lng price",
    "gas futures",
    "lme copper",
    "copper market",
    "copper rally",
)


def file_key(sym: str) -> str:
    return sym.replace("=", "_").replace("/", "_")


def match_fx_cmdty(text: str) -> list[tuple[str, bool]]:
    """Return (symbol, is_topic_proxy) hits."""
    low = f" {text.lower()} "
    hits: list[tuple[str, bool]] = []
    for sym, als in FX_CMDTY_ALIASES.items():
        for a in als:
            needle = a.lower()
            if needle in low:
                is_proxy = any(h in needle or needle in h for h in TOPIC_HINTS) or (
                    needle.strip() in TOPIC_HINTS
                )
                # direct ticker-ish strings are not proxies
                if any(
                    x in needle
                    for x in (
                        "eurusd",
                        "gbpusd",
                        "usdjpy",
                        "usdchf",
                        "audusd",
                        "usdcad",
                        "xau",
                        "xag",
                        "wti",
                        "brent",
                        "crude oil",
                        "gold price",
                        "silver price",
                        "copper price",
                        "natural gas",
                    )
                ):
                    is_proxy = False
                hits.append((sym, is_proxy))
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


def map_day_to_t(day: str, date_to_t: dict, bars: list[dict]) -> int | None:
    if day in date_to_t:
        return date_to_t[day]
    return next((b["t"] for b in bars if b["time"] >= day), None)


def main() -> None:
    csv.field_size_limit(10_000_000)
    packs = {}
    for path in sorted(SYM_DIR.glob("*.json")):
        p = json.loads(path.read_text())
        packs[p["symbol"]] = p

    target_syms = set(FX_CMDTY_ALIASES)
    seen: set[tuple[str, str]] = set()
    existing_by_sym: dict[str, list] = defaultdict(list)

    news_path = OUT / "news.json"
    if news_path.exists():
        for s in json.loads(news_path.read_text()).get("stories", []):
            sym = s.get("symbol")
            if not sym:
                continue
            existing_by_sym[sym].append(s)
            url = s.get("url") or s["id"]
            seen.add((sym, url))

    stamps = []
    for y in range(2017, 2027):
        for m in range(1, 13):
            stamps.append(f"{y}{m:02d}15")
            if m % 2 == 0:
                stamps.append(f"{y}{m:02d}01")

    new_stories = []
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
                        hits = match_fx_cmdty(f"{orgs} {themes} {url_doc}")
                        if not hits:
                            continue
                        try:
                            tone = float(tone_s.split(",")[0])
                        except Exception:
                            tone = 0.0
                        for sym, is_proxy in hits:
                            if sym not in target_syms or sym not in packs:
                                continue
                            key = (sym, url_doc)
                            if key in seen:
                                continue
                            seen.add(key)
                            tags = ["gdelt", "expectation"]
                            if is_proxy:
                                tags.append("topic-proxy")
                            if tone <= -1:
                                tags.append("surprise")
                            kind_label = "topic proxy" if is_proxy else "mention"
                            new_stories.append(
                                {
                                    "id": f"gkg-{file_key(sym)}-{abs(hash(url_doc)) % 10**12}",
                                    "eventId": f"gkg-url-{abs(hash(url_doc)) % 10**10}",
                                    "symbol": sym,
                                    "version": 1,
                                    "headline": f"[GDELT-GKG] {sym} {kind_label} {dayiso}",
                                    "body": (
                                        f"GKG sample ({kind_label}). url={url_doc}. tone={tone}. "
                                        "Weak clock: GKG DATE. Open/free — not wire first-seen."
                                    ),
                                    "tags": tags,
                                    "kind": "story",
                                    "narrativeRole": "quiet",
                                    "source": "gdelt-gkg",
                                    "url": url_doc,
                                    "publishedDate": dayiso,
                                    "firstAvailableDate": dayiso,
                                }
                            )
                            extra += 1
            print(f"GKG {stamp} new_extra={extra}")
            time.sleep(0.25)
        except Exception as e:
            print(f"GKG fail {stamp} {e}")
            time.sleep(0.35)

    # Map new stories onto bar indices and merge
    added_mapped = 0
    for s in new_stories:
        sym = s["symbol"]
        pack = packs[sym]
        date_to_t = {b["time"]: b["t"] for b in pack["bars"]}
        day = s["firstAvailableDate"]
        t = map_day_to_t(day, date_to_t, pack["bars"])
        if t is None:
            continue
        s["publishedAt"] = t
        s["firstAvailableAt"] = t
        s["narrativeRole"] = role_for(t, pack["moves"])
        s["assetClass"] = pack["assetClass"]
        existing_by_sym[sym].append(s)
        added_mapped += 1

    # Rebuild packs + index + news + manifest coverage for fx/commodity
    all_stories = []
    for sym, pack in packs.items():
        stories = existing_by_sym.get(sym, pack.get("stories") or [])
        # dedupe by id
        by_id = {}
        for s in stories:
            by_id[s["id"]] = s
        stories = list(by_id.values())
        stories.sort(key=lambda x: (x.get("firstAvailableAt", 0), x["id"]))
        pack["stories"] = stories
        # refresh event jumps from stories lightly
        jumps = [{"t": 0, "label": "Start"}]
        for s in stories[:12]:
            jumps.append(
                {
                    "t": int(s["firstAvailableAt"]),
                    "label": (s.get("headline") or "")[:48],
                }
            )
        for m in pack["moves"][:8]:
            jumps.append({"t": m["onsetT"], "label": f"Move onset day {m['onsetT']}"})
        pack["eventJumps"] = jumps
        for m in pack["moves"]:
            m["hasIdentifiedCatalyst"] = any(
                s["narrativeRole"] == "pre_move"
                and s["firstAvailableAt"] < m["onsetT"]
                and s["firstAvailableAt"] >= m["onsetT"] - 25
                for s in stories
            )
        (SYM_DIR / f"{file_key(sym)}.json").write_text(json.dumps(pack, separators=(",", ":")))
        all_stories.extend(stories)

    index = {
        "symbols": [
            {
                "symbol": p["symbol"],
                "file": file_key(p["symbol"]),
                "class": p["assetClass"],
                "nBars": len(p["bars"]),
                "nMoves": len(p["moves"]),
                "nStories": len(p["stories"]),
            }
            for p in packs.values()
        ],
        "classes": ["etf", "stock", "forex", "crypto", "commodity"],
    }
    (OUT / "index.json").write_text(json.dumps(index, indent=2))
    (OUT / "news.json").write_text(json.dumps({"stories": all_stories}))

    cov = defaultdict(lambda: {"symbols": 0, "moves": 0, "stories": 0})
    for p in packs.values():
        cov[p["assetClass"]]["symbols"] += 1
        cov[p["assetClass"]]["moves"] += len(p["moves"])
        cov[p["assetClass"]]["stories"] += len(p["stories"])

    manifest = {}
    mp = OUT / "manifest.json"
    if mp.exists():
        manifest = json.loads(mp.read_text())
    manifest["coverage"] = {k: dict(v) for k, v in cov.items()}
    manifest["nStories"] = len(all_stories)
    manifest["fxCommodityEnrich"] = {
        "addedMapped": added_mapped,
        "source": "GDELT GKG bulk monthly(+bi-monthly) open samples",
        "note": "Topic proxies tagged; weak GKG clock; gold/silver/FX may remain sparse",
    }
    mp.write_text(json.dumps(manifest, indent=2))

    print("added_mapped", added_mapped)
    print("coverage", json.dumps(manifest["coverage"], indent=2))
    print("fx/cmdty", {k: cov[k] for k in ("forex", "commodity")})
    print("by_symbol", {s: len(existing_by_sym[s]) for s in sorted(target_syms)})


if __name__ == "__main__":
    main()
