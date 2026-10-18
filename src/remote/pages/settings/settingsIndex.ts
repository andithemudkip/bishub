import type { Translations } from "../../../shared/i18n";
import { normalizeForSearch } from "../../../shared/utils";

/** Sidebar order: what's touched before a service first, set-once and troubleshooting last. */
export const SETTINGS_SECTIONS = [
  "general",
  "display",
  "idle",
  "content",
  "devices",
  "storage",
  "shortcuts",
  "about",
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number];

export function isSettingsSection(value: unknown): value is SettingsSectionId {
  return (SETTINGS_SECTIONS as readonly unknown[]).includes(value);
}

/** Sections whose every control needs the main computer. */
const ELECTRON_ONLY_SECTIONS: ReadonlySet<SettingsSectionId> = new Set(["devices"]);

export function visibleSections(isElectron: boolean): SettingsSectionId[] {
  return SETTINGS_SECTIONS.filter((s) => isElectron || !ELECTRON_ONLY_SECTIONS.has(s));
}

/**
 * One searchable setting. `id` is the `SettingRow` it scrolls to; the label
 * and hint are what the row shows, so search matches what people read.
 */
export interface SettingEntry {
  id: string;
  section: SettingsSectionId;
  label: (t: Translations) => string;
  hint?: (t: Translations) => string;
  electronOnly?: boolean;
}

export const SETTINGS_INDEX: SettingEntry[] = [
  { id: "language", section: "general", label: (t) => t.settings.language, hint: (t) => t.settings.languageHint },
  {
    id: "openOnStartup",
    section: "general",
    label: (t) => t.settings.openOnStartup,
    hint: (t) => t.settings.openOnStartupHint,
    electronOnly: true,
  },
  {
    id: "displayMonitor",
    section: "display",
    label: (t) => t.settings.displayMonitor,
    hint: (t) => t.settings.displayMonitorHint,
  },
  {
    id: "slideBackground",
    section: "display",
    label: (t) => t.settings.slideBackground,
    hint: (t) => t.settings.slideBackgroundHint,
  },
  {
    id: "bibleBackground",
    section: "display",
    label: (t) => t.settings.bibleBackgroundLabel,
    hint: (t) => t.settings.bibleBackgroundHint,
  },
  {
    id: "chromeSizes",
    section: "display",
    label: (t) => t.settings.chromeSizes,
    hint: (t) =>
      `${t.settings.chromeSizesHint} ${t.settings.titleSize} ${t.settings.slideCounterSize} ${t.settings.slideDotsSize}`,
  },
  {
    id: "idleBackground",
    section: "idle",
    label: (t) => t.settings.idleBackground,
    hint: (t) => t.settings.idleBackgroundHint,
  },
  { id: "idleDim", section: "idle", label: (t) => t.settings.idleDim, hint: (t) => t.settings.idleDimHint },
  { id: "idleBlur", section: "idle", label: (t) => t.settings.idleBlur, hint: (t) => t.settings.idleBlurHint },
  { id: "idleShowClock", section: "idle", label: (t) => t.settings.idleShowClock },
  { id: "idleShowDate", section: "idle", label: (t) => t.settings.idleShowDate },
  {
    id: "clockFontSize",
    section: "idle",
    label: (t) => t.settings.clockFontSize,
    hint: (t) => t.settings.clockFontSizeHint,
  },
  { id: "clockPosition", section: "idle", label: (t) => t.settings.clockPosition },
  { id: "audioWidgetPosition", section: "idle", label: (t) => t.settings.audioWidgetPosition },
  {
    id: "bibleTranslation",
    section: "content",
    label: (t) => t.settings.bibleTranslation,
    hint: (t) => t.settings.bibleTranslationHint,
  },
  { id: "hymnal", section: "content", label: (t) => t.hymns.hymnal, hint: (t) => t.settings.hymnalHint },
  {
    id: "syncedLyrics",
    section: "content",
    label: (t) => t.karaoke.defaultToggleLabel,
    hint: (t) => `${t.karaoke.sectionTitle} ${t.karaoke.defaultToggleHint}`,
  },
  {
    id: "instrumentals",
    section: "content",
    label: (t) => t.karaoke.instrumentalsToggleLabel,
    hint: (t) => `${t.karaoke.sectionTitle} ${t.karaoke.instrumentalsToggleHint}`,
  },
  {
    id: "connectPhone",
    section: "devices",
    label: (t) => t.settings.connectPhoneTitle,
    hint: (t) => `${t.settings.mobileRemote} ${t.settings.sameWifi} ${t.settings.securityKey}`,
    electronOnly: true,
  },
  {
    id: "devices",
    section: "devices",
    label: (t) => t.devices.sectionTitle,
    hint: (t) => t.settings.devicesHint,
    electronOnly: true,
  },
  {
    id: "storageUsage",
    section: "storage",
    label: (t) => t.settings.storageUsageTitle,
    hint: (t) => `${t.settings.storageUsageHint} ${t.settings.spareCopiesTitle}`,
  },
  {
    id: "instrumentalDownloads",
    section: "storage",
    label: (t) => t.settings.instrumentalsTitle,
    hint: (t) => `${t.settings.instrumentalsHint} ${t.karaoke.downloadAll} ${t.karaoke.clearCache}`,
  },
  {
    id: "shortcuts",
    section: "shortcuts",
    label: (t) => t.settings.keyboardShortcuts,
    hint: (t) => t.settings.sections.shortcuts.description,
  },
  {
    id: "updates",
    section: "about",
    label: (t) => t.settings.updatesTitle,
    hint: (t) => `${t.updates.checkForUpdates} ${t.updates.currentVersion}`,
  },
];

/**
 * Settings matching every word of `query`, in the label, the hint or the
 * section title. Label matches rank first — someone typing "clock" wants the
 * clock rows, not every row whose hint mentions it — then index order.
 */
export function searchSettings(
  query: string,
  t: Translations,
  isElectron: boolean,
): SettingEntry[] {
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const ranked: { entry: SettingEntry; rank: number }[] = [];
  for (const entry of SETTINGS_INDEX) {
    if (entry.electronOnly && !isElectron) continue;
    const label = normalizeForSearch(entry.label(t));
    const haystack = normalizeForSearch(
      `${entry.label(t)} ${entry.hint?.(t) ?? ""} ${t.settings.sections[entry.section].title}`,
    );
    if (!words.every((w) => haystack.includes(w))) continue;
    const rank = label.startsWith(words[0]) ? 0 : words.every((w) => label.includes(w)) ? 1 : 2;
    ranked.push({ entry, rank });
  }
  // Stable sort keeps index order within a rank.
  return ranked.sort((a, b) => a.rank - b.rank).map((r) => r.entry);
}
