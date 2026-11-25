import { describe, expect, it } from 'vitest'
import type { Story } from '../src/data/types'
import { catalystsForMove } from '../src/lib/catalysts'
import { summarizeStory } from '../src/lib/summarizeStory'
import { stories as synStories } from '../src/data/synthetic'

const base: Omit<Story, 'id' | 'headline' | 'body' | 'tags' | 'source' | 'kind'> = {
  eventId: 'e',
  version: 1,
  publishedAt: 1,
  firstAvailableAt: 1,
  narrativeRole: 'quiet',
}

describe('summarizeStory (offline deterministic)', () => {
  it('summarizes EDGAR filings from symbol + acceptance date', () => {
    const s: Story = {
      ...base,
      id: 'ed',
      symbol: 'AAPL',
      headline: '[EDGAR] AAPL 8-K accepted 2015-10-27',
      body: 'Open SEC filing. acceptanceDateTime=2015-10-27T20:30:36.000Z. reportDate=2015-10-27.',
      tags: ['edgar', '8-k', 'surprise'],
      kind: 'story',
      source: 'edgar',
    }
    const out = summarizeStory(s)
    expect(out).toContain('AAPL')
    expect(out).toContain('8-K')
    expect(out).toContain('2015-10-27')
    expect(out.toLowerCase()).toContain('material')
  })

  it('summarizes GDELT with tone lean and URL topic cue', () => {
    const s: Story = {
      ...base,
      id: 'g',
      symbol: 'BTC-USD',
      headline: '[GDELT-GKG] BTC-USD mention 2018-05-15',
      body: 'GKG sample. url=https://english.manoramaonline.com/news/world/2018/05/15/indian-origin-million-dollar-scam-cryptocurrency.html. tone=-7.8. Weak clock: GKG DATE.',
      tags: ['gdelt', 'surprise'],
      kind: 'story',
      source: 'gdelt-gkg',
    }
    const out = summarizeStory(s)
    expect(out).toContain('BTC-USD')
    expect(out).toContain('bearish')
    expect(out).toMatch(/manoramaonline|Topic cue/i)
    expect(out).toContain('Weak GKG')
  })

  it('uses first body sentence for synthetic wires and marks corrections', () => {
    const early = synStories.find((s) => s.id === 's-early-v1')!
    const corr = synStories.find((s) => s.id === 's-early-v2')!
    expect(summarizeStory(early)).toMatch(/sell-side|constructive|tentative/i)
    expect(summarizeStory(corr).toLowerCase()).toContain('correction')
  })

  it('is stable / deterministic for the same story', () => {
    const s = synStories[0]!
    expect(summarizeStory(s)).toBe(summarizeStory(s))
  })

  it('attaches summary on catalyst hits', () => {
    const r = catalystsForMove(
      {
        onsetT: 100,
        endT: 110,
        direction: -1,
        peakAbsReturn: 0.1,
        hasIdentifiedCatalyst: true,
      },
      [
        {
          ...base,
          id: 'ed',
          firstAvailableAt: 95,
          symbol: 'MSFT',
          headline: '[EDGAR] MSFT 8-K accepted 2020-01-01',
          body: 'acceptanceDateTime=2020-01-01T12:00:00.000Z',
          tags: ['edgar', '8-k'],
          kind: 'story',
          source: 'edgar',
        },
      ],
    )
    expect(r.before[0]?.summary).toMatch(/MSFT.*8-K/i)
  })
})
