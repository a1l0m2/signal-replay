import type { Story } from '../data/types'

/**
 * Offline, deterministic 1–2 paragraph narrative from title / body / tags /
 * tone / filing fields / URL slug — no LLM, no invented causes.
 * Paragraphs are separated by `\n\n`.
 */
export function summarizeStory(story: Story): string {
  return summarizeStoryParagraphs(story).join('\n\n')
}

/** Same as summarizeStory, as discrete paragraphs for UI. */
export function summarizeStoryParagraphs(story: Story): string[] {
  const src = (story.source ?? '').toLowerCase()
  const tags = story.tags.map((t) => t.toLowerCase())
  const isEdgar = src === 'edgar' || tags.includes('edgar') || tags.includes('8-k')
  const isGdelt = src.includes('gdelt') || tags.includes('gdelt')

  if (isEdgar) return summarizeEdgar(story)
  if (isGdelt) return summarizeGdelt(story)
  return summarizeGeneric(story)
}

function summarizeEdgar(story: Story): string[] {
  const sym = story.symbol ?? pickSymbolFromHeadline(story.headline) ?? 'the issuer'
  const accept =
    matchField(story.body, /acceptanceDateTime=([0-9T:\-.Z]+)/i)?.slice(0, 10) ??
    matchField(story.headline, /(\d{4}-\d{2}-\d{2})/) ??
    null
  const report = matchField(story.body, /reportDate=([0-9\-]+)/i)
  const filing = tagsHas(story, '8-k') ? 'Form 8-K' : 'an SEC filing'
  const when = accept ? ` on ${accept}` : ''
  const reportBit =
    report && report !== accept ? ` The filing’s report date is ${report}.` : ''

  const what = [
    `${sym} filed ${filing}${when} (EDGAR acceptance).`,
    reportBit,
    ' The open snapshot records acceptance timing but does not include the filing’s item narrative, so what specifically happened inside the document is limited from this source.',
  ]
    .join('')
    .replace(/\s+/g, ' ')
    .trim()

  const whyParts: string[] = [
    'Why it sits in the catalyst window: an 8-K is a material-event marker around the move — not a decoded cause.',
  ]
  if (story.kind === 'correction') {
    whyParts.push(
      'This row is tagged as a correction/revision of a prior filing note; direction is still not inferred from the filing type alone.',
    )
  } else {
    whyParts.push(
      'Lean and causation are not inferred from the filing type alone; unclear is valid when the body text is thin.',
    )
  }
  const why = whyParts.join(' ').replace(/\s+/g, ' ').trim()
  return [what, why]
}

function summarizeGdelt(story: Story): string[] {
  const sym = story.symbol ?? pickSymbolFromHeadline(story.headline) ?? 'the asset'
  const tone = parseTone(story.body)
  const lean = toneLean(tone)
  const url = matchField(story.body, /url=(https?:\/\/[^\s]+?)(?:\.?(?:\s|$))/i)
  const host = url ? hostOf(url) : null
  const topicPhrase = url ? topicPhraseFromUrl(url) : null
  const headlineCue = cleanHeadline(story.headline)
  const surprise = tagsHas(story, 'surprise')
  const topicProxy = tagsHas(story, 'topic-proxy')

  const whatBits: string[] = [`Open crawl coverage mentioned ${sym}`]
  if (host) whatBits.push(`via ${host}`)
  let what = `${whatBits.join(' ')}.`
  if (topicPhrase) {
    what += ` A URL topic cue from the article path points to “${topicPhrase}.”`
  } else if (headlineCue) {
    what += ` Headline cue: “${headlineCue}.”`
  } else {
    what += ' No readable title or URL topic cue is available beyond the symbol mention.'
  }
  if (lean) {
    what += ` GDELT tone on the item is ${describeTone(tone!)} (tone=${formatTone(tone!)}), mapped here to a ${lean} lean.`
  } else if (tone != null) {
    what += ` GDELT tone on the item is near-neutral (tone=${formatTone(tone)}); lean is unclear.`
  } else {
    what += ' No GDELT tone field was present; lean is unclear.'
  }
  what = what.replace(/\s+/g, ' ').trim()

  const whyBits: string[] = [
    'Context beyond title, host, URL slug, and tone is limited — the GKG DATE clock is weak and is not wire first-seen.',
  ]
  if (topicProxy) {
    whyBits.push(
      'This hit is tagged as a topic-proxy match (broader theme alias), so entity precision may be noisy.',
    )
  }
  if (surprise) {
    whyBits.push('Tags mark surprise/expectation language in the open sample.')
  }
  whyBits.push(
    'Whether this coverage caused, coincided with, or is noise around the move remains unclear from available open text — causation is not claimed.',
  )
  const why = whyBits.join(' ').replace(/\s+/g, ' ').trim()
  return [what, why]
}

function summarizeGeneric(story: Story): string[] {
  const bodySentences = sentencesFrom(story.body)
  const headlineCue = cleanHeadline(story.headline)
  const tags = story.tags.filter(
    (t) => !['gdelt', 'edgar', '8-k', 'topic-proxy'].includes(t.toLowerCase()),
  )

  let what: string
  if (bodySentences.length >= 1) {
    // Prefer real body text — up to two short sentences, no invented glue.
    what = bodySentences.slice(0, 2).join(' ')
    if (story.kind === 'correction') what = `Correction — ${what}`
    else if (story.kind === 'duplicate') what = `Recycled coverage — ${what}`
    else if (story.kind === 'revision') what = `Revision — ${what}`
  } else if (headlineCue) {
    const prefix =
      story.kind === 'correction'
        ? 'Correction. '
        : story.kind === 'duplicate'
          ? 'Recycled coverage. '
          : story.kind === 'revision'
            ? 'Revision. '
            : ''
    what = `${prefix}Headline: “${headlineCue}.” Source body text is thin beyond the title.`
  } else {
    what =
      'Available source text is too thin to reconstruct what happened. Context is limited/unclear from this row alone.'
  }
  what = clip(what.replace(/\s+/g, ' ').trim(), 420)

  const whyBits: string[] = []
  if (tags.length) whyBits.push(`Themes in tags: ${tags.slice(0, 5).join(', ')}.`)
  if (headlineCue && bodySentences.length >= 1) {
    whyBits.push(`Headline: “${clip(headlineCue, 100)}.”`)
  }
  whyBits.push(
    'This summary restates available title and source text only — it does not invent causes, and unclear is valid when evidence is thin.',
  )
  const why = whyBits.join(' ').replace(/\s+/g, ' ').trim()

  // If body already ran long (2 sentences), keep why; if body was empty we still want 2 paras.
  if (!bodySentences.length && !headlineCue) {
    return [what]
  }
  return [what, why]
}

function describeTone(t: number): string {
  const a = Math.abs(t)
  if (a >= 5) return t < 0 ? 'strongly negative' : 'strongly positive'
  if (a >= 2) return t < 0 ? 'negative' : 'positive'
  return t < 0 ? 'mildly negative' : 'mildly positive'
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

/** Readable topic phrase from URL path/slug (no invented meaning). */
function topicPhraseFromUrl(url: string): string | null {
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
      .slice(0, 10)
    if (words.length < 2) return null
    return clip(words.join(' '), 90)
  } catch {
    return null
  }
}

function cleanHeadline(headline: string): string | null {
  const cleaned = headline
    .replace(/\[EDGAR\]/gi, '')
    .replace(/\[GDELT[^\]]*\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned.length < 8) return null
  return clip(cleaned, 120)
}

function sentencesFrom(body: string): string[] {
  const cleaned = body.replace(/\s+/g, ' ').trim()
  if (!cleaned) return []
  // Skip machine key=value provenance lines that aren't narrative prose.
  if (/^(Open SEC filing|GKG (bulk )?sample)\./i.test(cleaned) && /[=]/.test(cleaned)) {
    return []
  }
  const parts = cleaned.match(/[^.!?]+[.!?]+/g) ?? [cleaned]
  return parts
    .map((s) => s.trim())
    .filter((s) => s.length >= 20)
    .filter((s) => !/^(acceptanceDateTime|reportDate|url|tone)=/i.test(s))
    .slice(0, 3)
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
}
