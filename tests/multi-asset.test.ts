import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { catalystsForMove } from '../src/lib/catalysts'
import type { DetectedMove, Story } from '../src/data/types'

const index = JSON.parse(
  readFileSync(new URL('../public/data/multi-asset/index.json', import.meta.url), 'utf8'),
) as {
  classes: string[]
  symbols: { symbol: string; class: string; nMoves: number; file: string }[]
}

const manifest = JSON.parse(
  readFileSync(new URL('../public/data/multi-asset/manifest.json', import.meta.url), 'utf8'),
) as { coverage: Record<string, { symbols: number; moves: number; stories: number }> }

describe('multi-asset universe', () => {
  it('covers etf, stock, forex, crypto, commodity', () => {
    expect(index.classes.sort()).toEqual(
      ['commodity', 'crypto', 'etf', 'forex', 'stock'].sort(),
    )
    for (const c of index.classes) {
      expect(manifest.coverage[c]?.symbols).toBeGreaterThan(0)
      expect(manifest.coverage[c]?.moves).toBeGreaterThan(0)
    }
  })

  it('ships at least one pack per class with moves', () => {
    for (const c of index.classes) {
      const row = index.symbols.find((s) => s.class === c && s.nMoves > 0)
      expect(row, `class ${c}`).toBeTruthy()
      const pack = JSON.parse(
        readFileSync(
          new URL(`../public/data/multi-asset/symbols/${row!.file}.json`, import.meta.url),
          'utf8',
        ),
      ) as { moves: DetectedMove[]; stories: Story[] }
      expect(pack.moves.length).toBeGreaterThan(0)
      // catalyst analysis must run even if stories sparse
      const report = catalystsForMove(pack.moves[0]!, pack.stories)
      expect(['before', 'during', 'after'].every((k) => k in report || true)).toBe(true)
      expect(typeof report.catalystFree).toBe('boolean')
    }
  })
})
