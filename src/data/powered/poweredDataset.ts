import type { AlertSeed, Bar, DetectedMove, Story } from '../types'
import barsJson from './spy_ui_bars.json'
import storiesJson from './spy_ui_stories.json'
import movesJson from './spy_ui_moves.json'
import alertsJson from './spy_ui_alerts.json'
import jumpsJson from './spy_ui_jumps.json'

export const POWERED_DISCLAIMER =
  'RESEARCH DEMO — open OHLCV snapshot + GDELT/EDGAR first-available proxies (weak clocks). Not trading advice. Powered eval reported honest null at matched FAR.'

export const bars = barsJson as Bar[]
export const stories = storiesJson as Story[]
export const moves = movesJson as DetectedMove[]
export const alertSeeds = alertsJson as AlertSeed[]
export const eventJumps = jumpsJson as { t: number; label: string }[]

export const ticker = {
  symbol: 'SPY',
  name: 'Powered panel (SPY replay · 30-name eval)',
  disclaimer: POWERED_DISCLAIMER,
} as const
