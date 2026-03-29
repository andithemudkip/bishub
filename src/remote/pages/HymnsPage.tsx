import { useState, useEffect, useMemo, useRef } from "react";
import { useFocusSearch } from "../hooks/useFocusSearch";
import type { Hymn, TextState, AppSettings } from "../../shared/types";
import { getTranslations } from "../../shared/i18n";
import { normalizeForSearch } from "../../shared/utils";
import { CloseIcon } from "../components/icons/ui";
import { StatusBanner } from "../components/ui/Card";

interface Props {
  textState: TextState;
  isTextMode: boolean;
  hymns: Hymn[];
  onLoadHymn: (hymnNumber: string) => void;
  settings: AppSettings;
}

export default function HymnsPage({
  textState,
  isTextMode,
  hymns,
  onLoadHymn,
  settings,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredHymns, setFilteredHymns] = useState<Hymn[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const t = getTranslations(settings.language);

  // F5 focus event
  useFocusSearch(searchInputRef);

  // Pre-compute normalized titles for faster searching
  const hymnsWithNormalizedTitles = useMemo(() => {
    return hymns.map((h) => ({
      hymn: h,
      normalizedTitle: normalizeForSearch(h.title),
    }));
  }, [hymns]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredHymns(hymns.slice(0, 30));
      return;
    }

    const normalizedQuery = normalizeForSearch(searchQuery);

    // Split query into words for multi-word matching
    const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);

    const filtered = hymnsWithNormalizedTitles
      .filter(({ hymn, normalizedTitle }) => {
        // Check if it's a number search
        if (hymn.number.includes(searchQuery.trim())) {
          return true;
        }

        // Check if all query words appear in the title
        return queryWords.every((word) => normalizedTitle.includes(word));
      })
      .map(({ hymn }) => hymn)
      .slice(0, 30);

    setFilteredHymns(filtered);
  }, [searchQuery, hymns, hymnsWithNormalizedTitles]);

  const handleSelectHymn = (hymn: Hymn) => {
    onLoadHymn(hymn.number);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && filteredHymns.length > 0) {
      onLoadHymn(filteredHymns[0].number);
      e.currentTarget.blur();
    }
  };

  const isCurrentHymn = (hymn: Hymn) => {
    return textState.title.startsWith(`${hymn.number}.`);
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto w-full">
      {/* Search */}
      <div className="sticky -top-4 bg-gray-900 pb-4 pt-4 -mx-4 px-4">
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.hymns.searchPlaceholder}
            className="w-full px-4 py-3 pr-10 bg-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      {/* Current hymn indicator */}
      {isTextMode && textState.slides.length > 0 && (
        <StatusBanner>
          <div className="text-sm text-blue-400 mb-1">
            {t.hymns.nowDisplaying}
          </div>
          <div className="font-semibold">{textState.title}</div>
          <div className="text-sm text-gray-400 mt-1">
            {t.hymns.slide} {textState.currentSlide + 1} {t.hymns.of}{" "}
            {textState.slides.length}
          </div>
        </StatusBanner>
      )}

      {/* Hymn list */}
      <div className="grid gap-2">
        {filteredHymns.map((hymn) => (
          <button
            key={hymn.number}
            onClick={() => handleSelectHymn(hymn)}
            className={`text-left px-4 py-3 rounded-xl border transition-colors ${
              isCurrentHymn(hymn)
                ? "border-blue-500/50 bg-blue-950/30"
                : "border-gray-700/50 bg-gray-800/50 hover:border-gray-600/50 hover:bg-gray-700/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`font-mono text-sm font-bold ${
                isCurrentHymn(hymn) ? "text-blue-300" : "text-blue-400"
              }`}>
                {hymn.number}
              </span>
              <span className="text-gray-600">·</span>
              <span className="font-medium truncate">{hymn.title}</span>
              <span className="ml-auto text-xs text-gray-500 flex-shrink-0">
                {hymn.verses.length}{hymn.verses.length === 1 ? ` ${t.hymns.verse}` : ` ${t.hymns.verses}`}
                {hymn.chorus && ` + ${t.hymns.chorus}`}
              </span>
            </div>
          </button>
        ))}

        {filteredHymns.length === 0 && searchQuery && (
          <div className="text-center py-8 text-gray-400">
            {t.hymns.noHymnsFound} "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}
