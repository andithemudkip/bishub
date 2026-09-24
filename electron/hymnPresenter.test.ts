import { beforeEach, describe, expect, it, vi } from "vitest";
import { deepFreeze } from "../test/helpers";
import { getTranslations } from "../src/shared/i18n";
import { BUNDLED_HYMNALS } from "../src/shared/hymnals";
import type { AppSettings, Hymn, HymnAudioAvailability } from "../src/shared/types";
import type { StateManager } from "./state";
import { formatHymnForDisplay, getHymnByNumber, loadHymns } from "./dataLoader";
import { getHymnalBySlug } from "./hymnalRegistry";
import { presentHymn, resolveHymnalSlug } from "./hymnPresenter";

// Karaoke assets live on disk and the network in the app; here each test
// decides what's "on hand" for the hymn being presented.
const assets = vi.hoisted(() => ({
  availability: "none" as HymnAudioAvailability,
  ttml: null as string | null,
}));

vi.mock("./hymnAssets", () => ({
  getHymnAudioAvailability: () => assets.availability,
  getMP3Path: (n: string) => (assets.availability === "cached" ? `/cache/${n}.mp3` : null),
  getHymnTTMLContent: () => assets.ttml,
  hasSyncedLyrics: () => assets.ttml !== null,
  downloadMP3: vi.fn(() => Promise.resolve()),
}));

const { downloadMP3 } = vi.mocked(await import("./hymnAssets"));

const KARAOKE_BOOK = "imnuri-crestine";
const PLAIN_BOOK = "alte-imnuri";
const TTML = `<tt><body dur="0:10"><div><p><span begin="0:01" end="0:02">Plecați</span></p></div></body></tt>`;

const ro = getTranslations("ro");
const en = getTranslations("en");

function hymn(blocks: Hymn["blocks"], sequence: number[]): Hymn {
  return deepFreeze({ number: "7", title: "Test", blocks, sequence });
}

const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n");

describe("formatHymnForDisplay", () => {
  it("titles the hymn with its number", () => {
    expect(formatHymnForDisplay(hymn([{ kind: "verse", text: "a" }], [0])).title).toBe("7. Test");
  });

  it("numbers verses by position among verses and prefixes every chorus", () => {
    const h = hymn(
      [
        { kind: "verse", text: "V1" },
        { kind: "chorus", text: "C" },
        { kind: "verse", text: "V2" },
      ],
      [0, 1, 2, 1]
    );
    expect(formatHymnForDisplay(h, "ro").slides).toEqual([
      "1. V1",
      `${ro.hymns.chorusPrefix}: C`,
      "2. V2",
      `${ro.hymns.chorusPrefix}: C`,
    ]);
    expect(formatHymnForDisplay(h, "en").slides[1]).toBe(`${en.hymns.chorusPrefix}: C`);
  });

  it("keeps a repeated verse's own number", () => {
    const h = hymn(
      [
        { kind: "verse", text: "V1" },
        { kind: "verse", text: "V2" },
      ],
      [0, 1, 0]
    );
    expect(formatHymnForDisplay(h).slides).toEqual(["1. V1", "2. V2", "1. V1"]);
  });

  it("shows a bridge without a number or prefix", () => {
    const h = hymn(
      [
        { kind: "verse", text: "V1" },
        { kind: "bridge", text: "B" },
      ],
      [0, 1]
    );
    expect(formatHymnForDisplay(h).slides).toEqual(["1. V1", "B"]);
  });

  it("skips sequence entries that point past the blocks", () => {
    expect(formatHymnForDisplay(hymn([{ kind: "verse", text: "V" }], [0, 5])).slides).toEqual(["1. V"]);
  });

  it("returns no slides for an empty sequence", () => {
    expect(formatHymnForDisplay(hymn([{ kind: "verse", text: "V" }], [])).slides).toEqual([]);
  });

  // The "1. " / "R: " prefix sits on the first line, so the counts below are
  // lines of the finished slide.
  it.each([
    [7, [7]],
    [8, [4, 4]],
    [9, [5, 4]],
    [12, [6, 6]],
  ])("splits a %i-line stanza into slides of %j lines", (count, expected) => {
    const slides = formatHymnForDisplay(hymn([{ kind: "bridge", text: lines(count) }], [0])).slides;
    expect(slides.map((s) => s.split("\n").length)).toEqual(expected);
    expect(slides.join("\n")).toBe(lines(count));
  });

  it("counts CRLF line breaks when deciding to split", () => {
    const crlf = lines(8).replace(/\n/g, "\r\n");
    expect(formatHymnForDisplay(hymn([{ kind: "bridge", text: crlf }], [0])).slides).toHaveLength(2);
  });

  it("splits a long chorus every time it recurs", () => {
    const h = hymn(
      [
        { kind: "verse", text: "V1" },
        { kind: "chorus", text: lines(8) },
      ],
      [1, 0, 1]
    );
    expect(formatHymnForDisplay(h).slides).toHaveLength(5);
  });

  it("gives every bundled hymn a non-empty slide per sequence entry", () => {
    for (const { slug } of BUNDLED_HYMNALS) {
      for (const h of loadHymns(slug)) {
        const { slides } = formatHymnForDisplay(h);
        expect(slides.length, `${slug} ${h.number}`).toBeGreaterThanOrEqual(h.sequence.length);
        expect(slides.every((s) => s.trim().length > 0), `${slug} ${h.number}`).toBe(true);
      }
    }
  });
});

// ── Presenting ───────────────────────────────────────────────────────────────

function fakeState(settings: Partial<AppSettings> = {}) {
  const state = {
    getSettings: () => ({
      language: "ro",
      hymnal: KARAOKE_BOOK,
      syncedLyrics: true,
      instrumentals: true,
      ...settings,
    }),
    loadSyncedHymn: vi.fn(),
    loadInstrumentalHymn: vi.fn(),
    loadText: vi.fn(),
  };
  return { state, manager: state as unknown as StateManager };
}

function shown(state: ReturnType<typeof fakeState>["state"]) {
  if (state.loadSyncedHymn.mock.calls.length) return "synced";
  if (state.loadInstrumentalHymn.mock.calls.length) return "instrumental";
  if (state.loadText.mock.calls.length) return "static";
  return "nothing";
}

beforeEach(() => {
  assets.availability = "none";
  assets.ttml = null;
  downloadMP3.mockClear();
});

describe("presentHymn", () => {
  const expectedTitle = () => `1. ${getHymnByNumber("1", KARAOKE_BOOK)!.title}`;

  it.each([
    // availability, has TTML, synced setting, instrumentals setting → result
    ["cached", true, true, true, "synced"],
    ["cached", true, false, true, "instrumental"],
    ["cached", false, true, true, "instrumental"],
    ["cached", false, true, false, "static"],
    ["cached", true, false, false, "static"],
    ["downloadable", true, true, true, "static"],
    ["none", true, true, true, "static"],
  ] as const)(
    "with the MP3 %s, TTML %s, synced %s and instrumentals %s, shows %s",
    (availability, hasTtml, syncedLyrics, instrumentals, expected) => {
      assets.availability = availability;
      assets.ttml = hasTtml ? TTML : null;
      const { state, manager } = fakeState({ syncedLyrics, instrumentals });
      presentHymn(manager, KARAOKE_BOOK, "1");
      expect(shown(state)).toBe(expected);
    }
  );

  it("passes title, slides, timing and audio through to karaoke playback", () => {
    assets.availability = "cached";
    assets.ttml = TTML;
    const { state, manager } = fakeState();
    presentHymn(manager, KARAOKE_BOOK, "1");

    const [title, slides, ttml, audioPath, ref] = state.loadSyncedHymn.mock.calls[0];
    expect(title).toBe(expectedTitle());
    expect(slides.length).toBeGreaterThan(0);
    expect(ttml.lines[0].words[0].text).toBe("Plecați");
    expect(audioPath).toBe("/cache/1.mp3");
    expect(ref).toEqual({ book: KARAOKE_BOOK, number: "1" });
  });

  it("loads plain slides as hymn text joined by blank lines", () => {
    const { state, manager } = fakeState({ syncedLyrics: false, instrumentals: false });
    presentHymn(manager, KARAOKE_BOOK, "1");

    const [title, content, type, ref] = state.loadText.mock.calls[0];
    const h = getHymnByNumber("1", KARAOKE_BOOK)!;
    expect(title).toBe(expectedTitle());
    expect(content).toBe(formatHymnForDisplay(h).slides.join("\n\n"));
    expect(type).toBe("hymn");
    expect(ref).toEqual({ book: KARAOKE_BOOK, number: "1" });
  });

  it("starts the MP3 download for next time when it could have played", () => {
    assets.availability = "downloadable";
    presentHymn(fakeState().manager, KARAOKE_BOOK, "1");
    expect(downloadMP3).toHaveBeenCalledWith("1");
  });

  it("doesn't download audio the operator has turned off", () => {
    assets.availability = "downloadable";
    presentHymn(fakeState({ syncedLyrics: false, instrumentals: false }).manager, KARAOKE_BOOK, "1");
    expect(downloadMP3).not.toHaveBeenCalled();
  });

  it("never looks for karaoke audio outside the karaoke book", () => {
    // MP3s are keyed by bare hymn number, so another book's "1" would get
    // the karaoke book's hymn 1 audio.
    assets.availability = "cached";
    assets.ttml = TTML;
    const { state, manager } = fakeState();
    presentHymn(manager, PLAIN_BOOK, loadHymns(PLAIN_BOOK)[0].number);
    expect(shown(state)).toBe("static");
    expect(getHymnalBySlug(PLAIN_BOOK)?.karaoke).toBeFalsy();
  });

  it("does nothing for a hymn the book doesn't have", () => {
    const { state, manager } = fakeState();
    presentHymn(manager, KARAOKE_BOOK, "99999");
    expect(shown(state)).toBe("nothing");
  });

  describe("playback mode override", () => {
    beforeEach(() => {
      assets.availability = "cached";
      assets.ttml = TTML;
    });

    it.each([
      ["synced", { syncedLyrics: false, instrumentals: false }, "synced"],
      ["instrumental", { syncedLyrics: true, instrumentals: false }, "instrumental"],
      ["static", { syncedLyrics: true, instrumentals: true }, "static"],
      ["auto", { syncedLyrics: false, instrumentals: true }, "instrumental"],
    ] as const)("%s ignores the settings %j and shows %s", (mode, settings, expected) => {
      const { state, manager } = fakeState(settings);
      presentHymn(manager, KARAOKE_BOOK, "1", mode);
      expect(shown(state)).toBe(expected);
    });

    it.each([
      [null],
      [undefined],
      ["karaoke"],
      ["__proto__"],
      ["toString"],
    ])("treats %j as auto", (mode) => {
      // Web remotes send an omitted argument as null, and anything off the
      // wire is untrusted.
      const { state, manager } = fakeState({ syncedLyrics: false, instrumentals: true });
      presentHymn(manager, KARAOKE_BOOK, "1", mode as never);
      expect(shown(state)).toBe("instrumental");
    });
  });
});

describe("resolveHymnalSlug", () => {
  it("uses an explicit slug when it's a real book", () => {
    expect(resolveHymnalSlug(fakeState().manager, PLAIN_BOOK)).toBe(PLAIN_BOOK);
  });

  it.each([["../../etc/passwd"], ["nope"], [""], [undefined]])(
    "falls back to the remembered book for %j",
    (slug) => {
      expect(resolveHymnalSlug(fakeState({ hymnal: PLAIN_BOOK }).manager, slug)).toBe(PLAIN_BOOK);
    }
  );

  it.each(["ro", "en"] as const)(
    "falls back to a %s book when the remembered one is gone",
    (language) => {
      const slug = resolveHymnalSlug(fakeState({ hymnal: "deleted-book", language }).manager);
      expect(getHymnalBySlug(slug)?.language).toBe(language);
    }
  );
});
