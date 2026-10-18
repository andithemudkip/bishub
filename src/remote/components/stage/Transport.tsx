import { useState } from "react";
import type { Translations } from "../../../shared/i18n";
import { formatDuration } from "../../../shared/utils";
import { PlayIcon, PauseIcon, StopIcon } from "../icons/ui";
import { ghostButton } from "./styles";

interface Props {
  playing: boolean;
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  /** Seconds into the media. */
  onSeek: (time: number) => void;
  /** Names the slider, e.g. "Video position". */
  seekLabel: string;
  t: Translations;
}

/**
 * Play/pause, stop and seek — the one transport row the Stage uses for both
 * the video on screen and the audio underneath, so they work alike. Bare: the
 * caller supplies the box it sits in.
 */
export function Transport({
  playing,
  currentTime,
  duration,
  onPlay,
  onPause,
  onStop,
  onSeek,
  seekLabel,
  t,
}: Props) {
  // While dragging, the thumb follows the finger rather than the display's
  // time ticks, which lag behind each seek and would yank it back.
  const [scrub, setScrub] = useState<number | null>(null);
  const endScrub = () => setScrub(null);

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={playing ? onPause : onPlay}
        className={ghostButton}
        aria-label={playing ? t.stage.pause : t.stage.play}
        title={playing ? t.stage.pause : t.stage.play}
      >
        {playing ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
      </button>
      <button onClick={onStop} className={ghostButton} aria-label={t.stage.stop} title={t.stage.stop}>
        <StopIcon className="w-4 h-4" />
      </button>
      <span className="text-xs text-gray-500 tabular-nums flex-shrink-0">
        {formatDuration(scrub ?? currentTime)}
      </span>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step="any"
        value={scrub ?? currentTime}
        disabled={duration <= 0}
        onChange={(e) => {
          const time = Number(e.target.value);
          setScrub(time);
          onSeek(time);
        }}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onKeyUp={endScrub}
        onBlur={endScrub}
        aria-label={seekLabel}
        className="flex-1 min-w-0"
      />
      <span className="pr-1.5 text-xs text-gray-500 tabular-nums flex-shrink-0">
        {formatDuration(duration)}
      </span>
    </div>
  );
}
