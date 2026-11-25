import * as synthetic from './synthetic'
import * as spy from './pilot/spyDataset'
import * as powered from './powered/poweredDataset'
import type { AlertSeed, Bar, DetectedMove, Story } from './types'
import { SCRIPTED_MOVES } from '../lib/moves'

export type DatasetId = 'synthetic' | 'spy-pilot' | 'powered-panel' | 'multi-asset'

export interface Dataset {
  id: DatasetId
  label: string
  bars: Bar[]
  stories: Story[]
  alertSeeds: AlertSeed[]
  moves: DetectedMove[]
  ticker: { symbol: string; name: string; disclaimer: string }
  eventJumps: { t: number; label: string }[]
}

export const DATASETS: Record<DatasetId, Dataset> = {
  synthetic: {
    id: 'synthetic',
    label: 'SYN (M1 synthetic)',
    bars: synthetic.bars,
    stories: synthetic.stories,
    alertSeeds: synthetic.alertSeeds,
    moves: SCRIPTED_MOVES,
    ticker: synthetic.ticker,
    eventJumps: [
      { t: 9, label: 'Quiet calendar note' },
      { t: 18, label: 'Early expectation story' },
      { t: 22, label: 'Duplicate coverage' },
      { t: 30, label: 'Large move onset' },
      { t: 33, label: 'Mid-move story' },
      { t: 36, label: 'Correction' },
      { t: 42, label: 'Late-available trap' },
      { t: 59, label: 'Move without catalyst' },
      { t: 72, label: 'After-action commentary' },
    ],
  },
  'spy-pilot': {
    id: 'spy-pilot',
    label: 'SPY (validation pilot)',
    bars: spy.bars,
    stories: spy.stories,
    alertSeeds: spy.alertSeeds,
    moves: spy.moves,
    ticker: spy.ticker,
    eventJumps: spy.eventJumps,
  },
  'powered-panel': {
    id: 'powered-panel',
    label: 'Powered panel (SPY + open news)',
    bars: powered.bars,
    stories: powered.stories,
    alertSeeds: powered.alertSeeds,
    moves: powered.moves,
    ticker: powered.ticker,
    eventJumps: powered.eventJumps,
  },
  // Placeholder — App loads packs from /data/multi-asset on demand
  'multi-asset': {
    id: 'multi-asset',
    label: 'Multi-asset (FX · crypto · stocks · ETF · cmdty)',
    bars: powered.bars,
    stories: powered.stories,
    alertSeeds: powered.alertSeeds,
    moves: powered.moves,
    ticker: {
      symbol: 'MULTI',
      name: 'Multi-asset catalyst analysis',
      disclaimer:
        'RESEARCH DEMO — multi-asset open OHLCV + EDGAR/GDELT proxies. Analysis around moves, not forecasting.',
    },
    eventJumps: powered.eventJumps,
  },
}

export const DEFAULT_DATASET: DatasetId = 'multi-asset'
