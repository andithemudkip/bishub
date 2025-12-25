import { useEffect, useRef } from "react";
import type { AudioState, AudioWidgetPosition } from "../../shared/types";

interface Props {
  config: AudioState;
  position: AudioWidgetPosition;
  onTimeUpdate: (time: number, duration: number) => void;
}

// Position classes for the audio widget container
const WIDGET_POSITION_CLASSES: Record<AudioWidgetPosition, string> = {
  "top-left": "top-6 left-6",
  "top-right": "top-6 right-6",
  "bottom-left": "bottom-6 left-6",
  "bottom-right": "bottom-6 right-6",
  center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
};

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function AudioWidget({ config, position, onTimeUpdate }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastSeekedTime = useRef<number | null>(null);

  // Handle play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !config.src) return;

    if (config.playing) {
      audio.play().catch((e) => {
        console.error("[AudioWidget] Play error:", e);
      });
    } else {
      audio.pause();
    }
  }, [config.playing, config.src]);

  // Handle volume changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = config.volume;
  }, [config.volume]);

  // Handle seeking from remote
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Only seek if the difference is significant
    const diff = Math.abs(audio.currentTime - config.currentTime);
    if (diff > 1 && lastSeekedTime.current !== config.currentTime) {
      audio.currentTime = config.currentTime;
      lastSeekedTime.current = config.currentTime;
    }
  }, [config.currentTime]);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    onTimeUpdate(audio.currentTime, audio.duration || 0);
  };

  const handleEnded = () => {
    // Report final state when audio ends
    const audio = audioRef.current;
    if (!audio) return;
    onTimeUpdate(audio.duration || 0, audio.duration || 0);
  };

  // Don't render if no audio is loaded
  if (!config.src) {
    return null;
  }

  // Convert path to file URL
  const audioSrc = config.src.startsWith("file://")
    ? config.src
    : `file://${config.src}`;

  const positionClass = WIDGET_POSITION_CLASSES[position] || WIDGET_POSITION_CLASSES["bottom-right"];
  const progress = config.duration > 0 ? (config.currentTime / config.duration) * 100 : 0;

  return (
    <div className={`absolute ${positionClass} z-20`}>
      <div className="bg-black/50 backdrop-blur-md rounded-lg p-4 text-white min-w-[280px] max-w-[400px] shadow-2xl">
        {/* Audio name */}
        <div className="text-sm font-medium truncate mb-3 opacity-90">
          {config.name || config.src?.split("/").pop() || "Audio"}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-white/80 rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Time display */}
        <div className="text-xs text-white/60 flex justify-between">
          <span>{formatTime(config.currentTime)}</span>
          <span>{formatTime(config.duration)}</span>
        </div>

        {/* Hidden audio element for playback */}
        <audio
          ref={audioRef}
          src={audioSrc}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleTimeUpdate}
          onEnded={handleEnded}
        />
      </div>
    </div>
  );
}
