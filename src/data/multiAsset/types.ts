import type { AlertSeed, Bar, DetectedMove, Story } from '../types'

export type AssetClass = 'etf' | 'stock' | 'forex' | 'crypto' | 'commodity'

export interface MultiAssetIndexEntry {
  symbol: string
  file: string
  class: AssetClass
  nBars: number
  nMoves: number
  nStories: number
}

export interface MultiAssetIndex {
  symbols: MultiAssetIndexEntry[]
  classes: AssetClass[]
}

export interface MultiAssetPack {
  symbol: string
  assetClass: AssetClass
  label: string
  bars: Bar[]
  moves: DetectedMove[]
  stories: Story[]
  alertSeeds: AlertSeed[]
  eventJumps: { t: number; label: string }[]
  disclaimer: string
}

export const CLASS_LABELS: Record<AssetClass, string> = {
  etf: 'ETFs',
  stock: 'Stocks',
  forex: 'Forex',
  crypto: 'Crypto',
  commodity: 'Commodities',
}
