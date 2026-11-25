import type { Bar, DetectedMove, Story } from '../data/types'

interface Props {
  bars: Bar[]
  t: number
  stories: Story[]
  moves: DetectedMove[]
  symbol?: string
  onSelectStory: (id: string) => void
  selectedStoryId?: string | null
}

export function Chart({
  bars,
  t,
  stories,
  moves,
  symbol = 'SYN',
  onSelectStory,
  selectedStoryId,
}: Props) {
  const w = 960
  const h = 360
  const pad = { l: 48, r: 20, t: 28, b: 36 }
  const prices = bars.map((b) => b.close)
  const min = Math.min(...prices) * 0.99
  const max = Math.max(...prices) * 1.01
  const x = (i: number) => pad.l + (i / (bars.length - 1)) * (w - pad.l - pad.r)
  const y = (p: number) => pad.t + (1 - (p - min) / (max - min)) * (h - pad.t - pad.b)

  const known = bars.slice(0, t + 1)
  const pathKnown = known
    .map((b, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(b.close).toFixed(1)}`)
    .join(' ')
  const pathFuture =
    t < bars.length - 1
      ? bars
          .slice(t)
          .map(
            (b, i) =>
              `${i === 0 ? 'M' : 'L'}${x(t + i).toFixed(1)},${y(b.close).toFixed(1)}`,
          )
          .join(' ')
      : ''

  const visible = stories.filter((s) => s.firstAvailableAt <= t)
  const priceNow = bars[t]?.close ?? 0

  return (
    <div className="sr-chart-wrap" aria-label="SYN price replay chart">
      <div className="sr-chart-meta">
        <span>
          <strong>{symbol}</strong> · research replay
        </span>
        <span>
          Cutoff {bars[t]?.time} · {priceNow.toFixed(2)}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} role="img">
        <defs>
          <linearGradient id="areaKnown" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2ad4c5" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#2ad4c5" stopOpacity="0" />
          </linearGradient>
        </defs>

        {moves.map((m) => (
          <g key={`${m.onsetT}-${m.endT}`}>
            <rect
              x={x(m.onsetT)}
              y={pad.t}
              width={Math.max(2, x(Math.min(m.endT, bars.length - 1)) - x(m.onsetT))}
              height={h - pad.t - pad.b}
              fill={
                m.hasIdentifiedCatalyst
                  ? 'rgba(42,212,197,0.07)'
                  : 'rgba(224,162,74,0.08)'
              }
            />
          </g>
        ))}

        {known.length > 1 && (
          <path
            d={`${pathKnown} L${x(t)},${h - pad.b} L${x(0)},${h - pad.b} Z`}
            fill="url(#areaKnown)"
          />
        )}
        <path d={pathKnown} fill="none" stroke="#2ad4c5" strokeWidth="2.5" />
        {pathFuture && (
          <path
            d={pathFuture}
            fill="none"
            stroke="rgba(215,224,232,0.22)"
            strokeWidth="1.5"
            strokeDasharray="4 5"
          />
        )}

        <line
          x1={x(t)}
          x2={x(t)}
          y1={pad.t}
          y2={h - pad.b}
          stroke="#2ad4c5"
          strokeWidth="2"
        />
        <circle cx={x(t)} cy={y(priceNow)} r="5" fill="#2ad4c5" stroke="#0c1218" strokeWidth="2" />

        {visible.map((s) => (
          <g
            key={s.id}
            onClick={() => onSelectStory(s.id)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={x(Math.min(s.firstAvailableAt, bars.length - 1))}
              cy={
                y(bars[Math.min(s.firstAvailableAt, bars.length - 1)]!.close) - 14
              }
              r={selectedStoryId === s.id ? 7 : 5}
              fill={s.kind === 'correction' ? '#e0a24a' : '#f2f7fa'}
              stroke="#0c1218"
              strokeWidth="1.5"
            />
          </g>
        ))}

        <text x={pad.l} y={h - 10} fontSize="11" fill="#9aabba">
          Drag the scrubber or press Play — only the solid line is “known” at this cutoff
        </text>
      </svg>
    </div>
  )
}
