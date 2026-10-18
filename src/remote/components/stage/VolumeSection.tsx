import type { DisplayState } from "../../../shared/types";
import type { Translations } from "../../../shared/i18n";
import { VolumeIcon } from "../icons/ui";
import { Section } from "./Section";
import type { StageActions } from "./types";

interface Props {
  state: DisplayState;
  actions: StageActions;
  t: Translations;
}

/**
 * Video and audio volume, always shown: they persist across loads, so the
 * operator can turn one down *before* something starts too loud. Lives on
 * the Stage so it's at hand mid-service from any page.
 */
export function VolumeSection({ state, actions, t }: Props) {
  const sliders = [
    {
      key: "video",
      label: t.stage.layerVideo,
      ariaLabel: t.videoLibrary.volume,
      value: state.video.volume,
      onChange: actions.setVideoVolume,
    },
    {
      key: "audio",
      label: t.stage.layerAudio,
      ariaLabel: t.audioLibrary.volume,
      value: state.audio.volume,
      onChange: actions.setAudioVolume,
    },
  ];

  return (
    <Section section="volume" title={t.stage.volume}>
      <div className="space-y-2 bg-gray-900/50 border border-gray-700/30 rounded-lg px-2.5 py-2">
        {sliders.map((s) => (
          <label key={s.key} className="flex items-center gap-2 text-xs text-gray-400">
            <VolumeIcon className="w-4 h-4 flex-shrink-0" />
            <span className="w-12 flex-shrink-0 truncate">{s.label}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.value}
              onChange={(e) => s.onChange(Number(e.target.value))}
              aria-label={s.ariaLabel}
              className="flex-1 min-w-0"
            />
            <span className="w-9 text-right tabular-nums">{Math.round(s.value * 100)}%</span>
          </label>
        ))}
      </div>
    </Section>
  );
}
