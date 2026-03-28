import { useEffect, useRef } from "react";
import type { BibleVerse, TextState } from "../../../shared/types";
import { getTranslations } from "../../../shared/i18n";
import type { Language } from "../../../shared/i18n";
import { useShortcut } from "../../hooks/useShortcut";

interface VerseListContext {
  bookId: string;
  bookName: string;
  chapter: number;
  verses: BibleVerse[];
  highlightVerse: number;
}

interface Props {
  context: VerseListContext;
  textState: TextState;
  isIdle: boolean;
  loadBibleVerses: (
    bookId: string,
    bookName: string,
    chapter: number,
    startVerse: number,
    endVerse?: number
  ) => void;
  goToSlide: (index: number) => void;
  onBack: () => void;
  language: Language;
}

export type { VerseListContext };

export default function VerseListView({
  context,
  textState,
  isIdle,
  loadBibleVerses,
  goToSlide,
  onBack,
  language,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const t = getTranslations(language);

  // Is the display currently showing this exact chapter?
  const isDisplayingThisChapter =
    textState.contentType === "bible" &&
    textState.bibleContext?.bookId === context.bookId &&
    textState.bibleContext?.chapter === context.chapter;

  const initialScrollDone = useRef(false);

  // Auto-scroll to highlight verse on mount/navigation
  useEffect(() => {
    initialScrollDone.current = false;
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector('[data-highlight="true"]');
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      initialScrollDone.current = true;
    });
  }, [context.bookId, context.chapter, context.highlightVerse]);

  // Auto-scroll to current slide when it changes (skip during initial scroll)
  useEffect(() => {
    if (!initialScrollDone.current) return;
    if (isDisplayingThisChapter && listRef.current) {
      const el = listRef.current.querySelector('[data-active="true"]');
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [textState.currentSlide, isDisplayingThisChapter]);

  const handleVerseClick = (index: number) => {
    if (isDisplayingThisChapter && !isIdle) {
      goToSlide(index);
    } else {
      const verse = context.verses[index];
      if (verse) {
        loadBibleVerses(
          context.bookId,
          context.bookName,
          context.chapter,
          verse.verse
        );
      }
    }
  };

  // Enter presents the highlighted verse
  useShortcut(
    ["Enter"],
    () =>
      loadBibleVerses(
        context.bookId,
        context.bookName,
        context.chapter,
        context.highlightVerse
      )
  );

  // Escape goes back (capture phase intercepts before the global goIdle handler)
  useShortcut(
    ["Escape"],
    (e) => {
      e.stopImmediatePropagation();
      onBack();
    },
    { capture: true }
  );

  return (
    <div className="max-w-2xl mx-auto">
      {/* Sticky header with back button */}
      <div className="sticky -top-4 bg-gray-900 pt-4 pb-3 -mx-4 px-4 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-800 transition-colors"
            aria-label={t.bible.back}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="text-xl font-semibold">
            {context.bookName} {context.chapter}
          </h1>
          {isDisplayingThisChapter && !isIdle && (
            <span className="ml-auto text-sm text-gray-400">
              {t.bible.verse} {textState.currentSlide + 1} {t.hymns.of}{" "}
              {textState.slides.length}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1 ml-8">{t.bible.tapToJump}</p>
      </div>

      {/* Verse list */}
      <div ref={listRef} className="space-y-1 pb-4">
        {context.verses.map((verse, index) => {
          const isHighlight = verse.verse === context.highlightVerse;
          const isActive =
            isDisplayingThisChapter &&
            !isIdle &&
            index === textState.currentSlide;

          return (
            <button
              key={verse.verse}
              data-highlight={isHighlight}
              data-active={isActive}
              onClick={() => handleVerseClick(index)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : isHighlight
                    ? "bg-amber-600/40 border border-amber-500/50 text-white"
                    : "bg-gray-800 hover:bg-gray-700 text-gray-200"
              }`}
            >
              <span
                className={`font-bold mr-2 ${
                  isActive
                    ? "text-white"
                    : isHighlight
                      ? "text-amber-300"
                      : "text-blue-400"
                }`}
              >
                {verse.verse}.
              </span>
              <span>{verse.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
