import { beforeAll, describe, expect, it } from "vitest";
import { deepFreeze } from "../test/helpers";
import { BUNDLED_HYMNALS } from "../src/shared/hymnals";
import { DEFAULT_TRANSLATION_ID } from "../src/shared/bibleTranslations";
import { normalizeForSearch } from "../src/shared/utils";
import type { BibleData, Hymn } from "../src/shared/types";
import {
  formatBibleChapterForDisplay,
  formatHymnForDisplay,
  getBibleChapter,
  getBibleVerses,
  getHymnByNumber,
  loadBible,
  loadHymns,
  resolveHymnDisplay,
  searchAllHymns,
  searchBibleVerses,
} from "./dataLoader";
import { quickSearch, quickSearchVerses, searchBibleText, warmQuickSearch } from "./quickSearch";

// Hymnals and Bibles are parsed once and cached for the life of the process
// (see CLAUDE.md). Freezing the cached objects makes any read path that
// mutates them throw, rather than quietly changing what every later caller
// sees — e.g. a verse text edited in place for one presentation.

const STATIC = { synced: false, instrumental: false };
const snapshots = new Map<string, Hymn[]>();
let bibleSnapshot: BibleData;

beforeAll(() => {
  for (const { slug } of BUNDLED_HYMNALS) {
    const hymns = loadHymns(slug);
    snapshots.set(slug, structuredClone(hymns));
    deepFreeze(hymns);
  }
  const bible = loadBible(DEFAULT_TRANSLATION_ID);
  bibleSnapshot = structuredClone(bible);
  deepFreeze(bible);
});

describe("cached hymnals", () => {
  it("load every bundled book", () => {
    for (const { slug } of BUNDLED_HYMNALS) {
      expect(loadHymns(slug).length, slug).toBeGreaterThan(0);
    }
  });

  it("survive every read path untouched", () => {
    for (const { slug } of BUNDLED_HYMNALS) {
      const hymns = loadHymns(slug);
      for (const hymn of hymns) {
        formatHymnForDisplay(hymn, "ro");
        formatHymnForDisplay(hymn, "en");
      }
      const first = getHymnByNumber(hymns[0].number, slug);
      expect(first).not.toBeNull();
      resolveHymnDisplay(slug, first!.number, STATIC, "ro");
    }
    searchAllHymns("isus");

    for (const { slug } of BUNDLED_HYMNALS) {
      expect(loadHymns(slug), slug).toEqual(snapshots.get(slug));
    }
  });
});

describe("cached Bible", () => {
  it("survives every read path untouched", () => {
    const bible = loadBible(DEFAULT_TRANSLATION_ID);
    expect(bible.books.length).toBeGreaterThan(0);

    const book = bible.books[0];
    const verses = getBibleChapter(book.id, 1);
    expect(verses.length).toBeGreaterThan(0);
    getBibleVerses(book.id, 1, 1, 3);
    formatBibleChapterForDisplay(book.id, book.name, 1, verses, 2, DEFAULT_TRANSLATION_ID);
    searchBibleVerses("dumnezeu a iubit lumea");
    warmQuickSearch(DEFAULT_TRANSLATION_ID);

    expect(loadBible(DEFAULT_TRANSLATION_ID)).toEqual(bibleSnapshot);
  });
});

describe("quick search over cached data", () => {
  it.each(["23", "ioan 3", "ioan 3:16", "isus", "dragoste", "ps 23", "ioan: paine", ":18 talant", "6:18", '"a iubit"'])(
    "%s leaves the caches untouched",
    (query) => {
      quickSearch(query, "ro", DEFAULT_TRANSLATION_ID, BUNDLED_HYMNALS[0].slug);
      quickSearchVerses(query, "ro", DEFAULT_TRANSLATION_ID);
      for (const { slug } of BUNDLED_HYMNALS) {
        expect(loadHymns(slug), slug).toEqual(snapshots.get(slug));
      }
      expect(loadBible(DEFAULT_TRANSLATION_ID)).toEqual(bibleSnapshot);
    }
  );
});

describe("searchBibleVerses", () => {
  const where = (r: { bookId: string; chapter: number; verse: number }) =>
    `${r.bookId} ${r.chapter}:${r.verse}`;

  it("ranks the exact phrase first", () => {
    expect(where(searchBibleVerses("atat de mult a iubit Dumnezeu lumea")[0])).toBe("JHN 3:16");
  });

  it("matches words by prefix, in any order", () => {
    const hits = searchBibleVerses("lumea iub dumnezeu").map(where);
    expect(hits).toContain("JHN 3:16");
  });

  it("still matches when only half the words are found", () => {
    expect(searchBibleVerses("iubit dumnezeu lumea xyzq qzyx").map(where)).toContain("JHN 3:16");
    expect(searchBibleVerses("lumea xyzq qzyx")).toEqual([]);
  });
});

describe("searchBibleText (filters and phrases)", () => {
  const where = (r: { bookId: string; chapter: number; verse: number }) =>
    `${r.bookId} ${r.chapter}:${r.verse}`;
  const search = (query: string) => searchBibleText(query, "ro", DEFAULT_TRANSLATION_ID);

  it("finds a verse from its number and one word", () => {
    const hits = search(":18 talant");
    expect(hits.map(where)).toContain("MAT 25:18");
    expect(hits.every((h) => h.verse === 18)).toBe(true);
  });

  it("searches only the named book or chapter", () => {
    const inBook = search("ioan: painea vietii");
    expect(inBook.map(where)).toContain("JHN 6:35");
    expect(inBook.every((h) => h.bookId === "JHN")).toBe(true);
    expect(search("ioan 6: paine").every((h) => h.bookId === "JHN" && h.chapter === 6)).toBe(true);
  });

  it("keeps to a verse range", () => {
    const hits = search("ioan 3:16-18 lumea").map(where);
    expect(hits).toEqual(["JHN 3:16", "JHN 3:17"]);
  });

  it("lists a chapter and verse across every book, in Bible order", () => {
    const hits = search("6:18");
    expect(hits.length).toBeGreaterThan(10);
    expect(hits[0].bookId).toBe("GEN");
    expect(hits.every((h) => h.chapter === 6 && h.verse === 18)).toBe(true);
  });

  it("lists nothing for a filter too broad to scan by eye", () => {
    expect(search(":18")).toEqual([]);
    expect(search("ioan:")).toEqual([]);
  });

  it("requires a quoted phrase as written, not just its words", () => {
    const loose = search("painea vietii");
    const exact = search('"painea vietii"');
    expect(exact.map(where)).toContain("JHN 6:35");
    expect(exact.length).toBeLessThan(loose.length);
    expect(exact.every((h) => normalizeForSearch(h.text).includes("painea vietii"))).toBe(true);
  });

  it("searches as before without syntax", () => {
    expect(search("dumnezeu a iubit lumea")).toEqual(searchBibleVerses("dumnezeu a iubit lumea"));
  });
});

