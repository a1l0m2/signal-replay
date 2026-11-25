import type { Story } from '../data/types'

/** Offline, deterministic blurb from title/body/tags/source — no LLM. */
export function summarizeStory(story: Story): string {
  const src = (story.source ?? '').toLowerCase()
  const tags = story.tags.map((t) => t.toLowerCase())
  const isEdgar = src === 'edgar' || tags.includes('edgar') || tags.includes('8-k')
  const isGdelt = src.includes('gdelt') || tags.includes('gdelt')

  if (isEdgar) return summarizeEdgar(story)
  if (isGdelt) return summarizeGdelt(story)
  return summarizeGeneric(story)
}

function summarizeEdgar(story: Story): string {
  const sym = story.symbol ?? pickSymbolFromHeadline(story.headline) ?? 'issuer'
  const date =
    matchField(story.body, /acceptanceDateTime=([0-9T:\-.Z]+)/i)?.slice(0, 10) ??
    matchField(story.headline, /(\d{4}-\d{2}-\d{2})/) ??
    null
  const filing = tagsHas(story, '8-k') ? '8-K' : 'SEC filing'
  const when = date ? ` Accepted ${date}.` : ''
  const kindBit =
    story.kind === 'correction'
      ? ' Correction/revision of a prior filing note.'
      : ' Material-event proxy only — lean not inferred from the filing alone.'
  return `${sym} ${filing}.${when}${kindBit}`.replace(/\s+/g, ' ').trim()
}

function summarizeGdelt(story: Story): string {
  const sym = story.symbol ?? pickSymbolFromHeadline(story.headline) ?? 'asset'
  const tone = parseTone(story.body)
  const lean = toneLean(tone)
  const url = matchField(story.body, /url=(https?:\/\/[^\s]+?)(?:\.?(?:\s|$))/i)
  const host = url ? hostOf(url) : null
  const topic = url ? topicFromUrl(url) : topicFromHeadline(story.headline)
  const surprise = tagsHas(story, 'surprise') ? ' Marked surprise/expectation in tags.' : ''

  const parts: string[] = [`Open crawl mention of ${sym}`]
  if (host) parts.push(`via ${host}`)
  let out = `${parts.join(' ')}.`
  if (topic) out += ` ${topic}.`
  out += lean
    ? ` Tone lean: ${lean} (tone=${formatTone(tone!)}).`
    : tone != null
      ? ` Tone lean: unclear (tone=${formatTone(tone)}).`
      : ' Tone lean: unclear.'
  out += ' Weak GKG clock — not wire first-seen.'
  if (surprise) out += surprise
  return out.replace(/\s+/g, ' ').trim()
}

function summarizeGeneric(story: Story): string {
  const fromBody = firstSentence(story.body)
  if (fromBody && fromBody.length >= 24) {
    return clip(decorateKind(story, fromBody), 180)
  }
  const tags = story.tags.filter((t) => !['gdelt', 'edgar', '8-k'].includes(t.toLowerCase()))
  const tagBit = tags.length ? ` Themes: ${tags.slice(0, 4).join(', ')}.` : ''
  return clip(decorateKind(story, `${story.headline}.${tagBit}`), 180)
}

function decorateKind(story: Story, text: string): string {
  if (story.kind === 'correction') return `Correction — ${text}`
  if (story.kind === 'duplicate') return `Recycled coverage — ${text}`
  if (story.kind === 'revision') return `Revision — ${text}`
  return text
}

function parseTone(body: string): number | null {
  const m = body.match(/tone=([-+]?\d*\.?\d+)/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

function toneLean(tone: number | null): 'bullish' | 'bearish' | null {
  if (tone == null) return null
  if (tone <= -1) return 'bearish'
  if (tone >= 1) return 'bullish'
  return null
}

function formatTone(t: number): string {
  return (Math.round(t * 100) / 100).toString()
}

function matchField(text: string, re: RegExp): string | null {
  const m = text.match(re)
  return m?.[1] ?? null
}

function tagsHas(story: Story, tag: string): boolean {
  return story.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
}

function pickSymbolFromHeadline(headline: string): string | null {
  const m =
    headline.match(/\[EDGAR\]\s+(\S+)/i) ??
    headline.match(/\[GDELT[^\]]*\]\s+(\S+)/i) ??
    headline.match(/\b([A-Z]{1,5}(?:-[A-Z]{1,5})?(?:=[XF])?)\b/)
  return m?.[1] ?? null
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/** Turn URL path/slug into a short readable topic phrase. */
function topicFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const last = u.pathname
      .split('/')
      .filter(Boolean)
      .pop()
      ?.replace(/\.(html?|xhtml|php|aspx?)$/i, '')
      .replace(/\.+$/, '')
    if (!last) return null
    const words = last
      .replace(/[-_]+/g, ' ')
      .replace(/\d{5,}/g, ' ')
      .replace(/\bid[a-z0-9]+/gi, ' ')
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 2 && !/^\d+$/.test(w) && !/^html?$/i.test(w))
      .slice(0, 8)
    if (words.length < 2) return null
    const phrase = words.join(' ')
    return `Topic cue from URL: “${clip(phrase, 72)}”`
  } catch {
    return null
  }
}

function topicFromHeadline(headline: string): string | null {
  const cleaned = headline
    .replace(/\[EDGAR\]/gi, '')
    .replace(/\[GDELT[^\]]*\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned.length < 12) return null
  return `Headline: ${clip(cleaned, 90)}`
}

function firstSentence(body: string): string | null {
  const cleaned = body.replace(/\s+/g, ' ').trim()
  if (!cleaned) return null
  const m = cleaned.match(/^(.+?[.!?])(?:\s|$)/)
  return (m?.[1] ?? cleaned).trim()
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
}
