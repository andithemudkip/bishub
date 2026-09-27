import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { DEFAULT_STATE, type BibleVerse, type TextState } from "../../../shared/types";
import VerseListView, { type VerseListContext } from "./VerseListView";

const verses: BibleVerse[] = Array.from({ length: 20 }, (_, i) => ({ chapter: 3, verse: i + 1, text: `Verse ${i + 1}` }));

const context: VerseListContext = {
  bookId: "JHN",
  bookName: "Ioan",
  chapter: 3,
  verses,
  highlightVerse: 16,
  highlightEnd: 18,
};

/** The display state with this chapter loaded, as the main process sets it. */
const chapterLoaded: TextState = {
  ...DEFAULT_STATE.text,
  contentType: "bible",
  slides: verses.map((v) => v.text),
  currentSlide: 2,
  bibleContext: { bookId: "JHN", bookName: "Ioan", chapter: 3, verses },
};

function setup({ textState = DEFAULT_STATE.text, isIdle = true } = {}) {
  const loadBibleVerses = vi.fn();
  const goToSlide = vi.fn();
  const onBack = vi.fn();
  const { container } = render(
    <VerseListView
      context={context}
      textState={textState}
      isIdle={isIdle}
      loadBibleVerses={loadBibleVerses}
      goToSlide={goToSlide}
      onBack={onBack}
      chapterCount={21}
      onSelectChapter={vi.fn()}
      language="en"
    />
  );
  const highlighted = () =>
    [...container.querySelectorAll('[data-highlight="true"]')].map((el) =>
      parseInt(el.textContent ?? "", 10)
    );
  return { loadBibleVerses, goToSlide, onBack, highlighted };
}

const pressEnter = () => fireEvent.keyDown(window, { key: "Enter" });

describe("VerseListView", () => {
  it("highlights every verse of a searched range", () => {
    expect(setup().highlighted()).toEqual([16, 17, 18]);
  });

  it("presents from the first highlighted verse on Enter", () => {
    const { loadBibleVerses, goToSlide } = setup();
    pressEnter();
    expect(loadBibleVerses).toHaveBeenCalledWith("JHN", "Ioan", 3, 16);
    expect(goToSlide).not.toHaveBeenCalled();
  });

  it("jumps to the verse's slide on Enter when the chapter is already live", () => {
    const { loadBibleVerses, goToSlide } = setup({ textState: chapterLoaded, isIdle: false });
    pressEnter();
    expect(goToSlide).toHaveBeenCalledWith(15);
    expect(loadBibleVerses).not.toHaveBeenCalled();
  });

  it("reloads on Enter when the chapter is loaded but the display is idle", () => {
    const { loadBibleVerses, goToSlide } = setup({ textState: chapterLoaded, isIdle: true });
    pressEnter();
    expect(loadBibleVerses).toHaveBeenCalledWith("JHN", "Ioan", 3, 16);
    expect(goToSlide).not.toHaveBeenCalled();
  });

  describe("Escape", () => {
    /** Stands in for the app's global goIdle shortcut, which listens after. */
    function pressEscape() {
      const goIdle = vi.fn();
      window.addEventListener("keydown", goIdle);
      fireEvent.keyDown(window, { key: "Escape" });
      window.removeEventListener("keydown", goIdle);
      return goIdle;
    }

    it("goes idle first while something is showing", () => {
      const { onBack } = setup({ textState: chapterLoaded, isIdle: false });
      expect(pressEscape()).toHaveBeenCalled();
      expect(onBack).not.toHaveBeenCalled();
    });

    it("goes back once the display is idle", () => {
      const { onBack } = setup({ isIdle: true });
      expect(pressEscape()).not.toHaveBeenCalled();
      expect(onBack).toHaveBeenCalled();
    });
  });
});
