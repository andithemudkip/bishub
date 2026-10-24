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

describe("QuickSearch syntax", () => {
  const empty = (q: string): QuickSearchResponse => ({ query: q, groups: [], versesFollow: false });
  const pill = (name: string) => screen.getByRole("button", { name, pressed: true });

  it("turns a typed scope prefix into its pill and searches with it", async () => {
    const actions = actionsFor(empty);
    mount("", actions);
    const input = screen.getByRole("textbox") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "b:" } });
    expect(input.value).toBe("");
    expect(screen.getByRole("button", { name: t.quickSearch.scopeRemove })).toBeTruthy();
    expect(pill(t.quickSearch.groupBible)).toBeTruthy();

    fireEvent.change(input, { target: { value: "har" } });
    await vi.waitFor(() => expect(actions.search).toHaveBeenCalledWith("b: har"));
  });

  it("sets the scope from a pill, and Backspace in an empty box clears it", async () => {
    const actions = actionsFor(empty);
    mount("", actions);
    fireEvent.click(screen.getByRole("button", { name: t.quickSearch.groupHymns }));
    expect(pill(t.quickSearch.groupHymns)).toBeTruthy();

    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(pill(t.quickSearch.scopeAll)).toBeTruthy();
  });

  it("removes the scope from its chip", () => {
    mount("", actionsFor(empty));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "m:" } });
    fireEvent.click(screen.getByRole("button", { name: t.quickSearch.scopeRemove }));
    expect(screen.queryByRole("button", { name: t.quickSearch.scopeRemove })).toBeNull();
    expect(pill(t.quickSearch.scopeAll)).toBeTruthy();
  });

  it("leaves a book filter in the text", () => {
    mount("", actionsFor(empty));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "ioan: paine" } });
    expect(input.value).toBe("ioan: paine");
    expect(pill(t.quickSearch.scopeAll)).toBeTruthy();
  });

  it("says how a filter was read", async () => {
    mount(
      "ioan 6: paine",
      actionsFor((q) => ({
        ...empty(q),
        versesFollow: true,
        filter: { bookName: "Ioan", chapter: 6, text: "paine" },
      }))
    );
    expect(await screen.findByText("Ioan · ch. 6 · “paine”")).toBeTruthy();
  });

  it("asks for a word when a filter alone found nothing to list", async () => {
    mount(":18", actionsFor((q) => ({ ...empty(q), filter: { startVerse: 18, endVerse: 18, text: "" } })));
    expect(await screen.findByText(t.quickSearch.filterNeedsWords)).toBeTruthy();
    expect(screen.queryByText(t.quickSearch.noResults)).toBeNull();
  });

  it("rewrites the query when the book suggestion is picked", async () => {
    const actions = actionsFor((q) =>
      q === "ioan paine"
        ? { ...empty(q), versesFollow: true, suggestion: { bookName: "Ioan", query: "ioan: paine" } }
        : empty(q)
    );
    mount("ioan paine", actions);
    fireEvent.click(await screen.findByText("Search only in Ioan"));
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("ioan: paine");
    await vi.waitFor(() => expect(actions.search).toHaveBeenCalledWith("ioan: paine"));
  });

  it("fills in an example when it's picked, scope and all", () => {
    mount("", actionsFor(empty));
    fireEvent.click(screen.getByText("b: grace"));
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("grace");
    expect(pill(t.quickSearch.groupBible)).toBeTruthy();
  });
});

describe("QuickSearch filter highlight", () => {
  // The server reports where it read "ioan 6:"; here, always at the start.
  const withFilter = (q: string): QuickSearchResponse => ({
    query: q,
    groups: [],
    versesFollow: false,
    filter: { bookName: "Ioan", chapter: 6, text: "paine", range: [0, 7] },
  });
  const marked = () => document.querySelector("mark")?.textContent ?? null;

  it("highlights the part of the box a filter was read from", async () => {
    mount("ioan 6: paine", actionsFor(withFilter));
    await vi.waitFor(() => expect(marked()).toBe("ioan 6:"));
  });

  it("stays while typing elsewhere, and goes when the filter is edited", async () => {
    mount("ioan 6: paine", actionsFor(withFilter));
    await vi.waitFor(() => expect(marked()).toBe("ioan 6:"));
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "ioan 6: painea" } });
    expect(marked()).toBe("ioan 6:");

    // Checked before the reply for the new text lands.
    fireEvent.change(input, { target: { value: "ioan 7: painea" } });
    expect(marked()).toBeNull();
    fireEvent.change(input, { target: { value: "ioan 66: painea" } });
    expect(marked()).toBeNull();
  });

  it("lines up with the box when a scope chip is on", async () => {
    // Sent as "b: ioan 6: paine", so the server's range starts after the prefix.
    const actions = actionsFor((q) => ({ ...withFilter(q), filter: { ...withFilter(q).filter!, range: [3, 10] } }));
    mount("", actions);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "b:" } });
    fireEvent.change(input, { target: { value: "ioan 6: paine" } });
    await vi.waitFor(() => expect(marked()).toBe("ioan 6:"));
  });

  it("leaves a plain search as an ordinary input", async () => {
    const actions = actionsFor((q) => ({ query: q, groups: [], versesFollow: true }));
    mount("ioan paine", actions);
    await vi.waitFor(() => expect(actions.search).toHaveBeenCalled());
    expect(marked()).toBeNull();
    expect(screen.getByRole("textbox").className).not.toContain("text-transparent");
  });
});
