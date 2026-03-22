import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type {
  BibleVerse,
  BibleSearchResult,
  TextState,
  AppSettings,
} from "../../shared/types";
import type { ParsedReference } from "../../shared/bibleParser";
import { getTranslations } from "../../shared/i18n";
import SmartSearchBar from "../components/bible/SmartSearchBar";
import SearchResultsTab from "../components/bible/SearchResultsTab";
import BrowseTab from "../components/bible/BrowseTab";
import VerseListView from "../components/bible/VerseListView";
import type { VerseListContext } from "../components/bible/VerseListView";

export interface BibleBook {
  id: string;
  name: string;
  chapterCount: number;
}

interface Props {
  textState: TextState;
  isIdle: boolean;
  getBibleBooks: () => Promise<BibleBook[]>;
  getBibleChapter: (bookId: string, chapter: number) => Promise<BibleVerse[]>;
  loadBibleVerses: (
    bookId: string,
    bookName: string,
    chapter: number,
    startVerse: number,
    endVerse?: number
  ) => void;
  searchBibleVerses: (query: string) => Promise<BibleSearchResult[]>;
  goToSlide: (index: number) => void;
  settings: AppSettings;
}

type View =
  | { type: "search" }
  | { type: "verseList"; context: VerseListContext };

export default function BiblePage({
  textState,
  isIdle,
  getBibleBooks,
  getBibleChapter,
  loadBibleVerses,
  searchBibleVerses,
  goToSlide,
  settings,
}: Props) {
  const [view, setView] = useState<View>({ type: "search" });
  const [books, setBooks] = useState<BibleBook[]>([]);

  // Search state
  const [searchInput, setSearchInput] = useState("");
  const [parsedRef, setParsedRef] = useState<ParsedReference | null>(null);
  const [textSearchResults, setTextSearchResults] = useState<
    BibleSearchResult[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<"results" | "browse">("results");

  // Browse state
  const [browseBook, setBrowseBook] = useState<BibleBook | null>(null);
  const [browseChapter, setBrowseChapter] = useState<number>(1);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const t = getTranslations(settings.language);

  // Validate parsedRef against actual book data (chapter must exist)
  const validatedParsedRef = useMemo(() => {
    if (!parsedRef || books.length === 0) return null;
    const book = books.find((b) => b.id === parsedRef.bookId);
    if (!book || parsedRef.chapter > book.chapterCount || parsedRef.chapter < 1) return null;
    return parsedRef;
  }, [parsedRef, books]);

  // Load books on mount
  useEffect(() => {
    getBibleBooks().then(setBooks);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // F5 focus event
  useEffect(() => {
    const handleFocusSearch = () => {
      if (view.type === "verseList") {
        setView({ type: "search" });
      }
      searchInputRef.current?.focus();
    };
    window.addEventListener("focusSearch", handleFocusSearch);
    return () => window.removeEventListener("focusSearch", handleFocusSearch);
  }, [view.type]);

  // Navigate to verse list for a given book/chapter/verse
  // Returns false if the chapter doesn't exist (no verses returned)
  const navigateToVerseList = useCallback(
    async (
      bookId: string,
      bookName: string,
      chapter: number,
      highlightVerse: number = 1
    ): Promise<boolean> => {
      const verses = await getBibleChapter(bookId, chapter);
      if (verses.length === 0) return false;
      // Clamp highlightVerse to actual range
      const maxVerse = verses[verses.length - 1].verse;
      const clampedVerse = Math.min(highlightVerse, maxVerse);
      setView({
        type: "verseList",
        context: { bookId, bookName, chapter, verses, highlightVerse: clampedVerse },
      });
      return true;
    },
    [getBibleChapter]
  );

  // Handle submitting a parsed reference (Enter or Go button)
  const handleSubmitReference = useCallback(async () => {
    if (!validatedParsedRef) return;
    await navigateToVerseList(
      validatedParsedRef.bookId,
      validatedParsedRef.bookName,
      validatedParsedRef.chapter,
      validatedParsedRef.startVerse
    );
  }, [validatedParsedRef, navigateToVerseList]);

  // Handle clicking a text search result
  const handleSearchResultClick = useCallback(
    async (
      bookId: string,
      bookName: string,
      chapter: number,
      verse: number
    ) => {
      await navigateToVerseList(bookId, bookName, chapter, verse);
    },
    [navigateToVerseList]
  );

  // Handle browse Go button
  const handleBrowseGo = useCallback(async () => {
    if (!browseBook) return;
    await navigateToVerseList(
      browseBook.id,
      browseBook.name,
      browseChapter,
      1
    );
  }, [browseBook, browseChapter, navigateToVerseList]);

  // Handle "View verses" from currently displaying banner
  const handleViewCurrentVerses = useCallback(async () => {
    const ctx = textState.bibleContext;
    if (!ctx) return;
    const currentVerse = ctx.verses[textState.currentSlide];
    await navigateToVerseList(
      ctx.bookId,
      ctx.bookName,
      ctx.chapter,
      currentVerse?.verse ?? 1
    );
  }, [textState.bibleContext, textState.currentSlide, navigateToVerseList]);

  // Verse list view
  if (view.type === "verseList") {
    return (
      <VerseListView
        context={view.context}
        textState={textState}
        isIdle={isIdle}
        loadBibleVerses={loadBibleVerses}
        goToSlide={goToSlide}
        onBack={() => setView({ type: "search" })}
        language={settings.language}
      />
    );
  }

  // Search view
  return (
    <div className="space-y-4">
      {/* Smart search bar — sticky */}
      <div className="sticky -top-4 bg-gray-900 pt-4 pb-3 -mx-4 px-4 z-10">
        <SmartSearchBar
          value={searchInput}
          onChange={setSearchInput}
          onParsedRefChange={setParsedRef}
          onSearchResults={setTextSearchResults}
          onSearchingChange={setIsSearching}
          onSubmitReference={handleSubmitReference}
          searchBibleVerses={searchBibleVerses}
          language={settings.language}
          inputRef={searchInputRef}
        />
      </div>

      {/* Currently displaying banner */}
      {textState.contentType === "bible" && textState.bibleContext && (
        <button
          onClick={handleViewCurrentVerses}
          className="w-full text-left bg-blue-900/30 border border-blue-700 rounded-lg p-4 hover:bg-blue-900/50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-blue-400 mb-0.5">
                {t.bible.currentlyLoaded}
              </div>
              <div className="font-semibold">
                {textState.bibleContext.bookName}{" "}
                {textState.bibleContext.chapter}
              </div>
              <div className="text-sm text-gray-400 mt-0.5">
                {t.bible.verse} {textState.currentSlide + 1} {t.hymns.of}{" "}
                {textState.slides.length}
              </div>
            </div>
            <span className="text-sm text-blue-400 hover:text-blue-300">
              {t.bible.viewVerses} →
            </span>
          </div>
        </button>
      )}

      {/* Non-Bible content indicator */}
      {textState.contentType !== "bible" && textState.slides.length > 0 && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
          <div className="text-sm text-blue-400 mb-1">
            {t.hymns.nowDisplaying}
          </div>
          <div className="font-semibold">{textState.title}</div>
          <div className="text-sm text-gray-400 mt-1">
            {t.hymns.slide} {textState.currentSlide + 1} {t.hymns.of}{" "}
            {textState.slides.length}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => setActiveTab("results")}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === "results"
              ? "bg-gray-700 text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {t.bible.searchResults}
        </button>
        <button
          onClick={() => setActiveTab("browse")}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === "browse"
              ? "bg-gray-700 text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {t.bible.browse}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "results" ? (
        <SearchResultsTab
          searchInput={searchInput}
          parsedRef={validatedParsedRef}
          invalidRef={parsedRef !== null && validatedParsedRef === null}
          textSearchResults={textSearchResults}
          isSearching={isSearching}
          onSelectReference={handleSearchResultClick}
          onGoReference={handleSubmitReference}
          language={settings.language}
        />
      ) : (
        <BrowseTab
          books={books}
          selectedBook={browseBook}
          selectedChapter={browseChapter}
          onSelectBook={(book) => {
            setBrowseBook(book);
            setBrowseChapter(1);
          }}
          onSelectChapter={setBrowseChapter}
          onGo={handleBrowseGo}
          language={settings.language}
        />
      )}
    </div>
  );
}
