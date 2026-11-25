# Signal Replay (Milestone 1)

Browser app that replays a **synthetic** ticker (`SYN`) through time to explore whether news available *at the time* could improve forecasts of unusually large moves — without claiming that it does.

## Run

```bash
cd /agent/signal-replay
npm install
npm run dev
```

## Test

```bash
cd /agent/signal-replay
npm test
```

## Validation pilot eval

```bash
npm run eval:pilot
```

Dataset switch in the UI: **SYN (M1 synthetic)** or **SPY (validation pilot)**.

## Build

```bash
npm run build
```

## Product rules encoded

- Cutoff uses `firstAvailableAt`, not `publishedAt`
- Corrections append versions; as-of queries never mutate history
- Onset forecasts exclude mid-move / post-move inputs
- Alerts dedupe by logical `eventId`
- Every forecast/evidence surface carries a synthetic disclaimer

See `/cursor/stores/self/docs/decision-note.md` and `milestone-1-handoff.md`.
