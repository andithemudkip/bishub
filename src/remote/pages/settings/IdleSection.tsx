import { useContext, useEffect, useState } from "react";
import type { AudioState, AudioWidgetPosition, IdleBackground } from "../../../shared/types";
import { DEFAULT_STATE } from "../../../shared/types";
import {
  IDLE_COLOR_SUGGESTIONS,
  IDLE_GRADIENTS,
  IDLE_GRADIENT_IDS,
  MAX_IDLE_DIM,
} from "../../../shared/idleBackground";
import { libraryImageThumbnailUrl, useLibraryImages } from "../../hooks/useLibraryImages";
import IdleScreen from "../../components/preview/IdleScreen";
import { ImageIcon } from "../../components/icons/image";
import { PositionPicker } from "../../components/ui/PositionPicker";
import { Toggle } from "../../components/ui/Toggle";
import { renderTip } from "../../components/ui/renderTip";
import { IdleImagePicker } from "./IdleImagePicker";
import { SettingRow, SettingsGroup } from "./SettingRow";
import { HighlightContext } from "./settingsNavigation";
import type { SectionProps } from "./types";

/** How long the preview shows a sample music widget after its position changes. */
const SAMPLE_AUDIO_MS = 4000;

const swatchClass = (selected: boolean) =>
  `rounded-lg border overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors ${
    selected ? "border-blue-500/70 ring-2 ring-blue-500/40" : "border-gray-700/50 hover:border-gray-600"
  }`;

export function IdleSection({
  idleState,
  settings,
  onSetIdleBackground,
  onChooseIdleWallpaper,
  onSetIdleDim,
  onSetIdleBlur,
  onSetIdleShowClock,
  onSetIdleShowDate,
  onSetClockFontSize,
  onSetClockPosition,
  onSetAudioWidgetPosition,
  isElectron,
  t,
}: SectionProps) {
  const highlighted = useContext(HighlightContext);
  const pickerClass = (id: string) =>
    `-m-2 p-2 rounded-lg scroll-mt-24 transition-colors duration-700 ${
      highlighted === id ? "bg-blue-500/15" : ""
    }`;
  const { background } = idleState;

  // Nothing may be playing, so moving the music widget shows a stand-in for a moment.
  const [showSampleAudio, setShowSampleAudio] = useState(false);
  useEffect(() => {
    if (!showSampleAudio) return;
    const timer = setTimeout(() => setShowSampleAudio(false), SAMPLE_AUDIO_MS);
    return () => clearTimeout(timer);
  }, [showSampleAudio, idleState.audioWidgetPosition]);
  const sampleAudio: AudioState | undefined = showSampleAudio
    ? {
        ...DEFAULT_STATE.audio,
        src: "sample",
        name: t.settings.idleSampleAudio,
        playing: true,
        currentTime: 72,
        duration: 214,
      }
    : undefined;
  const moveAudioWidget = (position: AudioWidgetPosition) => {
    onSetAudioWidgetPosition(position);
    setShowSampleAudio(true);
  };

  const library = useLibraryImages();
  const [pickingImage, setPickingImage] = useState(false);
  const currentImage =
    background.kind === "image"
      ? library.images.find((image) => image.id === background.imageId)
      : undefined;

  // A color that isn't one of the suggestions belongs to the custom picker.
  const customColor =
    background.kind === "color" && !IDLE_COLOR_SUGGESTIONS.includes(background.color)
      ? background.color
      : null;

  const isSelected = (candidate: IdleBackground) =>
    JSON.stringify(candidate) === JSON.stringify(background);

  return (
    <SettingsGroup tip={renderTip(t.settings.idleScreenTip)}>
      {/* The display's own idle screen, scaled: every change shows here as it does on the projector. */}
      <div className="pb-4 first:pt-2">
        <div
          role="img"
          aria-label={t.settings.idlePreview}
          className="aspect-video w-full max-w-md mx-auto overflow-hidden rounded-lg border border-gray-700/50 bg-black"
        >
          <IdleScreen idle={idleState} language={settings.language} audioState={sampleAudio} />
        </div>
      </div>

      <SettingRow
        id="idleBackground"
        label={t.settings.idleBackground}
        hint={t.settings.idleBackgroundHint}
      >
        {/* One choice in three labeled groups, each on its own line so the
            wrapping is predictable; gradient names are in the tooltips. */}
        <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-x-4">
          <div className="text-xs text-gray-500">{t.settings.idleGradientsLabel}</div>
          <div className="flex flex-wrap gap-2">
            {IDLE_GRADIENT_IDS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onSetIdleBackground({ kind: "gradient", preset })}
                aria-pressed={isSelected({ kind: "gradient", preset })}
                aria-label={t.settings.idleGradients[preset]}
                title={t.settings.idleGradients[preset]}
                className={`w-10 h-8 ${swatchClass(isSelected({ kind: "gradient", preset }))}`}
                style={{ background: IDLE_GRADIENTS[preset] }}
              />
            ))}
          </div>

          <div className="text-xs text-gray-500">{t.settings.idleColorsLabel}</div>
          <div className="flex flex-wrap gap-2">
            {IDLE_COLOR_SUGGESTIONS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onSetIdleBackground({ kind: "color", color })}
                aria-pressed={isSelected({ kind: "color", color })}
                aria-label={color}
                className={`w-10 h-8 ${swatchClass(isSelected({ kind: "color", color }))}`}
                style={{ background: color }}
              />
            ))}
            {/* The native picker, invisible over a labeled pill: the swatch shows a
                rainbow until a custom color is chosen, then that color. */}
            <label
              className={`relative h-8 flex-shrink-0 flex items-center gap-2 pl-1 pr-3 whitespace-nowrap text-sm text-gray-300 bg-gray-800 cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 ${swatchClass(
                customColor !== null
              )}`}
            >
              <span
                data-testid="idle-custom-swatch"
                className="w-8 h-6 rounded border border-white/10"
                style={{
                  background:
                    customColor ??
                    "conic-gradient(from 90deg, #ef4444, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444)",
                }}
              />
              {t.settings.idleCustomColor}
              <input
                type="color"
                value={customColor ?? "#000000"}
                onChange={(e) => onSetIdleBackground({ kind: "color", color: e.target.value })}
                aria-label={t.settings.idleCustomColor}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </label>
          </div>

          <div className="text-xs text-gray-500">{t.settings.idleImage}</div>
          <div className="flex">
            <button
              type="button"
              onClick={() => setPickingImage(true)}
              aria-pressed={background.kind === "image"}
              className={`h-8 flex-shrink-0 flex items-center gap-2 pr-3 whitespace-nowrap text-sm text-gray-300 bg-gray-800 ${swatchClass(
                background.kind === "image"
              )} ${currentImage ? "" : "pl-2"}`}
            >
              {currentImage ? (
                <img
                  src={libraryImageThumbnailUrl(currentImage)}
                  alt=""
                  className="w-12 h-full object-cover"
                />
              ) : (
                <ImageIcon className="w-4 h-4 text-gray-400" />
              )}
              {background.kind === "image" ? t.settings.idleImageChange : t.settings.idleImageChoose}
            </button>
          </div>
        </div>

        {pickingImage && (
          <IdleImagePicker
            images={library.images}
            selectedId={background.kind === "image" ? background.imageId : null}
            isElectron={isElectron}
            onPick={(imageId) => onSetIdleBackground({ kind: "image", imageId, path: null })}
            onChooseFile={onChooseIdleWallpaper}
            onUpload={library.upload}
            onClose={() => setPickingImage(false)}
            t={t}
          />
        )}
      </SettingRow>

      <SettingRow
        id="idleDim"
        label={t.settings.idleDim}
        hint={t.settings.idleDimHint}
        control={<span className="tabular-nums text-sm text-gray-400">{idleState.dim}%</span>}
      >
        <input
          type="range"
          min="0"
          max={MAX_IDLE_DIM}
          step="5"
          value={idleState.dim}
          onChange={(e) => onSetIdleDim(Number(e.target.value))}
          aria-label={t.settings.idleDim}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{t.settings.idleDimLighter}</span>
          <span>{t.settings.idleDimDarker}</span>
        </div>
      </SettingRow>

      {/* Disabled, not hidden, for gradients and colors, so the section doesn't jump around. */}
      <SettingRow
        id="idleBlur"
        label={t.settings.idleBlur}
        hint={background.kind === "image" ? t.settings.idleBlurHint : t.settings.idleBlurImageOnly}
        control={
          background.kind === "image" && (
            <span className="tabular-nums text-sm text-gray-400">{idleState.blur}%</span>
          )
        }
      >
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={idleState.blur}
          onChange={(e) => onSetIdleBlur(Number(e.target.value))}
          disabled={background.kind !== "image"}
          aria-label={t.settings.idleBlur}
          className="w-full disabled:opacity-40"
        />
        <div
          className={`flex justify-between text-xs text-gray-500 mt-1 ${
            background.kind === "image" ? "" : "opacity-40"
          }`}
        >
          <span>{t.settings.idleBlurSharp}</span>
          <span>{t.settings.idleBlurSoft}</span>
        </div>
      </SettingRow>

      <SettingRow
        id="idleShowClock"
        label={t.settings.idleShowClock}
        control={
          <Toggle
            checked={idleState.showClock}
            onChange={onSetIdleShowClock}
            label={t.settings.idleShowClock}
          />
        }
      />

      <SettingRow
        id="idleShowDate"
        label={t.settings.idleShowDate}
        control={
          // The date sits under the clock; without the clock there's nothing to show it with.
          <Toggle
            checked={idleState.showDate}
            onChange={onSetIdleShowDate}
            label={t.settings.idleShowDate}
            disabled={!idleState.showClock}
          />
        }
      />

      <SettingRow
        id="clockFontSize"
        label={t.settings.clockFontSize}
        hint={t.settings.clockFontSizeHint}
        control={
          <span className="tabular-nums text-sm text-gray-400">{idleState.clockFontSize}%</span>
        }
      >
        <input
          type="range"
          min="50"
          max="150"
          step="10"
          value={idleState.clockFontSize}
          onChange={(e) => onSetClockFontSize(Number(e.target.value))}
          aria-label={t.settings.clockFontSize}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{t.settings.clockSmaller}</span>
          <span>{t.settings.clockLarger}</span>
        </div>
      </SettingRow>

      {/* Bottom-aligned: the labels wrap at different widths ("Poziția
          informațiilor despre melodie"), and the boxes must still line up. */}
      <div className="-mx-3 px-3 py-4 last:pb-2 grid grid-cols-2 items-end gap-4 sm:gap-8">
        <div data-setting="clockPosition" className={pickerClass("clockPosition")}>
          <PositionPicker
            value={idleState.clockPosition}
            onChange={onSetClockPosition}
            label={t.settings.clockPosition}
          />
        </div>
        <div data-setting="audioWidgetPosition" className={pickerClass("audioWidgetPosition")}>
          <PositionPicker
            value={idleState.audioWidgetPosition}
            onChange={moveAudioWidget}
            label={t.settings.audioWidgetPosition}
          />
        </div>
      </div>
    </SettingsGroup>
  );
}
