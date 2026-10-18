import type { AppSettings, ChromeSizeKey, TextContentType } from "../../../shared/types";
import type { Translations } from "../../../shared/i18n";
import { CHROME_SIZE_MIN, CHROME_SIZE_MAX, CHROME_SIZE_STEP } from "../../../shared/utils";
import {
  SLIDE_BACKGROUND_PRESETS,
  getSlideTheme,
  findPreset,
  presetGradient,
  DEFAULT_SLIDE_BACKGROUND,
  DEFAULT_BIBLE_BACKGROUND,
} from "../../../shared/slideTheme";
import { MonitorPicker } from "../../components/ui/MonitorPicker";
import { Toggle } from "../../components/ui/Toggle";
import { renderTip } from "../../components/ui/renderTip";
import { ScaledSlide } from "../../components/preview/LivePreview";
import { LinkButton, PercentSlider, SettingRow, SettingsGroup } from "./SettingRow";
import type { SectionProps } from "./types";

const CHROME_SIZE_KEYS: ChromeSizeKey[] = ["titleSize", "slideCounterSize", "slideDotsSize"];

export function DisplaySection({
  settings,
  monitors,
  onSetDisplayMonitor,
  onSetChromeSize,
  onSetSlideBackground,
  onSetBibleBackground,
  t,
}: SectionProps) {
  const resolvedAutoMonitor = monitors.find((m) => !m.isPrimary) ?? monitors[0] ?? null;
  const selectedMonitor = monitors.find((m) => m.id === settings.displayMonitor);
  const monitorCaption =
    settings.displayMonitor === -1
      ? resolvedAutoMonitor
        ? `${t.settings.autoResolvedTo}${resolvedAutoMonitor.label || resolvedAutoMonitor.name}`
        : t.settings.selectMonitorHint
      : selectedMonitor
        ? selectedMonitor.label || selectedMonitor.name
        : t.settings.selectMonitorHint;

  const chromeSizesChanged = CHROME_SIZE_KEYS.some((key) => settings[key] !== 100);
  const backgroundIsDefault =
    settings.slideBackgroundFrom === DEFAULT_SLIDE_BACKGROUND.from &&
    settings.slideBackgroundTo === DEFAULT_SLIDE_BACKGROUND.to &&
    !settings.bibleBackgroundEnabled;

  const resetBackground = () => {
    onSetSlideBackground(DEFAULT_SLIDE_BACKGROUND.from, DEFAULT_SLIDE_BACKGROUND.to);
    onSetBibleBackground(false, DEFAULT_BIBLE_BACKGROUND.from, DEFAULT_BIBLE_BACKGROUND.to);
  };

  return (
    <>
      {/* Stays in view on desktop so every change below shows up as it's made.
          Sticky offsets start inside <main>'s padding (p-4 at lg), so -top-4
          pins it flush to the top edge with nothing showing above it. */}
      <div className="lg:sticky lg:-top-4 lg:pt-4 pb-2 z-10 bg-gray-900">
        <SlidePreview settings={settings} t={t} />
      </div>

      <SettingsGroup tip={renderTip(t.settings.displayTip)}>
        <SettingRow
          id="displayMonitor"
          label={t.settings.displayMonitor}
          hint={t.settings.displayMonitorHint}
        >
          <MonitorPicker
            monitors={monitors}
            value={settings.displayMonitor}
            resolvedAutoId={resolvedAutoMonitor?.id ?? null}
            onChange={onSetDisplayMonitor}
            language={settings.language}
          />
          <div className="mt-3 flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-500">{monitorCaption}</span>
            {settings.displayMonitor !== -1 && (
              <LinkButton onClick={() => onSetDisplayMonitor(-1)}>
                {t.settings.resetToAuto}
              </LinkButton>
            )}
          </div>
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup>
        <SettingRow
          id="slideBackground"
          label={t.settings.slideBackground}
          hint={t.settings.slideBackgroundHint}
          action={
            !backgroundIsDefault && (
              <LinkButton onClick={resetBackground}>{t.settings.resetToDefault}</LinkButton>
            )
          }
        >
          <BackgroundPicker
            from={settings.slideBackgroundFrom}
            to={settings.slideBackgroundTo}
            onChange={onSetSlideBackground}
            t={t}
          />
        </SettingRow>

        <SettingRow
          id="bibleBackground"
          label={t.settings.bibleBackgroundLabel}
          hint={t.settings.bibleBackgroundHint}
          control={
            <Toggle
              checked={settings.bibleBackgroundEnabled}
              onChange={(enabled) =>
                onSetBibleBackground(
                  enabled,
                  settings.bibleBackgroundFrom,
                  settings.bibleBackgroundTo,
                )
              }
              label={t.settings.bibleBackgroundLabel}
            />
          }
        >
          {settings.bibleBackgroundEnabled && (
            <BackgroundPicker
              from={settings.bibleBackgroundFrom}
              to={settings.bibleBackgroundTo}
              onChange={(from, to) => onSetBibleBackground(true, from, to)}
              t={t}
            />
          )}
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup>
        <SettingRow
          id="chromeSizes"
          label={t.settings.chromeSizes}
          hint={t.settings.chromeSizesHint}
          action={
            chromeSizesChanged && (
              <LinkButton
                onClick={() => CHROME_SIZE_KEYS.forEach((key) => onSetChromeSize(key, 100))}
              >
                {t.settings.resetToDefault}
              </LinkButton>
            )
          }
        >
          <div className="space-y-4">
            {CHROME_SIZE_KEYS.map((key) => (
              <PercentSlider
                key={key}
                label={t.settings[key]}
                value={settings[key]}
                min={CHROME_SIZE_MIN}
                max={CHROME_SIZE_MAX}
                step={CHROME_SIZE_STEP}
                onChange={(size) => onSetChromeSize(key, size)}
              />
            ))}
          </div>
        </SettingRow>
      </SettingsGroup>
    </>
  );
}

/**
 * A hymn slide and a Bible slide drawn exactly as the projector draws them
 * (the same `ScaledSlide` the live preview uses), so background and size
 * changes can be judged without looking up at the screen.
 */
function SlidePreview({ settings, t }: { settings: AppSettings; t: Translations }) {
  const samples: { contentType: TextContentType; label: string; title: string; text: string }[] = [
    {
      contentType: "hymn",
      label: t.settings.previewHymnLabel,
      title: t.settings.previewHymnTitle,
      text: t.settings.previewHymnText,
    },
    {
      contentType: "bible",
      label: t.settings.previewBibleLabel,
      title: t.settings.previewBibleTitle,
      text: t.settings.previewBibleText,
    },
  ];

  return (
    <section aria-label={t.settings.previewTitle} className="space-y-2">
      <p className="text-sm text-gray-400">{t.settings.previewHint}</p>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {samples.map((sample) => (
          <figure key={sample.contentType} className="min-w-0">
            <div className="aspect-video rounded-lg overflow-hidden border border-gray-700 bg-black">
              <ScaledSlide
                content={sample.text}
                title={sample.title}
                contentType={sample.contentType}
                // Three slides, so the counter and dots appear as they would live.
                slides={[sample.text, sample.text, sample.text]}
                currentSlide={0}
                settings={settings}
              />
            </div>
            <figcaption className="mt-1 text-xs text-gray-500 text-center">
              {sample.label}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/**
 * Preset swatches + custom stops for one gradient. Used twice — the global
 * background and the optional Bible override — so the two can't drift.
 */
function BackgroundPicker({
  from,
  to,
  onChange,
  t,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  t: Translations;
}) {
  const activePreset = findPreset(from, to);
  const theme = getSlideTheme(from, to);

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {SLIDE_BACKGROUND_PRESETS.map((preset) => {
          const selected = activePreset?.id === preset.id;
          const name =
            t.settings.backgroundPresets[preset.id as keyof typeof t.settings.backgroundPresets];
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange(preset.from, preset.to)}
              aria-pressed={selected}
              className={`rounded-lg border overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors ${
                selected
                  ? "border-blue-500/70 ring-2 ring-blue-500/40"
                  : "border-gray-700/50 hover:border-gray-600"
              }`}
            >
              <span className="block h-10 w-full" style={{ background: presetGradient(preset) }} />
              <span className="block text-[11px] text-gray-400 truncate px-1 py-1">{name}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="text-sm text-gray-400 mb-2">{t.settings.customColors}</div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="color"
              value={from}
              onChange={(e) => onChange(e.target.value, to)}
              className="w-10 h-8 bg-gray-800 border border-gray-700 rounded cursor-pointer"
            />
            {t.settings.gradientTop}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="color"
              value={to}
              onChange={(e) => onChange(from, e.target.value)}
              className="w-10 h-8 bg-gray-800 border border-gray-700 rounded cursor-pointer"
            />
            {t.settings.gradientBottom}
          </label>
        </div>
      </div>

      {theme.minContrast < 4.5 && (
        <p className="mt-3 text-sm text-amber-400">{t.settings.lowContrastWarning}</p>
      )}
    </div>
  );
}
