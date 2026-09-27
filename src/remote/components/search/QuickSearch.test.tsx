import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { getTranslations } from "../../../shared/i18n";
import type { QuickSearchHit, QuickSearchResponse } from "../../../shared/quickSearch.types";
import { usePageIntent, type PageIntent } from "../../hooks/usePageIntent";
import { QuickSearch, type QuickSearchActions } from "./QuickSearch";

const t = getTranslations("en");

function setup(query: string, hit: QuickSearchHit) {
  const actions = {
    search: vi.fn(async (q: string): Promise<QuickSearchResponse> => ({
      query: q,
      groups: [{ kind: hit.kind === "verse" ? "bible" : "reference", hits: [hit], more: 0 }],
    })),
    loadHymn: vi.fn(),
    loadVideo: vi.fn(),
    playVideo: vi.fn(),
    loadAudio: vi.fn(),
    playAudio: vi.fn(),
    loadImage: vi.fn(),
    playAudioPlaylist: vi.fn(),
  } satisfies QuickSearchActions;
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
  return { actions, onNavigate, onClose };
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
    ["a reference", "ioan 3:16", reference, "Enter"],
    ["a verse found by its text", "atat de mult a iubit", verse, "Enter"],
    ["a reference", "ioan 3:16", reference, "Shift+Enter"],
  ] as const)(
    "%s opens the chapter on the verse without presenting it (%s)",
    async (_, query, hit, key) => {
      const { actions, onNavigate, onClose } = setup(query, hit);
      await screen.findByText(/Ioan 3/);

      fireEvent.keyDown(screen.getByRole("textbox"), {
        key: "Enter",
        shiftKey: key === "Shift+Enter",
      });

      // Presenting is left to a second Enter on the Bible page, once the
      // verse has been checked against what the speaker said.
      for (const [name, fn] of Object.entries(actions)) {
        if (name !== "search") expect(fn, name).not.toHaveBeenCalled();
      }
      expect(onNavigate).toHaveBeenCalledWith("bible");
      expect(onClose).toHaveBeenCalled();
      expect(receivedIntent()).toEqual({
        page: "bible",
        open: { bookId: "JHN", bookName: "Ioan", chapter: 3, verse: 16 },
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
