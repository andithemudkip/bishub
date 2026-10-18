import { Select } from "../../components/ui/Select";
import { Toggle } from "../../components/ui/Toggle";
import { BibleTranslationPicker } from "../../components/ui/BibleTranslationPicker";
import { ArrowRightIcon } from "../../components/icons/ui";
import { getTranslationsByLanguage } from "../../../shared/bibleTranslations";
import { formatFileSize } from "../../../shared/utils";
import { SettingRow, SettingsGroup } from "./SettingRow";
import type { SectionProps } from "./types";

export function ContentSection({
  settings,
  hymnals,
  onSetBibleTranslation,
  onSetHymnal,
  bibleDownloadStatus,
  downloadedTranslations,
  onSetSyncedLyrics,
  onSetInstrumentals,
  mp3CacheStats,
  onOpenSection,
  t,
}: SectionProps) {
  const languageNames = Array.from(new Set(hymnals.map((h) => h.languageName)));

  return (
    <>
      <SettingsGroup>
        <SettingRow
          id="bibleTranslation"
          label={t.settings.bibleTranslation}
          hint={t.settings.bibleTranslationHint}
        >
          <BibleTranslationPicker
            value={settings.bibleTranslation}
            downloadedIds={downloadedTranslations}
            downloadStatus={bibleDownloadStatus}
            onChange={onSetBibleTranslation}
            translations={getTranslationsByLanguage()}
          />
          {bibleDownloadStatus?.status === "error" && (
            <p className="mt-2 text-sm text-red-400">{t.settings.bibleDownloadError}</p>
          )}
        </SettingRow>

        <SettingRow id="hymnal" label={t.hymns.hymnal} hint={t.settings.hymnalHint}>
          <Select
            value={settings.hymnal}
            onChange={(e) => onSetHymnal(e.target.value)}
            aria-label={t.hymns.hymnal}
          >
            {languageNames.map((languageName) => (
              <optgroup key={languageName} label={languageName}>
                {hymnals
                  .filter((h) => h.languageName === languageName)
                  .map((hymnal) => (
                    <option key={hymnal.slug} value={hymnal.slug}>
                      {hymnal.name} ({hymnal.songCount})
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title={t.karaoke.sectionTitle}>
        <SettingRow
          id="syncedLyrics"
          label={t.karaoke.defaultToggleLabel}
          hint={t.karaoke.defaultToggleHint}
          control={
            <Toggle
              checked={settings.syncedLyrics}
              onChange={onSetSyncedLyrics}
              label={t.karaoke.defaultToggleLabel}
            />
          }
        />
        <SettingRow
          id="instrumentals"
          label={t.karaoke.instrumentalsToggleLabel}
          hint={t.karaoke.instrumentalsToggleHint}
          control={
            <Toggle
              checked={settings.instrumentals}
              onChange={onSetInstrumentals}
              label={t.karaoke.instrumentalsToggleLabel}
            />
          }
        />
        {mp3CacheStats.availableCount > 0 && (
          <div className="py-3 last:pb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-gray-400">
              {t.karaoke.cacheStats
                .replace("{count}", String(mp3CacheStats.count))
                .replace("{total}", String(mp3CacheStats.availableCount))
                .replace("{size}", formatFileSize(mp3CacheStats.sizeBytes))}
            </span>
            <button
              type="button"
              onClick={() => onOpenSection("storage", "instrumentalDownloads")}
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1"
            >
              {t.settings.manageDownloads}
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </SettingsGroup>
    </>
  );
}
