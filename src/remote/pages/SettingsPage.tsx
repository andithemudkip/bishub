import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getTranslations } from "../../shared/i18n";
import { SettingsIcon } from "../components/icons/settings";
import { BibleIcon } from "../components/icons/bible";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  CloudDownloadIcon,
  InfoIcon,
  KeyboardIcon,
  MonitorIcon,
  PhoneIcon,
  SearchIcon,
} from "../components/icons/ui";
import {
  searchSettings,
  visibleSections,
  type SettingsSectionId,
} from "./settings/settingsIndex";
import { HighlightContext, readLastSection, rememberSection } from "./settings/settingsNavigation";
import { usePageIntent } from "../hooks/usePageIntent";
import { GeneralSection } from "./settings/GeneralSection";
import { DisplaySection } from "./settings/DisplaySection";
import { IdleSection } from "./settings/IdleSection";
import { ContentSection } from "./settings/ContentSection";
import { DevicesSection } from "./settings/DevicesSection";
import { StorageSection } from "./settings/StorageSection";
import { ShortcutsSection } from "./settings/ShortcutsSection";
import { AboutSection } from "./settings/AboutSection";
import type { SectionProps, SettingsPageProps } from "./settings/types";

const SECTION_ICONS: Record<SettingsSectionId, (props: { className?: string }) => ReactNode> = {
  general: SettingsIcon,
  display: MonitorIcon,
  idle: ClockIcon,
  content: BibleIcon,
  devices: PhoneIcon,
  storage: CloudDownloadIcon,
  shortcuts: KeyboardIcon,
  about: InfoIcon,
};

const SECTION_COMPONENTS: Record<SettingsSectionId, (props: SectionProps) => ReactNode> = {
  general: GeneralSection,
  display: DisplaySection,
  idle: IdleSection,
  content: ContentSection,
  devices: DevicesSection,
  storage: StorageSection,
  shortcuts: ShortcutsSection,
  about: AboutSection,
};

/**
 * Settings, one section at a time. Desktop (lg+) shows a sidebar of sections
 * beside the open one; narrower screens show the section list first and drill
 * into a section with a back button, like phone settings apps. Search filters
 * every setting by what its row says and jumps straight to it.
 */
export default function SettingsPage(props: SettingsPageProps) {
  const t = getTranslations(props.settings.language);
  const isElectron = !!window.electronAPI;
  const sections = visibleSections(isElectron);

  const [active, setActive] = useState<SettingsSectionId>(() => {
    const last = readLastSection();
    return last && sections.includes(last) ? last : "general";
  });
  /** Below lg only: the section list, or the open section. */
  const [phoneView, setPhoneView] = useState<"list" | "section">("list");
  const [query, setQuery] = useState("");
  /**
   * Where the last open asked to land; a fresh object each time, so picking
   * the same row twice still scrolls. Kept apart from `highlighted`, whose
   * fading must not scroll anything.
   */
  const [jump, setJump] = useState<{ settingId: string | null } | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const openSection = useCallback((section: SettingsSectionId, settingId?: string) => {
    setActive(section);
    rememberSection(section);
    setPhoneView("section");
    setQuery("");
    setJump({ settingId: settingId ?? null });
    setHighlighted(settingId ?? null);
  }, []);

  // Deep links from other pages ("Open settings", "Choose screen").
  usePageIntent("settings", (intent) => openSection(intent.section, intent.settingId));

  // Bring the picked row (or the top of the section) into view, then let the
  // highlight fade.
  useEffect(() => {
    if (!jump) return;
    const target = jump.settingId
      ? contentRef.current?.querySelector(`[data-setting="${jump.settingId}"]`)
      : contentRef.current;
    target?.scrollIntoView?.({ block: jump.settingId ? "center" : "start", behavior: "smooth" });
    if (!jump.settingId) return;
    const timer = setTimeout(() => setHighlighted(null), 2000);
    return () => clearTimeout(timer);
  }, [jump]);

  const results = useMemo(
    () => searchSettings(query, t, isElectron),
    [query, t, isElectron],
  );

  const sectionProps: SectionProps = { ...props, t, isElectron, onOpenSection: openSection };
  const ActiveSection = SECTION_COMPONENTS[active];
  const ActiveIcon = SECTION_ICONS[active];

  return (
    <div className="max-w-5xl mx-auto lg:flex lg:items-start lg:gap-6">
      {/* Section list + search */}
      <nav
        aria-label={t.nav.settings}
        className={`lg:w-60 lg:flex-shrink-0 lg:sticky lg:top-0 space-y-3 ${
          phoneView === "section" ? "hidden lg:block" : ""
        }`}
      >
        <h1 className="text-xl font-semibold px-1 hidden md:block lg:hidden">{t.nav.settings}</h1>
        <div className="relative">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
              if (e.key === "Enter" && results[0]) openSection(results[0].section, results[0].id);
            }}
            placeholder={t.settings.searchPlaceholder}
            aria-label={t.settings.searchPlaceholder}
            className="w-full pl-9 pr-9 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t.settings.searchClear}
              title={t.settings.searchClear}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {query.trim() ? (
          results.length === 0 ? (
            <p className="px-1 text-sm text-gray-500">
              {t.settings.searchNoResults.replace("{query}", query.trim())}
            </p>
          ) : (
            <ul className="space-y-1" aria-label={t.settings.searchPlaceholder}>
              {results.map((entry) => {
                const Icon = SECTION_ICONS[entry.section];
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => openSection(entry.section, entry.id)}
                      className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg bg-gray-900/50 border border-gray-700/30 hover:border-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <Icon className="w-4 h-4 flex-shrink-0 text-gray-500" />
                      <span className="min-w-0">
                        <span className="block text-sm text-gray-100 truncate">
                          {entry.label(t)}
                        </span>
                        <span className="block text-xs text-gray-500 truncate">
                          {t.settings.sections[entry.section].title}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : (
          <ul className="space-y-1">
            {sections.map((section) => {
              const Icon = SECTION_ICONS[section];
              const selected = section === active;
              return (
                <li key={section}>
                  <button
                    type="button"
                    onClick={() => openSection(section)}
                    aria-current={selected ? "page" : undefined}
                    className={`w-full flex items-center gap-3 text-left px-3 py-3 lg:py-2 rounded-lg border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 bg-gray-900/50 border-gray-700/30 lg:bg-transparent lg:border-transparent ${
                      selected
                        ? "lg:!bg-blue-950/30 lg:!border-blue-500/40 lg:text-blue-300"
                        : "text-gray-300 hover:text-white hover:bg-gray-800"
                    }`}
                  >
                    <Icon className="w-5 h-5 lg:w-4 lg:h-4 flex-shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium">
                        {t.settings.sections[section].title}
                      </span>
                      <span className="block text-xs text-gray-500 lg:hidden">
                        {t.settings.sections[section].description}
                      </span>
                    </span>
                    <ChevronRightIcon className="w-4 h-4 text-gray-500 lg:hidden" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* The open section */}
      <div
        ref={contentRef}
        className={`flex-1 min-w-0 space-y-4 scroll-mt-4 ${
          phoneView === "list" ? "hidden lg:block" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => setPhoneView("list")}
          className="lg:hidden flex items-center gap-1 -ml-1 px-1 py-1 text-sm text-blue-400 hover:text-blue-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          {t.settings.allSettings}
        </button>
        <header className="flex items-start gap-3 px-1">
          <ActiveIcon className="w-6 h-6 mt-0.5 flex-shrink-0 text-gray-400" />
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">{t.settings.sections[active].title}</h2>
            <p className="text-sm text-gray-400">{t.settings.sections[active].description}</p>
          </div>
        </header>
        <HighlightContext.Provider value={highlighted}>
          <ActiveSection {...sectionProps} />
        </HighlightContext.Provider>
      </div>
    </div>
  );
}
