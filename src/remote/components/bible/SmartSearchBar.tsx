import { useEffect, useRef } from "react";
import {
  parseBibleReference,
  parseBibleReferenceWithBooks,
} from "../../../shared/bibleParser";
import type { ParsedReference, DynamicBookInfo } from "../../../shared/bibleParser";
import type { BibleSearchResult } from "../../../shared/types";
import { getTranslations } from "../../../shared/i18n";
import { CloseIcon } from "../icons/ui";
import type { Language } from "../../../shared/i18n";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onParsedRefChange: (ref: ParsedReference | null) => void;
  onSearchResults: (results: BibleSearchResult[]) => void;
  onSearchingChange: (searching: boolean) => void;
  onSubmitReference: () => void;
  searchBibleVerses: (query: string) => Promise<BibleSearchResult[]>;
  language: Language;
  books: DynamicBookInfo[];
  inputRef: React.RefObject<HTMLInputElement>;
}

const EMPTY_RESULTS: BibleSearchResult[] = [];

export default function SmartSearchBar({
  value,
  onChange,
  onParsedRefChange,
  onSearchResults,
  onSearchingChange,
  onSubmitReference,
  searchBibleVerses,
  language,
  books,
  inputRef,
}: Props) {
  const t = getTranslations(language);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const requestIdRef = useRef(0);
  const lastParsedRef = useRef<ParsedReference | null>(null);
  const lastHadResultsRef = useRef(false);

  // Parse reference and trigger text search on input change
  useEffect(() => {
    // Use dynamic book names from the loaded translation when available,
    // fall back to hardcoded RO/EN book names
    const parsed = books.length > 0
      ? parseBibleReferenceWithBooks(value, books)
      : parseBibleReference(value, language);

    // Only notify parent if parsed result actually changed
    if (parsed?.bookId !== lastParsedRef.current?.bookId ||
        parsed?.chapter !== lastParsedRef.current?.chapter ||
        parsed?.startVerse !== lastParsedRef.current?.startVerse ||
        parsed?.endVerse !== lastParsedRef.current?.endVerse) {
      lastParsedRef.current = parsed;
      onParsedRefChange(parsed);
    }

    // Clear any pending text search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If it's a reference or short query, clear results only if there were any
    if (parsed || value.trim().length < 3) {
      if (lastHadResultsRef.current) {
        lastHadResultsRef.current = false;
        onSearchResults(EMPTY_RESULTS);
      }
      onSearchingChange(false);
      return;
    }

    // Debounced text search with request ID to prevent stale results
    const currentRequestId = ++requestIdRef.current;
    onSearchingChange(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await searchBibleVerses(value.trim());
      // Only apply results if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        lastHadResultsRef.current = results.length > 0;
        onSearchResults(results);
        onSearchingChange(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [value, language, books]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && lastParsedRef.current) {
      onSubmitReference();
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t.bible.searchPlaceholder}
        className="w-full px-4 py-3 pr-10 bg-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}
