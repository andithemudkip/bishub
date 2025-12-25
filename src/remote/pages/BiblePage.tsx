import { useState, useEffect, useRef } from "react";
import type { BibleVerse, TextState, AppSettings } from "../../shared/types";
import { parseBibleReference } from "../../shared/bibleParser";
import { getTranslations } from "../../shared/i18n";

interface BibleBook {
  id: string;
  name: string;
  chapterCount: number;
}

interface Props {
  textState: TextState;
  getBibleBooks: () => Promise<BibleBook[]>;
  getBibleChapter: (bookId: string, chapter: number) => Promise<BibleVerse[]>;
  loadBibleVerses: (
    bookId: string,
    bookName: string,
    chapter: number,
    startVerse: number,
    endVerse?: number
  ) => void;
  goToSlide: (index: number) => void;
  settings: AppSettings;
}

export default function BiblePage({
  textState,
  getBibleBooks,
  getBibleChapter,
  loadBibleVerses,
  goToSlide,
  settings,
}: Props) {
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [quickSearch, setQuickSearch] = useState("");
  const [parsedRef, setParsedRef] =
    useState<ReturnType<typeof parseBibleReference>>(null);

  // Manual selection state
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [startVerse, setStartVerse] = useState<number>(1);
  const [endVerse, setEndVerse] = useState<number>(1);

  const verseListRef = useRef<HTMLDivElement>(null);

  const t = getTranslations(settings.language);

  useEffect(() => {
    getBibleBooks().then(setBooks);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Parse quick search input with language
  useEffect(() => {
    const parsed = parseBibleReference(quickSearch, settings.language);
    setParsedRef(parsed);
  }, [quickSearch, settings.language]);

  // Load chapter verses when book/chapter changes
  useEffect(() => {
    if (selectedBook && selectedChapter) {
      getBibleChapter(selectedBook.id, selectedChapter).then(
        (v: BibleVerse[]) => {
          setVerses(v);
          setStartVerse(1);
          setEndVerse(v.length > 0 ? v[v.length - 1].verse : 1);
        }
      );
    }
  }, [selectedBook, selectedChapter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to current verse in the list
  useEffect(() => {
    if (textState.bibleContext && verseListRef.current) {
      const activeButton = verseListRef.current.querySelector(
        '[data-active="true"]'
      );
      activeButton?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [textState.currentSlide, textState.bibleContext]);

  const handleQuickLoad = () => {
    if (parsedRef) {
      loadBibleVerses(
        parsedRef.bookId,
        parsedRef.bookName,
        parsedRef.chapter,
        parsedRef.startVerse,
        parsedRef.endVerse
      );
      setQuickSearch("");
    }
  };

  const handleManualLoad = () => {
    if (selectedBook && selectedChapter) {
      loadBibleVerses(
        selectedBook.id,
        selectedBook.name,
        selectedChapter,
        startVerse,
        endVerse
      );
    }
  };

  const handleBookSelect = (book: BibleBook) => {
    setSelectedBook(book);
    setSelectedChapter(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && parsedRef) {
      handleQuickLoad();
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick search */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">{t.bible.quickSearch}</h2>
        <p className="text-sm text-gray-400 mb-3">{t.bible.quickSearchHint}</p>

        <div className="flex gap-2">
          <input
            type="text"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., gen 1:1 or ps 23"
            className="flex-1 px-4 py-3 bg-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleQuickLoad}
            disabled={!parsedRef}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors font-semibold"
          >
            {t.bible.load}
          </button>
        </div>

        {/* Parsed preview */}
        {quickSearch && (
          <div
            className={`mt-3 p-3 rounded-lg ${
              parsedRef
                ? "bg-green-900/30 border border-green-700"
                : "bg-red-900/30 border border-red-700"
            }`}
          >
            {parsedRef ? (
              <span className="text-green-400">
                ✓ {parsedRef.bookName} {parsedRef.chapter}:
                {parsedRef.startVerse}
                {parsedRef.endVerse !== parsedRef.startVerse &&
                  `-${parsedRef.endVerse}`}
              </span>
            ) : (
              <span className="text-red-400">✗ {t.bible.couldNotParse}</span>
            )}
          </div>
        )}
      </div>

      {/* Chapter verse list when Bible is displayed */}
      {textState.contentType === "bible" && textState.bibleContext ? (
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">
              {textState.bibleContext.bookName} {textState.bibleContext.chapter}
            </h2>
            <span className="text-sm text-gray-400">
              {t.bible.verse} {textState.currentSlide + 1} {t.hymns.of}{" "}
              {textState.slides.length}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-3">{t.bible.tapToJump}</p>

          <div
            ref={verseListRef}
            className="max-h-64 sm:max-h-80 overflow-y-auto space-y-1"
          >
            {textState.bibleContext.verses.map((verse, index) => (
              <button
                key={verse.verse}
                data-active={index === textState.currentSlide}
                onClick={() => goToSlide(index)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  index === textState.currentSlide
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 hover:bg-gray-600 text-gray-200"
                }`}
              >
                <span
                  className={`font-bold mr-2 ${
                    index === textState.currentSlide
                      ? "text-white"
                      : "text-blue-400"
                  }`}
                >
                  {verse.verse}.
                </span>
                <span className="line-clamp-2">{verse.text}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        textState.slides.length > 0 && (
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
        )
      )}

      {/* Manual browser */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">{t.bible.browse}</h2>

        <div className="grid gap-4">
          {/* Book selector */}
          <div>
            <label className="text-sm text-gray-400 block mb-2">
              {t.bible.book}
            </label>
            <select
              value={selectedBook?.id || ""}
              onChange={(e) => {
                const book = books.find((b) => b.id === e.target.value);
                if (book) handleBookSelect(book);
              }}
              className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t.bible.selectBook}</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.name}
                </option>
              ))}
            </select>
          </div>

          {/* Chapter and verse selectors */}
          {selectedBook && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-2">
                    {t.bible.chapter}
                  </label>
                  <select
                    value={selectedChapter}
                    onChange={(e) => setSelectedChapter(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from(
                      { length: selectedBook.chapterCount },
                      (_, i) => i + 1
                    ).map((ch) => (
                      <option key={ch} value={ch}>
                        {ch}
                      </option>
                    ))}
                  </select>
                </div>

                {verses.length > 0 && (
                  <>
                    <div>
                      <label className="text-sm text-gray-400 block mb-2">
                        {t.bible.fromVerse}
                      </label>
                      <select
                        value={startVerse}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setStartVerse(v);
                          if (v > endVerse) setEndVerse(v);
                        }}
                        className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {verses.map((v) => (
                          <option key={v.verse} value={v.verse}>
                            {v.verse}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 block mb-2">
                        {t.bible.toVerse}
                      </label>
                      <select
                        value={endVerse}
                        onChange={(e) => setEndVerse(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {verses
                          .filter((v) => v.verse >= startVerse)
                          .map((v) => (
                            <option key={v.verse} value={v.verse}>
                              {v.verse}
                            </option>
                          ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Preview and load */}
              {verses.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-gray-400 text-center sm:text-left">
                    {selectedBook.name} {selectedChapter}:{startVerse}
                    {endVerse !== startVerse && `-${endVerse}`}
                  </div>
                  <button
                    onClick={handleManualLoad}
                    className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors font-medium"
                  >
                    {t.bible.loadVerses}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
