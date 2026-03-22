import { useMemo } from "react";
import type { BibleSearchResult } from "../../../shared/types";
import type { ParsedReference } from "../../../shared/bibleParser";
import { getTranslations } from "../../../shared/i18n";
import { removeDiacritics, formatTimeAgo } from "../../../shared/utils";
import type { Language } from "../../../shared/i18n";
import { StatusBanner } from "../ui/Card";
import type { SearchHistoryEntry } from "../../pages/BiblePage";

interface Props {
  searchInput: string;
  parsedRef: ParsedReference | null;
  invalidRef: boolean;
  textSearchResults: BibleSearchResult[];
  isSearching: boolean;
  onSelectReference: (
    bookId: string,
    bookName: string,
    chapter: number,
    verse: number
  ) => void;
  onGoReference: () => void;
  searchHistory: SearchHistoryEntry[];
  onHistorySelect: (entry: SearchHistoryEntry) => void;
  onClearHistory: () => void;
  language: Language;
}

function highlightWithPattern(
  text: string,
  pattern: RegExp | null
): React.ReactNode[] {
  if (!pattern) return [text];

  const stripped = removeDiacritics(text);
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset lastIndex since we reuse the regex across calls
  pattern.lastIndex = 0;

  while ((match = pattern.exec(stripped)) !== null) {
    // Guard against zero-length matches to prevent infinite loop
    if (match[0].length === 0) {
      pattern.lastIndex++;
      continue;
    }
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <mark
        key={match.index}
        className="bg-yellow-500/30 text-yellow-200 rounded px-0.5"
      >
        {text.slice(match.index, match.index + match[0].length)}
      </mark>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

export default function SearchResultsTab({
  searchInput,
  parsedRef,
  invalidRef,
  textSearchResults,
  isSearching,
  onSelectReference,
  onGoReference,
  searchHistory,
  onHistorySelect,
  onClearHistory,
  language,
}: Props) {
  const t = getTranslations(language);

  // Memoize the highlight regex so it's compiled once per search query, not per result
  const highlightPattern = useMemo(() => {
    if (!searchInput || searchInput.length < 3) return null;
    const words = searchInput.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return null;
    const escaped = words.map((w) =>
      removeDiacritics(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    );
    return new RegExp(`(${escaped.join("|")})`, "gi");
  }, [searchInput]);

  // Invalid reference (book recognized but chapter/verse out of range)
  if (invalidRef) {
    return (
      <p className="text-sm text-red-400 py-4">{t.bible.couldNotParse}</p>
    );
  }

  // Reference detected — show a card
  if (parsedRef) {
    return (
      <StatusBanner color="green" onClick={onGoReference}>
        <div className="flex items-center justify-between">
          <span className="text-green-400 font-semibold text-lg">
            {parsedRef.bookName} {parsedRef.chapter}:{parsedRef.startVerse}
            {parsedRef.endVerse !== parsedRef.startVerse &&
              `-${parsedRef.endVerse}`}
          </span>
          <span className="px-4 py-1.5 bg-green-600/30 border border-green-600/50 rounded-lg text-sm font-medium text-green-400">
            {t.bible.go}
          </span>
        </div>
      </StatusBanner>
    );
  }

  // Text search
  if (isSearching) {
    return <p className="text-sm text-blue-400 py-4">{t.bible.searching}</p>;
  }

  if (searchInput.length > 0 && searchInput.length < 3) {
    return <p className="text-sm text-gray-500 py-4">{t.bible.minCharsHint}</p>;
  }

  if (textSearchResults.length > 0) {
    return (
      <div>
        <p className="text-sm text-gray-400 mb-2">
          {t.bible.searchResults} ({textSearchResults.length})
        </p>
        <div className="max-h-[60vh] overflow-y-auto space-y-1.5">
          {textSearchResults.map((result) => (
            <button
              key={`${result.bookId}-${result.chapter}-${result.verse}`}
              onClick={() =>
                onSelectReference(
                  result.bookId,
                  result.bookName,
                  result.chapter,
                  result.verse
                )
              }
              className="w-full text-left p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              <span className="text-blue-400 font-semibold text-sm">
                {result.bookName} {result.chapter}:{result.verse}
              </span>
              <p className="text-sm text-gray-300 mt-1">
                {highlightWithPattern(result.text, highlightPattern)}
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (searchInput.length >= 3) {
    return (
      <p className="text-sm text-gray-500 py-4">
        {t.bible.noSearchResults} &quot;{searchInput}&quot;
      </p>
    );
  }

  // Empty state — show search history
  if (searchHistory.length > 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-gray-400">{t.bible.recentSearches}</p>
          <button
            onClick={onClearHistory}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {t.bible.clearHistory}
          </button>
        </div>
        <div className="space-y-1">
          {searchHistory.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onHistorySelect(entry)}
              className="w-full text-left p-3 rounded-lg bg-gray-800/50 hover:bg-gray-700 transition-colors flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <span className="text-blue-400 font-semibold text-sm">
                  {entry.bookName} {entry.chapter}:{entry.verse}
                </span>
                {entry.query !== `${entry.bookName} ${entry.chapter}:${entry.verse}` && (
                  <span className="text-gray-500 text-xs ml-2">
                    &quot;{entry.query}&quot;
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-600 flex-shrink-0">
                {formatTimeAgo(entry.timestamp, t.common)}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
