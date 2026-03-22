import { useState, useMemo } from "react";
import { getTranslations } from "../../../shared/i18n";
import { normalizeForSearch } from "../../../shared/utils";
import type { Language } from "../../../shared/i18n";
import type { BibleBook } from "../../pages/BiblePage";

interface Props {
  books: BibleBook[];
  selectedBook: BibleBook | null;
  selectedChapter: number;
  onSelectBook: (book: BibleBook) => void;
  onSelectChapter: (chapter: number) => void;
  onGo: () => void;
  language: Language;
}

export default function BrowseTab({
  books,
  selectedBook,
  selectedChapter,
  onSelectBook,
  onSelectChapter,
  onGo,
  language,
}: Props) {
  const [bookFilter, setBookFilter] = useState("");
  const t = getTranslations(language);

  const otBooks = books.slice(0, 39);
  const ntBooks = books.slice(39);

  const normalizedFilter = useMemo(
    () => normalizeForSearch(bookFilter),
    [bookFilter]
  );

  const filterBooks = (list: BibleBook[]) => {
    if (!normalizedFilter) return list;
    return list.filter((b) =>
      normalizeForSearch(b.name).includes(normalizedFilter)
    );
  };

  const filteredOT = filterBooks(otBooks);
  const filteredNT = filterBooks(ntBooks);

  const renderBookGrid = (books: BibleBook[], label: string) => {
    if (books.length === 0) return null;
    return (
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          {label}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
          {books.map((book) => (
            <button
              key={book.id}
              onClick={() => {
                onSelectBook(book);
                setBookFilter("");
              }}
              className={`px-2 py-1.5 text-sm rounded-md transition-colors text-left truncate ${
                selectedBook?.id === book.id
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 hover:bg-gray-600 text-gray-200"
              }`}
            >
              {book.name}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Book filter */}
      <div className="relative">
        <input
          type="text"
          value={bookFilter}
          onChange={(e) => setBookFilter(e.target.value)}
          placeholder={t.bible.filterBooks}
          className="w-full px-4 py-2.5 bg-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
        {bookFilter && (
          <button
            onClick={() => setBookFilter("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {/* Book grids */}
      {renderBookGrid(filteredOT, t.bible.oldTestament)}
      {renderBookGrid(filteredNT, t.bible.newTestament)}

      {filteredOT.length === 0 && filteredNT.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">
          {t.bible.noSearchResults} &quot;{bookFilter}&quot;
        </p>
      )}

      {/* Chapter grid */}
      {selectedBook && (
        <div>
          <h3 className="text-sm text-gray-400 mb-2">
            {t.bible.chapter} — {selectedBook.name}
          </h3>
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
            {Array.from(
              { length: selectedBook.chapterCount },
              (_, i) => i + 1
            ).map((ch) => (
              <button
                key={ch}
                onClick={() => onSelectChapter(ch)}
                className={`py-2 text-sm rounded-md transition-colors ${
                  selectedChapter === ch
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 hover:bg-gray-600 text-gray-200"
                }`}
              >
                {ch}
              </button>
            ))}
          </div>

          {/* Go button */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-gray-400">
              {selectedBook.name} {selectedChapter}
            </span>
            <button
              onClick={onGo}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors font-medium"
            >
              {t.bible.go}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
