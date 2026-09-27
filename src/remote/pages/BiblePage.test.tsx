import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_SETTINGS, DEFAULT_STATE, type BibleVerse } from "../../shared/types";
import { sendPageIntent } from "../hooks/usePageIntent";
import BiblePage from "./BiblePage";

const verses: BibleVerse[] = Array.from({ length: 36 }, (_, i) => ({ chapter: 3, verse: i + 1, text: `Verse ${i + 1}` }));

function setup() {
  const { container } = render(
    <BiblePage
      textState={DEFAULT_STATE.text}
      isIdle
      getBibleBooks={async () => [{ id: "JHN", name: "Ioan", chapterCount: 21 }]}
      getBibleChapter={async () => verses}
      loadBibleVerses={vi.fn()}
      searchBibleVerses={async () => []}
      goToSlide={vi.fn()}
      settings={{ ...DEFAULT_SETTINGS, language: "ro" }}
    />
  );
  const highlighted = () =>
    [...container.querySelectorAll('[data-highlight="true"]')].map((el) =>
      parseInt(el.textContent ?? "", 10)
    );
  return { highlighted };
}

/** The search history, as the page stores it. */
const history = () =>
  JSON.parse(localStorage.getItem("bishub-bible-search-history") ?? "[]") as {
    verse: number;
    endVerse?: number;
    query: string;
  }[];

// Quick Search and the page's own search must land on the same thing.
describe("BiblePage opening a range", () => {
  it("highlights it when typed into the page's search", async () => {
    const { highlighted } = setup();
    // Books arrive async; the reference only validates once they have.
    await act(async () => {});
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "ioan 3:16-18" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await screen.findByText("Ioan 3");
    expect(highlighted()).toEqual([16, 17, 18]);
    expect(history()[0]).toMatchObject({ verse: 16, endVerse: 18, query: "ioan 3:16-18" });
  });

  it("highlights it when sent from Quick Search", async () => {
    const { highlighted } = setup();
    act(() =>
      sendPageIntent({
        page: "bible",
        open: { bookId: "JHN", bookName: "Ioan", chapter: 3, verse: 16, endVerse: 18 },
        query: "ioan 3:16-18",
      })
    );

    await screen.findByText("Ioan 3");
    expect(highlighted()).toEqual([16, 17, 18]);
    expect(history()[0]).toMatchObject({ verse: 16, endVerse: 18, query: "ioan 3:16-18" });
  });

  it("reopens a range from the search history", async () => {
    localStorage.setItem(
      "bishub-bible-search-history",
      JSON.stringify([
        { id: "a", bookId: "JHN", bookName: "Ioan", chapter: 3, verse: 16, endVerse: 18, query: "ioan 3:16-18", timestamp: 0 },
      ])
    );
    const { highlighted } = setup();
    fireEvent.click(await screen.findByText("Ioan 3:16-18"));

    await screen.findByText("Ioan 3");
    expect(highlighted()).toEqual([16, 17, 18]);
  });
});
