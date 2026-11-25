import { describe, expect, it } from 'vitest'
import type { Story } from '../src/data/types'
import { catalystsForMove } from '../src/lib/catalysts'
import { summarizeStory, summarizeStoryParagraphs } from '../src/lib/summarizeStory'
import { stories as synStories } from '../src/data/synthetic'

const base: Omit<Story, 'id' | 'headline' | 'body' | 'tags' | 'source' | 'kind'> = {
  eventId: 'e',
  version: 1,
  publishedAt: 1,
  firstAvailableAt: 1,
  narrativeRole: 'quiet',
}

describe('summarizeStory (offline deterministic paragraphs)', () => {
  it('summarizes EDGAR as two grounded paragraphs without inventing causes', () => {
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
    const paras = summarizeStoryParagraphs(s)
    expect(paras).toHaveLength(2)
    expect(paras[0]).toContain('AAPL')
    expect(paras[0]).toMatch(/8-K/)
    expect(paras[0]).toContain('2015-10-27')
    expect(paras[0].toLowerCase()).toMatch(/limited|does not include/)
    expect(paras[1].toLowerCase()).toMatch(/material-event|not inferred|causation/)
    expect(summarizeStory(s)).toBe(paras.join('\n\n'))
  })

  it('summarizes GDELT with narrative what/why and admits thin context', () => {
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
    const paras = summarizeStoryParagraphs(s)
    expect(paras).toHaveLength(2)
    expect(paras[0]).toContain('BTC-USD')
    expect(paras[0]).toContain('bearish')
    expect(paras[0]).toMatch(/manoramaonline|indian origin/i)
    expect(paras[1]).toMatch(/limited|unclear|Weak GKG|not wire first-seen/i)
    expect(paras[1].toLowerCase()).toMatch(/causation is not claimed|remains unclear/)
  })

  it('uses real body sentences for synthetic wires and marks corrections', () => {
    const early = synStories.find((s) => s.id === 's-early-v1')!
    const corr = synStories.find((s) => s.id === 's-early-v2')!
    const earlyParas = summarizeStoryParagraphs(early)
    expect(earlyParas.length).toBeGreaterThanOrEqual(1)
    expect(earlyParas.length).toBeLessThanOrEqual(2)
    expect(earlyParas[0]).toMatch(/sell-side|constructive|tentative/i)
    expect(summarizeStory(corr).toLowerCase()).toContain('correction')
  })

  it('is stable / deterministic for the same story', () => {
    const s = synStories[0]!
    expect(summarizeStory(s)).toBe(summarizeStory(s))
    expect(summarizeStoryParagraphs(s)).toEqual(summarizeStoryParagraphs(s))
  })

  it('does not invent scandal-style causes when source text is thin', () => {
    const s: Story = {
      ...base,
      id: 'thin',
      symbol: 'XOM',
      headline: '[GDELT-GKG] XOM mention',
      body: 'GKG bulk sample. tone=0.2. Weak clock: GKG DATE.',
      tags: ['gdelt'],
      kind: 'story',
      source: 'gdelt-gkg',
    }
    const out = summarizeStory(s).toLowerCase()
    expect(out).toMatch(/unclear|limited|no readable title|no gdelt tone|near-neutral/)
    expect(out).not.toMatch(/ceo|affair|resign|bribe|lawsuit/)
  })

  it('attaches multi-paragraph summary on catalyst hits', () => {
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
    expect(r.before[0]?.summary).toMatch(/MSFT/)
    expect(r.before[0]?.summary).toMatch(/8-K/)
    expect(r.before[0]?.summary.split('\n\n').length).toBe(2)
  })
})
