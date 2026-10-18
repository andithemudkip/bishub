import type { HymnPlaybackMode } from "../../shared/types";
import type { Translations } from "../../shared/i18n";

type AudioMode = Extract<HymnPlaybackMode, "synced" | "instrumental">;

interface HymnModeSwitchProps {
  /** What the hymn on screen is doing right now. */
  current: "static" | AudioMode;
  /** The audio mode this hymn offers — karaoke when it has synced lyrics. */
  audioMode: AudioMode;
  onSelect: (mode: "static" | AudioMode) => void;
  t: Translations;
}

/**
 * Both modes side by side with the live one lit, so it reads as state and as
 * a control at once — a single button labelled with the *other* mode looked
 * like a status that was always wrong.
 */
export function HymnModeSwitch({ current, audioMode, onSelect, t }: HymnModeSwitchProps) {
  const options = [
    { mode: "static", label: t.hymns.modeText },
    {
      mode: audioMode,
      label: audioMode === "synced" ? t.hymns.modeKaraoke : t.hymns.modeInstrumental,
    },
  ] as const;

  return (
    <div
      role="group"
      aria-label={t.hymns.playbackMode}
      className="flex flex-shrink-0 items-center gap-1 bg-gray-900/50 border border-gray-700/50 rounded-lg overflow-hidden p-1"
    >
      {options.map(({ mode, label }) => {
        const active = current === mode;
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={active}
            onClick={() => !active && onSelect(mode)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none ${
              active
                ? // Matches the banner around it: blue for text, green for audio.
                  mode === "static"
                  ? "bg-blue-600/20 text-blue-400 border border-blue-600/40 cursor-default"
                  : "bg-green-600/20 text-green-400 border border-green-600/40 cursor-default"
                : "text-gray-400 hover:text-white hover:bg-gray-700/50 border border-transparent"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
