import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BUNDLED_HYMNALS } from "../../shared/hymnals";
import { DEFAULT_SETTINGS, DEFAULT_STATE, type Hymn } from "../../shared/types";
import HymnsPage from "./HymnsPage";

const hymn: Hymn = {
  number: "12",
  title: "Test",
  blocks: [{ kind: "verse", text: "a" }],
  sequence: [0],
};

// The browsed book belongs to this remote alone, so the page must work from it
// and never from the shared default in settings.
function setup(defaultHymnal: string, hymnal: string) {
  const onLoadHymn = vi.fn();
  render(
    <HymnsPage
      allHymnals={BUNDLED_HYMNALS}
      textState={DEFAULT_STATE.text}
      isTextMode={false}
      hymns={[hymn]}
      hymnal={hymnal}
      hymnsSlug={hymnal}
      onLoadHymn={onLoadHymn}
      onSelectHymnal={vi.fn()}
      onSearchAllHymns={async () => []}
      settings={{ ...DEFAULT_SETTINGS, language: "en", hymnal: defaultHymnal }}
      audioState={DEFAULT_STATE.audio}
      onPlayAudio={vi.fn()}
      onPauseAudio={vi.fn()}
      onSeekAudio={vi.fn()}
      mp3Downloads={[]}
      mp3CacheStats={{ count: 0, sizeBytes: 0, availableCount: 0 }}
      onDownloadHymnMP3={vi.fn()}
      onDismissKaraokeBanner={vi.fn()}
      onOpenKaraokeSettings={vi.fn()}
      isElectron
      onImportPptx={async () => []}
      onCommitHymnImport={async () => ({ ok: false, reason: "write-failed" })}
      onDeleteCustomHymn={async () => false}
    />
  );
  return { onLoadHymn };
}

describe("HymnsPage browsing a book other than the default", () => {
  it("shows the pills for the browsed book's language", () => {
    setup("sda-hymnal", "alte-imnuri");
    expect(screen.getByRole("button", { name: "Altele" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Creștine" })).not.toBeNull();
  });

  it("loads the hymn from the browsed book on Enter", () => {
    const { onLoadHymn } = setup("imnuri-crestine", "alte-imnuri");
    const input = screen.getAllByRole("textbox")[0];
    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onLoadHymn).toHaveBeenCalledWith("alte-imnuri", "12");
  });
});
