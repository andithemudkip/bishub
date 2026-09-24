import { beforeAll, describe, expect, it } from "vitest";
import { deepFreeze } from "../test/helpers";
import { BUNDLED_HYMNALS } from "../src/shared/hymnals";
import { DEFAULT_TRANSLATION_ID } from "../src/shared/bibleTranslations";
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
import { quickSearch } from "./quickSearch";

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

    expect(loadBible(DEFAULT_TRANSLATION_ID)).toEqual(bibleSnapshot);
  });
});

describe("quick search over cached data", () => {
  it.each(["23", "ioan 3", "ioan 3:16", "isus", "dragoste", "ps 23"])(
    "%s leaves the caches untouched",
    (query) => {
      quickSearch(query, "ro", DEFAULT_TRANSLATION_ID, BUNDLED_HYMNALS[0].slug);
      for (const { slug } of BUNDLED_HYMNALS) {
        expect(loadHymns(slug), slug).toEqual(snapshots.get(slug));
      }
      expect(loadBible(DEFAULT_TRANSLATION_ID)).toEqual(bibleSnapshot);
    }
  );
});
