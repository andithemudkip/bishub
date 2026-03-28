import { formatDuration } from "@shared/utils";

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
  labels: {
    nowPlaying: string;
    play: string;
    pause: string;
    stop: string;
    volume: string;
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
  labels,
}: Props) {
  return (
    <div className="sticky -bottom-3 md:-bottom-4 z-10 mt-auto -mx-3 md:-mx-4 px-3 md:px-4 pt-3 pb-3 md:pb-4 bg-gradient-to-t from-gray-900 via-gray-900 to-gray-900/90 backdrop-blur-sm border-t border-gray-700/50 overflow-hidden">
      {/* Row 1: Track name + volume */}
      <div className="flex items-center gap-2 sm:gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{trackName}</div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 w-16 sm:w-28">
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

      {/* Row 2: Play/Stop + seek bar */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-gray-800/80 border border-gray-700/50 rounded-lg overflow-hidden flex-shrink-0">
          {isPlaying ? (
            <button
              onClick={onPause}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 hover:bg-gray-700 active:bg-gray-600 transition-colors text-yellow-400"
              title={labels.pause}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            </button>
          ) : (
            <button
              onClick={onPlay}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 hover:bg-gray-700 active:bg-gray-600 transition-colors text-green-400"
              title={labels.play}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
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
