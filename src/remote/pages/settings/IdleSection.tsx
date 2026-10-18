import { useContext } from "react";
import { PositionPicker } from "../../components/ui/PositionPicker";
import { renderTip } from "../../components/ui/renderTip";
import { SettingRow, SettingsGroup } from "./SettingRow";
import { HighlightContext } from "./settingsNavigation";
import type { SectionProps } from "./types";

export function IdleSection({
  idleState,
  onSetWallpaper,
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
  const wallpaperName = idleState.wallpaper
    ? idleState.wallpaper.split(/[/\\]/).pop() || t.settings.noWallpaper
    : t.settings.noWallpaper;

  return (
    <SettingsGroup tip={renderTip(t.settings.idleScreenTip)}>
      <SettingRow
        id="wallpaper"
        label={t.settings.wallpaper}
        hint={isElectron ? t.settings.wallpaperHint : t.settings.wallpaperOnMainComputer}
      >
        {/* Picking a file needs the main computer's file dialog. */}
        {isElectron && (
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 min-w-0 px-4 py-2.5 bg-gray-900/50 border border-gray-700/30 rounded-lg text-gray-300 truncate">
              {wallpaperName}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onSetWallpaper(true)}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-medium transition-colors bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {t.settings.selectWallpaper}
              </button>
              {idleState.wallpaper && (
                <button
                  type="button"
                  onClick={() => onSetWallpaper(false)}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm transition-colors bg-gray-600/20 text-gray-300 hover:bg-gray-600/30 border border-gray-600/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {t.settings.clearWallpaper}
                </button>
              )}
            </div>
          </div>
        )}
      </SettingRow>

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
            onChange={onSetAudioWidgetPosition}
            label={t.settings.audioWidgetPosition}
          />
        </div>
      </div>
    </SettingsGroup>
  );
}
