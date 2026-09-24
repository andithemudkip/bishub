import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Hymn, BibleSearchResult } from "../src/shared/types";
import type { QuickSearchHit, QuickSearchResponse } from "../src/shared/quickSearch.types";

// Small fixed books and libraries, so each ranking rule can be shown with a
// query that hits exactly the items it's about.

const hymn = (number: string, title: string, lyrics = "", extra: Partial<Hymn> = {}): Hymn => ({
  number,
  title,
  blocks: [{ kind: "verse", text: lyrics || title }],
  sequence: [0],
  ...extra,
});

const data = vi.hoisted(() => ({
  hymnals: [] as { slug: string; shortName: string }[],
  hymns: {} as Record<string, Hymn[]>,
  verses: [] as BibleSearchResult[],
  videos: [] as { id: string; name: string; path: string }[],
  audio: [] as { id: string; name: string; path: string }[],
  playlists: [] as { id: string; name: string; audioIds: string[] }[],
  images: [] as { id: string; name: string; path: string }[],
}));

vi.mock("./hymnalRegistry", () => ({ getHymnals: () => data.hymnals }));
vi.mock("./dataLoader", () => ({
  loadHymns: (slug: string) => data.hymns[slug] ?? [],
  getBibleBooks: () => [
    { id: "GEN", name: "Geneza", chapterCount: 50 },
    { id: "PSA", name: "Psalmii", chapterCount: 150 },
    { id: "JHN", name: "Ioan", chapterCount: 21 },
  ],
  searchBibleVerses: vi.fn(() => data.verses),
}));
vi.mock("./videoLibrary", () => ({ getVideoLibrary: () => ({ getAll: () => data.videos }) }));
vi.mock("./imageLibrary", () => ({ getImageLibrary: () => ({ getAll: () => data.images }) }));
vi.mock("./audioPlaylists", () => ({ getAudioPlaylists: () => ({ getAll: () => data.playlists }) }));
vi.mock("./audioLibrary", () => ({
  getAudioLibrary: () => ({
    getAll: () => data.audio,
    getById: (id: string) => data.audio.find((a) => a.id === id),
  }),
}));

const { quickSearch } = await import("./quickSearch");
const { searchBibleVerses } = vi.mocked(await import("./dataLoader"));

const CURRENT = "crestine";

function search(query: string): QuickSearchResponse {
  return quickSearch(query, "ro", "ron-rccv", CURRENT);
}

const groupKinds = (r: QuickSearchResponse) => r.groups.map((g) => g.kind);
const hitsOf = (r: QuickSearchResponse, kind: string) =>
  r.groups.find((g) => g.kind === kind)?.hits ?? [];
const hymnLabels = (r: QuickSearchResponse) =>
  hitsOf(r, "hymns").map((h) => (h.kind === "hymn" ? `${h.book}:${h.number}` : "?"));

const verse = (chapter: number, v: number, text: string): BibleSearchResult => ({
  bookId: "JHN",
  bookName: "Ioan",
  chapter,
  verse: v,
  text,
  score: 1,
});

beforeEach(() => {
  data.hymnals = [
    { slug: "other", shortName: "Alte" },
    { slug: CURRENT, shortName: "Creștine" },
  ];
  data.hymns = {
    [CURRENT]: [
      hymn("1", "Cât de mare ești Tu", "", { audioAvailability: "cached", hasSyncedLyrics: true }),
      hymn("5", "Ioan 3,16 în cântare"),
      hymn("23", "Domnul e păstorul meu"),
      hymn("40", "Laudă", "Mare e dragostea lui Isus"),
    ],
    other: [
      hymn("023", "Harul Tău"),
      hymn("7", "Mare e Domnul"),
    ],
  };
  data.verses = [];
  data.videos = [];
  data.audio = [];
  data.playlists = [];
  data.images = [];
  searchBibleVerses.mockClear();
});

describe("quickSearch", () => {
  it.each([[""], ["   "], ["!?"]])("returns nothing for %j", (query) => {
    expect(search(query)).toEqual({ query, groups: [] });
  });

  it("echoes the query as typed, so a stale reply can be told apart", () => {
    expect(search("  Mare ").query).toBe("  Mare ");
  });

  describe("a bare number", () => {
    it("is a hymn number first and a psalm second", () => {
      const r = search("23");
      expect(groupKinds(r)).toEqual(["hymns", "reference"]);
      expect(hitsOf(r, "reference")[0]).toMatchObject({ bookId: "PSA", chapter: 23, verseGiven: false });
    });

    it("lists the current book's hymn before other books', ignoring zero padding", () => {
      expect(hymnLabels(search("23"))).toEqual([`${CURRENT}:23`, "other:023"]);
      expect(hitsOf(search("23"), "hymns")[0]).toMatchObject({ match: "number" });
    });

    it("never matches titles or lyrics", () => {
      data.hymns[CURRENT].push(hymn("99", "Psalmul 23"));
      expect(hymnLabels(search("23"))).not.toContain(`${CURRENT}:99`);
    });

    it.each([["0"], ["151"]])("%s is no psalm", (query) => {
      expect(groupKinds(search(query))).not.toContain("reference");
    });

    it("never runs the Bible text search", () => {
      search("23");
      expect(searchBibleVerses).not.toHaveBeenCalled();
    });
  });

  describe("a Bible reference", () => {
    it("ranks above a hymn whose title starts the same way", () => {
      const r = search("ioan 3");
      expect(groupKinds(r)).toEqual(["reference", "hymns"]);
      expect(hitsOf(r, "reference")[0]).toMatchObject({
        bookId: "JHN",
        bookName: "Ioan",
        chapter: 3,
        verseGiven: false,
      });
    });

    it("carries the verse range when one is typed", () => {
      expect(hitsOf(search("ioan 3:16-18"), "reference")[0]).toMatchObject({
        chapter: 3,
        startVerse: 16,
        endVerse: 18,
        verseGiven: true,
      });
    });

    it("skips the Bible text search, which would only bury the jump", () => {
      search("ioan 3:16");
      expect(searchBibleVerses).not.toHaveBeenCalled();
    });

    it("isn't offered for a chapter past the end of the book", () => {
      data.verses = [verse(1, 1, "ioan 30")];
      const r = search("ioan 30");
      expect(groupKinds(r)).not.toContain("reference");
      expect(groupKinds(r)).toContain("bible");
    });

    it("isn't offered for a bare book name", () => {
      expect(groupKinds(search("geneza"))).not.toContain("reference");
    });
  });

  describe("hymn text", () => {
    it("ranks title prefix, then title words, then lyrics — across books", () => {
      // "other" comes first in the registry, and the current book is sorted
      // ahead of it; neither order may beat a stronger match.
      const r = search("mare");
      expect(hymnLabels(r)).toEqual(["other:7", `${CURRENT}:1`, `${CURRENT}:40`]);
      expect(hitsOf(r, "hymns").map((h) => (h.kind === "hymn" ? h.match : ""))).toEqual([
        "title",
        "title",
        "lyrics",
      ]);
    });

    it("ignores diacritics and case", () => {
      expect(hymnLabels(search("CAT DE MARE"))).toEqual([`${CURRENT}:1`]);
    });

    it("matches title words in any order", () => {
      expect(hymnLabels(search("tu mare"))).toEqual([`${CURRENT}:1`]);
    });

    it("matches lyrics only as a phrase", () => {
      expect(hymnLabels(search("dragostea lui"))).toEqual([`${CURRENT}:40`]);
      expect(hymnLabels(search("lui dragostea"))).toEqual([]);
    });

    it("doesn't search lyrics for fewer than three characters", () => {
      expect(hymnLabels(search("dr"))).toEqual([]);
    });

    it("reports what's on hand for karaoke", () => {
      const [hit] = hitsOf(search("cat de"), "hymns");
      expect(hit).toMatchObject({ bookName: "Creștine", title: "Cât de mare ești Tu", hasMP3: true, hasSyncedLyrics: true });
      const [plain] = hitsOf(search("harul"), "hymns");
      expect(plain).toMatchObject({ hasMP3: false, hasSyncedLyrics: false });
    });
  });

  it("caps each group at five and counts the rest", () => {
    data.hymns[CURRENT] = Array.from({ length: 8 }, (_, i) => hymn(String(i + 100), `Isus ${i}`));
    const group = search("isus").groups.find((g) => g.kind === "hymns")!;
    expect(group.hits).toHaveLength(5);
    expect(group.more).toBe(3);
  });

  describe("media", () => {
    beforeEach(() => {
      data.videos = [{ id: "v1", name: "Anunțuri duminică", path: "/v1.mp4" }];
      data.audio = [
        { id: "a1", name: "Isus intro", path: "/a1.mp3" },
        { id: "a2", name: "Postludiu", path: "/a2.mp3" },
      ];
      data.playlists = [{ id: "p1", name: "Cântări Isus", audioIds: ["a1", "gone", "a2"] }];
      data.images = [{ id: "i1", name: "Fundal Isus", path: "/i1.png" }];
    });

    it("matches every kind by name, words in any order", () => {
      const hits = hitsOf(search("isus"), "media");
      expect(hits.map((h: QuickSearchHit) => h.kind)).toEqual(["audio", "playlist", "image"]);
      expect(hitsOf(search("duminica anunturi"), "media")).toHaveLength(1);
    });

    it("counts only playlist tracks still in the library", () => {
      const playlist = hitsOf(search("cantari"), "media").find((h) => h.kind === "playlist");
      expect(playlist).toMatchObject({ trackCount: 2 });
    });

    it("ranks below hymns and above Bible text", () => {
      data.verses = [verse(3, 16, "Isus a zis")];
      data.hymns[CURRENT].push(hymn("50", "Isus e Domnul"));
      expect(groupKinds(search("isus"))).toEqual(["hymns", "media", "bible"]);
    });

    it("ranks below a hymn that only matched on lyrics", () => {
      data.hymns[CURRENT].push(hymn("60", "Cântare", "vino la Isus acum"));
      data.videos.push({ id: "v2", name: "la isus", path: "/v2.mp4" });
      expect(groupKinds(search("la isus"))).toEqual(["hymns", "media"]);
    });
  });

  it("shows Bible text last, with the verses as returned", () => {
    data.verses = [verse(3, 16, "Fiindcă atât de mult a iubit Dumnezeu lumea")];
    const r = search("atat de mult");
    expect(groupKinds(r)[r.groups.length - 1]).toBe("bible");
    expect(hitsOf(r, "bible")[0]).toEqual({
      kind: "verse",
      bookId: "JHN",
      bookName: "Ioan",
      chapter: 3,
      verse: 16,
      text: "Fiindcă atât de mult a iubit Dumnezeu lumea",
    });
  });
});
