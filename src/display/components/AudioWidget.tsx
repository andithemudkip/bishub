import type { AudioState, AudioWidgetPosition } from "../../shared/types";
import { formatDuration } from "../../shared/utils";

interface Props {
  config: AudioState;
  position: AudioWidgetPosition;
}

// Position classes for the audio widget container
const WIDGET_POSITION_CLASSES: Record<AudioWidgetPosition, string> = {
  "top-left": "top-6 left-6",
  "top-right": "top-6 right-6",
  "bottom-left": "bottom-6 left-6",
  "bottom-right": "bottom-6 right-6",
  center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
};

export default function AudioWidget({ config, position }: Props) {
  if (!config.src) return null;

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
          <span>{formatDuration(config.currentTime)}</span>
          <span>{formatDuration(config.duration)}</span>
        </div>
      </div>
    </div>
  );
}
