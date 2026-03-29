import type { ClockPosition } from "../../../shared/types";

const POSITIONS: ClockPosition[] = [
  "top-left",
  "top-right",
  "center",
  "bottom-left",
  "bottom-right",
];

const positionStyles: Record<ClockPosition, string> = {
  "top-left": "top-2.5 left-2.5 sm:top-3.5 sm:left-3.5",
  "top-right": "top-2.5 right-2.5 sm:top-3.5 sm:right-3.5",
  "center": "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
  "bottom-left": "bottom-2.5 left-2.5 sm:bottom-3.5 sm:left-3.5",
  "bottom-right": "bottom-2.5 right-2.5 sm:bottom-3.5 sm:right-3.5",
};

interface PositionPickerProps {
  value: ClockPosition;
  onChange: (position: ClockPosition) => void;
  label: string;
}

export function PositionPicker({ value, onChange, label }: PositionPickerProps) {
  return (
    <div className="flex-1">
      <label className="text-sm text-gray-400 block mb-2">{label}</label>
      <div className="relative w-full aspect-[3/2] bg-gray-900/70 border border-gray-600/50 rounded-lg">
        {POSITIONS.map((pos) => (
          <button
            key={pos}
            type="button"
            onClick={() => onChange(pos)}
            className={`absolute !w-4 !h-4 min-w-4 min-h-4 max-w-4 max-h-4 sm:!w-5 sm:!h-5 sm:min-w-5 sm:min-h-5 sm:max-w-5 sm:max-h-5 rounded-full transition-all ${positionStyles[pos]} ${
              value === pos
                ? "bg-blue-500 ring-2 ring-blue-400/40 scale-125"
                : "bg-gray-600 hover:bg-gray-500"
            }`}
            aria-label={pos}
          />
        ))}
      </div>
    </div>
  );
}
