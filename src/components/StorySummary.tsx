import type { Story } from '../data/types'
import { summarizeStoryParagraphs } from '../lib/summarizeStory'

interface Props {
  story: Story
  /** Optional label above the paragraphs (e.g. News detail). */
  label?: string
  className?: string
}

/** Renders the offline 1–2 paragraph narrative for a story. */
export function StorySummary({ story, label, className }: Props) {
  const paragraphs = summarizeStoryParagraphs(story)
  return (
    <div className={className ? `sr-summary-block ${className}` : 'sr-summary-block'}>
      {label ? <span className="sr-summary-label">{label}</span> : null}
      {paragraphs.map((p, i) => (
        <p key={i} className="sr-summary">
          {p}
        </p>
      ))}
    </div>
  )
}
