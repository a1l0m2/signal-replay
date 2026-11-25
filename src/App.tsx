import { useEffect, useMemo, useState } from 'react'
import { Chart } from './components/Chart'
import { Controls } from './components/Controls'
import { CatalystsView } from './components/CatalystsView'
import { EvidenceView } from './components/EvidenceView'
import { ForecastPanel } from './components/ForecastPanel'
import { Inbox } from './components/Inbox'
import { LiveTape } from './components/LiveTape'
import { NewsPanel } from './components/NewsPanel'
import {
  Walkthrough,
  shouldAutoOpenWalkthrough,
} from './components/Walkthrough'
import { DATASETS, DEFAULT_DATASET, type DatasetId } from './data/catalog'
import { loadMultiAssetIndex, loadMultiAssetPack } from './data/multiAsset/loadPack'
import {
  CLASS_LABELS,
  type AssetClass,
  type MultiAssetIndex,
  type MultiAssetPack,
} from './data/multiAsset/types'
import { useLiveQuote } from './lib/realtime/useLiveQuote'

type Tab = 'replay' | 'catalysts' | 'evidence' | 'inbox'

const MODE_COPY: Record<Tab, string> = {
  replay: 'Scrub time. Ask what was knowable before and during a large move.',
  catalysts:
    'Earnings, news, and other topics around large bullish/bearish moves — analysis, not a forecast claim.',
  inbox: 'Simulated alerts — jump back to the moment they would have fired.',
  evidence: 'After-action connection labels. Unclear is valid. Not used for forecasting.',
}

export default function App() {
  const [datasetId, setDatasetId] = useState<DatasetId>(DEFAULT_DATASET)
  const staticDataset = DATASETS[datasetId]

  const [maIndex, setMaIndex] = useState<MultiAssetIndex | null>(null)
  const [assetClass, setAssetClass] = useState<AssetClass>('crypto')
  const [symbol, setSymbol] = useState('BTC-USD')
  const [pack, setPack] = useState<MultiAssetPack | null>(null)
  const [packError, setPackError] = useState<string | null>(null)
  const [packLoading, setPackLoading] = useState(false)

  const isMulti = datasetId === 'multi-asset'

  const bars = isMulti && pack ? pack.bars : staticDataset.bars
  const stories = isMulti && pack ? pack.stories : staticDataset.stories
  const alertSeeds = isMulti && pack ? pack.alertSeeds : staticDataset.alertSeeds
  const moves = isMulti && pack ? pack.moves : staticDataset.moves
  const eventJumps = isMulti && pack ? pack.eventJumps : staticDataset.eventJumps
  const ticker =
    isMulti && pack
      ? {
          symbol: pack.symbol,
          name: `${CLASS_LABELS[pack.assetClass]} · ${pack.symbol}`,
          disclaimer: pack.disclaimer,
        }
      : staticDataset.ticker

  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [tab, setTab] = useState<Tab>(isMulti ? 'catalysts' : 'replay')
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null)
  const [mode, setMode] = useState<'baseline' | 'news'>('baseline')
  const [jumpIdx, setJumpIdx] = useState(0)
  const [walkthroughOpen, setWalkthroughOpen] = useState(false)

  const maxT = Math.max(0, bars.length - 1)

  const liveSymbol = isMulti
    ? symbol
    : datasetId === 'synthetic'
      ? null
      : staticDataset.ticker.symbol
  const live = useLiveQuote(liveSymbol, { enabled: liveSymbol != null, pollMs: 60_000 })

  useEffect(() => {
    if (shouldAutoOpenWalkthrough()) setWalkthroughOpen(true)
  }, [])

  useEffect(() => {
    if (!isMulti) return
    let cancelled = false
    loadMultiAssetIndex()
      .then((idx) => {
        if (cancelled) return
        setMaIndex(idx)
        const inClass = idx.symbols.filter((s) => s.class === assetClass)
        const pick = inClass.find((s) => s.symbol === symbol) ?? inClass[0]
        if (pick) setSymbol(pick.symbol)
      })
      .catch((e: Error) => setPackError(e.message))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMulti])

  useEffect(() => {
    if (!isMulti || !maIndex) return
    const entry = maIndex.symbols.find((s) => s.symbol === symbol)
    if (!entry) return
    let cancelled = false
    setPackLoading(true)
    setPackError(null)
    loadMultiAssetPack(entry.file)
      .then((p) => {
        if (cancelled) return
        setPack(p)
        setT(0)
        setPlaying(false)
        setSelectedStoryId(null)
        setJumpIdx(0)
      })
      .catch((e: Error) => {
        if (!cancelled) setPackError(e.message)
      })
      .finally(() => {
        if (!cancelled) setPackLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isMulti, maIndex, symbol])

  useEffect(() => {
    setT(0)
    setPlaying(false)
    setSelectedStoryId(null)
    setJumpIdx(0)
    if (datasetId === 'multi-asset') setTab('catalysts')
  }, [datasetId])

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setT((prev) => {
        if (prev >= maxT) {
          setPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, 450 / speed)
    return () => window.clearInterval(id)
  }, [playing, speed, maxT])

  const classSymbols = useMemo(() => {
    if (!maIndex) return []
    return maIndex.symbols.filter((s) => s.class === assetClass)
  }, [maIndex, assetClass])

  const nextJump = useMemo(() => {
    if (!eventJumps.length) return { t: 0, label: 'Start' }
    return eventJumps[jumpIdx % eventJumps.length]!
  }, [jumpIdx, eventJumps])

  return (
    <div className="sr-app">
      <header className="sr-top">
        <div className="sr-brand-block">
          <p className="sr-brand">
            Signal <em>Replay</em>
          </p>
          <p className="sr-tagline">
            Multi-asset catalyst analysis — forex, crypto, stocks, ETFs, commodities — with the
            cutoff, not with hindsight.
          </p>
        </div>
        <div className="sr-top-right">
          <label className="sr-dataset">
            Dataset
            <select
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value as DatasetId)}
              aria-label="Dataset"
            >
              {(Object.keys(DATASETS) as DatasetId[]).map((id) => (
                <option key={id} value={id}>
                  {DATASETS[id].label}
                </option>
              ))}
            </select>
          </label>
          <nav className="sr-modes" aria-label="App mode">
            {(
              [
                ['replay', 'Replay'],
                ['catalysts', 'Catalysts'],
                ['inbox', 'Alerts'],
                ['evidence', 'After-action'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={tab === id ? 'active' : ''}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            className="sr-guide-btn"
            onClick={() => setWalkthroughOpen(true)}
            aria-label="Open first-run guide"
          >
            Guide
          </button>
        </div>
      </header>

      <Walkthrough open={walkthroughOpen} onClose={() => setWalkthroughOpen(false)} />

      {isMulti && (
        <div className="sr-asset-bar" role="group" aria-label="Asset class and symbol">
          <label className="sr-dataset">
            Class
            <select
              value={assetClass}
              aria-label="Asset class"
              onChange={(e) => {
                const next = e.target.value as AssetClass
                setAssetClass(next)
                const first = maIndex?.symbols.find((s) => s.class === next)
                if (first) setSymbol(first.symbol)
              }}
            >
              {(maIndex?.classes ?? (Object.keys(CLASS_LABELS) as AssetClass[])).map((c) => (
                <option key={c} value={c}>
                  {CLASS_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="sr-dataset">
            Symbol
            <select
              value={symbol}
              aria-label="Symbol"
              onChange={(e) => setSymbol(e.target.value)}
            >
              {classSymbols.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol} · {s.nMoves} moves · {s.nStories} catalysts
                </option>
              ))}
            </select>
          </label>
          {packLoading && <span className="sr-help">Loading pack…</span>}
          {packError && <span className="sr-help">Error: {packError}</span>}
        </div>
      )}

      {liveSymbol && (
        <LiveTape
          symbol={liveSymbol}
          quote={live.quote}
          error={live.error}
          loading={live.loading}
          liveOn={live.liveOn}
          onToggle={live.setLiveOn}
          onRefresh={() => void live.refresh()}
          pollMs={live.pollMs}
        />
      )}

      <div className="sr-context-strip" role="status">
        <span className="sr-chip sr-chip-hist">Historical pack</span>
        <span className="sr-help">
          Frozen open OHLCV + catalysts for {ticker.symbol}
          {isMulti && pack ? ` · ${CLASS_LABELS[pack.assetClass]}` : ''}. Replay/Catalysts use this
          only.
        </span>
        {liveSymbol && (
          <>
            <span className={`sr-chip ${live.liveOn ? 'sr-chip-live' : 'sr-chip-live-off'}`}>
              {live.liveOn ? 'Live tape on' : 'Live tape off'}
            </span>
            <span className="sr-help">
              {live.liveOn
                ? 'Delayed Yahoo glance — separate lane, not part of the scrubber.'
                : 'Live paused — historical scrub only.'}
            </span>
          </>
        )}
      </div>

      <p className="sr-mode-hint">{MODE_COPY[tab]}</p>

      {tab === 'replay' && bars.length > 0 && (
        <>
          <div className="sr-stage">
            <p className="sr-hist-label">Historical replay · cutoff-aware</p>
            <Chart
              bars={bars}
              t={t}
              stories={stories}
              moves={moves}
              symbol={ticker.symbol}
              selectedStoryId={selectedStoryId}
              onSelectStory={setSelectedStoryId}
            />
            <Controls
              t={t}
              maxT={maxT}
              timeLabel={bars[t]?.time ?? ''}
              playing={playing}
              speed={speed}
              onPlayPause={() => setPlaying((p) => !p)}
              onScrub={(next) => {
                setPlaying(false)
                setT(next)
              }}
              onSpeed={setSpeed}
              eventLabel={`Next: ${nextJump.label} (day ${nextJump.t})`}
              onJumpEvent={() => {
                setJumpIdx((i) => i + 1)
                setPlaying(false)
                setT(nextJump.t)
              }}
            />
          </div>

          <div className="sr-below">
            <ForecastPanel
              bars={bars}
              stories={stories}
              moves={moves}
              disclaimer={ticker.disclaimer}
              t={t}
              mode={mode}
              onMode={setMode}
            />
            <NewsPanel
              stories={stories}
              t={t}
              selectedId={selectedStoryId}
              onSelect={setSelectedStoryId}
            />
          </div>
        </>
      )}

      {tab === 'catalysts' && (
        <CatalystsView
          stories={stories}
          moves={moves}
          disclaimer={ticker.disclaimer}
          symbolLabel={ticker.symbol}
          assetClassLabel={isMulti && pack ? CLASS_LABELS[pack.assetClass] : undefined}
          onJump={(next) => {
            setTab('replay')
            setPlaying(false)
            setT(next)
          }}
        />
      )}

      {tab === 'evidence' && (
        <EvidenceView stories={stories} moves={moves} disclaimer={ticker.disclaimer} />
      )}

      {tab === 'inbox' && (
        <Inbox
          seeds={alertSeeds}
          t={t}
          onJump={(fireAt) => {
            setTab('replay')
            setPlaying(false)
            setT(fireAt)
          }}
        />
      )}

      <footer className="sr-footer">
        <strong>Research demo.</strong> {ticker.disclaimer}
      </footer>
    </div>
  )
}
