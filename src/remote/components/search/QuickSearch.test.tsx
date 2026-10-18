import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { getTranslations } from "../../../shared/i18n";
import type { QuickSearchHit, QuickSearchResponse } from "../../../shared/quickSearch.types";
import { usePageIntent, type PageIntent } from "../../hooks/usePageIntent";
import { QuickSearch, type QuickSearchActions } from "./QuickSearch";

const t = getTranslations("en");

function actionsFor(
  search: (q: string) => QuickSearchResponse | Promise<QuickSearchResponse>,
  searchVerses: (q: string) => QuickSearchResponse | Promise<QuickSearchResponse> = (q) => ({
    query: q,
    groups: [],
    versesFollow: false,
  })
) {
  return {
    search: vi.fn(async (q: string) => search(q)),
    searchVerses: vi.fn(async (q: string) => searchVerses(q)),
    loadHymn: vi.fn(),
    loadVideo: vi.fn(),
    playVideo: vi.fn(),
    loadAudio: vi.fn(),
    playAudio: vi.fn(),
    loadImage: vi.fn(),
    playAudioPlaylist: vi.fn(),
  } satisfies QuickSearchActions;
}

function setup(query: string, hit: QuickSearchHit) {
  // Text matches come from the second request, as from the main process.
  const group = (q: string, kind: "reference" | "bible") => ({
    query: q,
    groups: [{ kind, hits: [hit], more: 0 }],
    versesFollow: false,
  });
  const actions =
    hit.kind === "verse"
      ? actionsFor(
          (q) => ({ query: q, groups: [], versesFollow: true }),
          (q) => group(q, "bible")
        )
      : actionsFor((q) => group(q, "reference"));
  return { ...mount(query, actions), actions };
}

function mount(query: string, actions: QuickSearchActions) {
  const onNavigate = vi.fn();
  const onClose = vi.fn();
  render(
    <QuickSearch
      open
      initialQuery={query}
      onClose={onClose}
      onNavigate={onNavigate}
      actions={actions}
      t={t}
    />
  );
  return { onNavigate, onClose };
}

/** What the Bible page would receive on mounting. */
function receivedIntent() {
  const handler = vi.fn<(intent: PageIntent) => void>();
  renderHook(() => usePageIntent("bible", handler));
  return handler.mock.calls[0]?.[0];
}

const reference: QuickSearchHit = {
  kind: "reference",
  bookId: "JHN",
  bookName: "Ioan",
  chapter: 3,
  startVerse: 16,
  endVerse: 16,
  verseGiven: true,
};

const range: QuickSearchHit = { ...reference, endVerse: 18 };

const verse: QuickSearchHit = {
  kind: "verse",
  bookId: "JHN",
  bookName: "Ioan",
  chapter: 3,
  verse: 16,
  text: "Fiindcă atât de mult a iubit Dumnezeu lumea",
};

describe("QuickSearch Bible hits", () => {
  it.each([
    ["a reference", "ioan 3:16", reference, "Enter", 16],
    ["a range", "ioan 3:16-18", range, "Enter", 18],
    ["a verse found by its text", "atat de mult a iubit", verse, "Enter", 16],
    ["a reference", "ioan 3:16", reference, "Shift+Enter", 16],
  ] as const)(
    "%s opens the chapter on it without presenting it (%s)",
    async (_, query, hit, key, endVerse) => {
      const { actions, onNavigate, onClose } = setup(query, hit);
      await screen.findByText(/Ioan 3/);

      fireEvent.keyDown(screen.getByRole("textbox"), {
        key: "Enter",
        shiftKey: key === "Shift+Enter",
      });

      // Presenting is left to a second Enter on the Bible page, once the
      // verse has been checked against what the speaker said.
      for (const [name, fn] of Object.entries(actions)) {
        if (!name.startsWith("search")) expect(fn, name).not.toHaveBeenCalled();
      }
      expect(onNavigate).toHaveBeenCalledWith("bible");
      expect(onClose).toHaveBeenCalled();
      expect(receivedIntent()).toEqual({
        page: "bible",
        open: { bookId: "JHN", bookName: "Ioan", chapter: 3, verse: 16, endVerse },
        query,
      });
    }
  );

  it("says Enter opens the chapter while a Bible hit is selected", async () => {
    setup("ioan 3:16", reference);
    await screen.findByText(/Ioan 3/);
    expect(screen.getByText(t.quickSearch.hintOpenChapter)).toBeTruthy();
    expect(screen.queryByText(t.quickSearch.hintShow)).toBeNull();
  });
});

const unfinishedRefMatch: QuickSearchHit = {
  kind: "verse",
  bookId: "2KI",
  bookName: "2 Împărați",
  chapter: 23,
  verse: 31,
  text: "Mama lui se numea Hamutal, fata lui Ieremia",
};

const jeremiah: QuickSearchHit = {
  kind: "reference",
  bookId: "JER",
  bookName: "Ieremia",
  chapter: 18,
  startVerse: 1,
  endVerse: 1,
  verseGiven: true,
};

describe("QuickSearch timing", () => {
  it("adds Bible text below what's already shown when it arrives", async () => {
    let releaseVerses!: () => void;
    const versesHeld = new Promise<void>((resolve) => (releaseVerses = resolve));
    const actions = actionsFor(
      (q) => ({ query: q, groups: [{ kind: "reference", hits: [jeremiah], more: 0 }], versesFollow: true }),
      async (q) => {
        await versesHeld;
        return { query: q, groups: [{ kind: "bible", hits: [unfinishedRefMatch], more: 0 }], versesFollow: false };
      }
    );
    mount("ieremia", actions);

    await screen.findByText("Ieremia 18:1");
    expect(screen.queryByText(/2 Împărați/)).toBeNull();
    releaseVerses();
    await screen.findByText("2 Împărați 23:31");
    const rows = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(rows[0]).toContain("Ieremia 18:1");
  });

  it("an Enter that beats the results acts on the results for what's typed", async () => {
    // "ieremia 18:1" answers slowly; the text match for the unfinished
    // reference is still on screen when Enter lands.
    let releaseReference!: () => void;
    const referenceHeld = new Promise<void>((resolve) => (releaseReference = resolve));
    const actions = actionsFor(
      async (q) => {
        if (q !== "ieremia 18:") await referenceHeld;
        return q === "ieremia 18:"
          ? { query: q, groups: [], versesFollow: true }
          : { query: q, groups: [{ kind: "reference", hits: [jeremiah], more: 0 }], versesFollow: false };
      },
      (q) => ({ query: q, groups: [{ kind: "bible", hits: [unfinishedRefMatch], more: 0 }], versesFollow: false })
    );
    const { onNavigate } = mount("ieremia 18:", actions);
    await screen.findByText("2 Împărați 23:31");

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "ieremia 18:1" } });
    fireEvent.keyDown(input, { key: "Enter" });
    // Sent at once rather than after the debounce.
    expect(actions.search).toHaveBeenLastCalledWith("ieremia 18:1");
    expect(onNavigate).not.toHaveBeenCalled();

    await act(async () => releaseReference());
    expect(onNavigate).toHaveBeenCalledWith("bible");
    expect(receivedIntent()).toMatchObject({ open: { bookId: "JER", chapter: 18, verse: 1 } });
    expect(actions.search).toHaveBeenCalledTimes(2);
  });

  it("waits for Bible text when nothing else matched", async () => {
    const actions = actionsFor(
      (q) => ({ query: q, groups: [], versesFollow: true }),
      (q) => ({ query: q, groups: [{ kind: "bible", hits: [unfinishedRefMatch], more: 0 }], versesFollow: false })
    );
    const { onNavigate } = mount("", actions);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "hamutal" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await vi.waitFor(() => expect(onNavigate).toHaveBeenCalledWith("bible"));
    expect(receivedIntent()).toMatchObject({ open: { bookId: "2KI", chapter: 23, verse: 31 } });
  });
});
