import type { DetectedMove, Story } from '../data/types'
import { buildEvidence } from '../lib/evidence'
import { summarizeStory } from '../lib/summarizeStory'

interface Props {
  stories: Story[]
  moves?: DetectedMove[]
  disclaimer?: string
}

const CONN_LABEL: Record<string, string> = {
  aligned: 'Aligned timing',
  conflicted: 'Conflicting claim',
  rival: 'Recycled / rival',
  followed_price: 'May have followed price',
  unclear: 'Unclear',
}

export function EvidenceView({ stories, moves, disclaimer }: Props) {
  const evidence = buildEvidence(stories, moves, disclaimer)
  const catalystFree = evidence.movesWithoutCatalyst
  const shown =
    catalystFree.length > 8
      ? `${catalystFree.slice(0, 8).join(', ')}… (+${catalystFree.length - 8})`
      : catalystFree.join(', ') || '—'

  return (
    <div className="sr-solo">
      <div className="sr-solo-banner">
        <h2>After a move</h2>
        <span className="sr-badge">Not a forecast</span>
      </div>
      <p className="sr-help">
        Retrospective only: was the narrative connected? Timing, conflicts, rivals, and
        commentary that may have chased the tape. “Unclear” is a valid answer. This view never
        feeds Before/During scores.
      </p>
      <p className="sr-help" style={{ marginTop: '0.5rem' }}>
        Moves with no identified catalyst (onset days): {shown}
      </p>

      <ul className="sr-evidence-list">
        {evidence.items.map((item) => {
          const story = stories.find((s) => s.id === item.storyId)
          return (
            <li key={item.storyId}>
              <span className="sr-conn">{CONN_LABEL[item.connection] ?? item.connection}</span>
              <strong style={{ display: 'block', color: '#eef4f8' }}>
                {story?.headline ?? item.storyId}
              </strong>
              {story && <p className="sr-summary">{summarizeStory(story)}</p>}
              <p className="sr-help" style={{ marginTop: '0.35rem' }}>
                {item.note}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
