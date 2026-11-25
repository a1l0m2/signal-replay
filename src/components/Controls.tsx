interface Props {
  t: number
  maxT: number
  timeLabel: string
  playing: boolean
  speed: number
  onPlayPause: () => void
  onScrub: (t: number) => void
  onSpeed: (speed: number) => void
  onJumpEvent: () => void
  eventLabel: string
}

export function Controls({
  t,
  maxT,
  timeLabel,
  playing,
  speed,
  onPlayPause,
  onScrub,
  onSpeed,
  onJumpEvent,
  eventLabel,
}: Props) {
  return (
    <div className="sr-transport" role="group" aria-label="Replay controls">
      <button
        type="button"
        className={`sr-play${playing ? ' is-playing' : ''}`}
        onClick={onPlayPause}
      >
        <span className={`sr-playhead-dot${playing ? '' : ' off'}`} aria-hidden />
        {playing ? 'Pause' : 'Play'}
      </button>

      <label className="sr-scrub">
        <span className="sr-scrub-labels">
          <span>Start</span>
          <span className="now">
            Now · day {t} · {timeLabel}
          </span>
          <span>End</span>
        </span>
        <input
          type="range"
          min={0}
          max={maxT}
          value={t}
          onChange={(e) => onScrub(Number(e.target.value))}
          aria-label="Scrub timeline"
          aria-valuetext={`Day ${t}, ${timeLabel}`}
        />
      </label>

      <div className="sr-transport-side">
        <div className="sr-speed" role="group" aria-label="Playback speed">
          {[1, 2, 4].map((s) => (
            <button
              key={s}
              type="button"
              className={speed === s ? 'active' : ''}
              onClick={() => onSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </div>
        <button
          type="button"
          className="sr-jump"
          onClick={onJumpEvent}
          title={eventLabel}
        >
          Jump to moment
        </button>
      </div>
    </div>
  )
}
