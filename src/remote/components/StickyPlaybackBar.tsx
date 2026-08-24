import { formatDuration } from "@shared/utils";
import { SkipNextIcon, SkipPreviousIcon, LoopIcon } from "./icons/ui";

interface QueueControls {
  index: number;
  total: number;
  loop: boolean;
  /** Name of the track that plays next, or null when nothing follows. */
  upNextName: string | null;
  onNext: () => void;
  onPrevious: () => void;
  onToggleLoop: (loop: boolean) => void;
}

interface Props {
  trackName: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  /** Present only when a queue (playlist or Up Next) is live. */
  queue?: QueueControls;
  labels: {
    nowPlaying: string;
    play: string;
    pause: string;
    stop: string;
    volume: string;
    nextTrack?: string;
    previousTrack?: string;
    loop?: string;
    upNext?: string;
    queueEmpty?: string;
  };
}

export default function StickyPlaybackBar({
  trackName,
  isPlaying,
  currentTime,
  duration,
  volume,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onVolumeChange,
  queue,
  labels,
}: Props) {
  return (
    <div className="sticky -bottom-3 md:-bottom-4 z-10 mt-auto -mx-3 md:-mx-4 px-3 md:px-4 pt-3 pb-3 md:pb-4 bg-gradient-to-t from-gray-900 via-gray-900 to-gray-900/90 backdrop-blur-sm border-t border-gray-700/50 overflow-hidden">
      {/* Row 1: Track name + volume */}
      <div className="flex items-center gap-2 sm:gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{trackName}</div>
          {queue && (
            <div className="text-[10px] sm:text-xs text-gray-500 truncate">
              {labels.upNext ?? "Up next"}:{" "}
              {queue.upNextName ?? labels.queueEmpty ?? "—"}
            </div>
          )}
        </div>
        {queue && (
          <span className="text-[10px] sm:text-xs text-gray-500 tabular-nums flex-shrink-0">
            {queue.index + 1}/{queue.total}
          </span>
        )}
        <div className="flex items-center gap-1.5 flex-shrink-0 w-32 sm:w-28">
          <svg
            className="w-3.5 h-3.5 text-gray-500 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="flex-1 min-w-0"
          />
        </div>
      </div>

      {/* Row 2: Play/Stop (+ prev/next/loop when a queue is live) + seek bar */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-gray-800/80 border border-gray-700/50 rounded-lg overflow-hidden flex-shrink-0">
          {queue && (
            <button
              onClick={queue.onPrevious}
              className="px-2 py-1.5 sm:px-2.5 sm:py-2 hover:bg-gray-700 active:bg-gray-600 transition-colors text-gray-300"
              title={labels.previousTrack}
              aria-label={labels.previousTrack}
            >
              <SkipPreviousIcon className="w-4 h-4" />
            </button>
          )}
          {isPlaying ? (
            <button
              onClick={onPause}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 hover:bg-gray-700 active:bg-gray-600 transition-colors text-yellow-400 border-l border-gray-700/50 first:border-l-0"
              title={labels.pause}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            </button>
          ) : (
            <button
              onClick={onPlay}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 hover:bg-gray-700 active:bg-gray-600 transition-colors text-green-400 border-l border-gray-700/50 first:border-l-0"
              title={labels.play}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}
          {queue && (
            <button
              onClick={queue.onNext}
              className="px-2 py-1.5 sm:px-2.5 sm:py-2 hover:bg-gray-700 active:bg-gray-600 transition-colors text-gray-300 border-l border-gray-700/50"
              title={labels.nextTrack}
              aria-label={labels.nextTrack}
            >
              <SkipNextIcon className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onStop}
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 hover:bg-gray-700 active:bg-gray-600 transition-colors text-red-400 border-l border-gray-700/50"
            title={labels.stop}
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z" />
            </svg>
          </button>
          {queue && (
            <button
              onClick={() => queue.onToggleLoop(!queue.loop)}
              className={`px-2 py-1.5 sm:px-2.5 sm:py-2 hover:bg-gray-700 active:bg-gray-600 transition-colors border-l border-gray-700/50 ${
                queue.loop ? "text-blue-400" : "text-gray-500"
              }`}
              title={labels.loop}
              aria-label={labels.loop}
              aria-pressed={queue.loop}
            >
              <LoopIcon className="w-4 h-4" />
            </button>
          )}
        </div>
        <span className="text-[10px] sm:text-xs text-gray-500 tabular-nums flex-shrink-0">
          {formatDuration(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="flex-1 min-w-0"
        />
        <span className="text-[10px] sm:text-xs text-gray-500 tabular-nums flex-shrink-0">
          {formatDuration(duration)}
        </span>
      </div>
    </div>
  );
}
