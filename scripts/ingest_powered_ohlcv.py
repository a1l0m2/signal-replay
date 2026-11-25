#!/usr/bin/env python3
"""Re-fetch open Yahoo daily OHLCV snapshots for the powered panel (no paid credentials)."""
import json, urllib.request, time, datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/data/powered/ohlcv"
OUT.mkdir(parents=True, exist_ok=True)

TICKERS = [
    "SPY", "QQQ", "IWM", "DIA", "XLF", "XLE", "XLK", "XLV", "XLI", "XLY",
    "AAPL", "MSFT", "AMZN", "GOOGL", "META", "NVDA", "JPM", "JNJ", "V", "UNH",
    "XOM", "PG", "MA", "HD", "CVX", "MRK", "ABBV", "PEP", "KO", "COST",
]

period1 = int(dt.datetime(2010, 1, 1, tzinfo=dt.timezone.utc).timestamp())
period2 = int(dt.datetime.now(tz=dt.timezone.utc).timestamp())
meta = {
    "fetchedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
    "source": "Yahoo Finance chart API v8 offline snapshot (period1/period2, interval=1d)",
    "periodStart": "2010-01-01",
    "interval": "1d",
    "licenseNote": "One-time research snapshot; no paid credentials.",
    "tickers": [],
    "failures": [],
}


def fetch(sym: str):
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}"
        f"?period1={period1}&period2={period2}&interval=1d"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 SignalReplayResearch/1.0"})
    with urllib.request.urlopen(req, timeout=90) as r:
        data = json.load(r)
    result = data["chart"]["result"][0]
    ts = result["timestamp"]
    q = result["indicators"]["quote"][0]
    rows = []
    for i, t in enumerate(ts):
        o, h, l, c, v = q["open"][i], q["high"][i], q["low"][i], q["close"][i], q["volume"][i]
        if None in (o, h, l, c, v):
            continue
        d = dt.datetime.fromtimestamp(t, dt.timezone.utc).strftime("%Y-%m-%d")
        rows.append(
            {
                "time": d,
                "open": round(float(o), 4),
                "high": round(float(h), 4),
                "low": round(float(l), 4),
                "close": round(float(c), 4),
                "volume": int(v),
            }
        )
    return rows


def main():
    for sym in TICKERS:
        try:
            rows = fetch(sym)
            (OUT / f"{sym}.json").write_text(json.dumps(rows, separators=(",", ":")))
            meta["tickers"].append(
                {"symbol": sym, "n": len(rows), "start": rows[0]["time"], "end": rows[-1]["time"]}
            )
            print(f"OK {sym} {len(rows)}")
            time.sleep(0.4)
        except Exception as e:
            meta["failures"].append({"symbol": sym, "error": str(e)})
            print(f"FAIL {sym} {e}")
            time.sleep(1.2)
    (ROOT / "public/data/powered/ohlcv_meta.json").write_text(json.dumps(meta, indent=2))
    print("done", len(meta["tickers"]), "fail", len(meta["failures"]))


if __name__ == "__main__":
    main()
