import { describe, expect, it } from "vitest";
import { BIBLE_BOOKS_RO } from "./bibleParser";
import {
  bookSuggestion,
  filterListsAlone,
  parseQuickSearchQuery,
  splitScope,
  withScope,
} from "./quickSearchQuery";

// The loaded translation's books, named as a translation names them.
const CHAPTERS: Record<string, number> = { JHN: 21, PSA: 150, "1JN": 5, LAM: 5, ACT: 28 };
const books = BIBLE_BOOKS_RO.map((b) => ({
  id: b.id,
  name: b.id === "LAM" ? "Plângerile lui Ieremia" : b.name,
  chapterCount: CHAPTERS[b.id] ?? 50,
}));

const parse = (query: string) => parseQuickSearchQuery(query, books, "ro");

describe("parseQuickSearchQuery", () => {
  it("leaves a plain query untouched", () => {
    expect(parse("  ioan paine ")).toEqual({ scope: null, filter: null, text: "ioan paine", phrases: [] });
    expect(parse("23")).toEqual({ scope: null, filter: null, text: "23", phrases: [] });
  });

  it("reads a book filter only with a colon", () => {
    expect(parse("ioan: paine")).toMatchObject({
      filter: { bookId: "JHN" },
      bookName: "Ioan",
      text: "paine",
    });
    expect(parse("ioan paine").filter).toBeNull();
  });

  it("reads a chapter after a book", () => {
    expect(parse("ioan 6: paine")).toMatchObject({ filter: { bookId: "JHN", chapter: 6 }, text: "paine" });
  });

  it("reads a verse with no book or chapter", () => {
    expect(parse(":18 talant")).toMatchObject({ filter: { startVerse: 18, endVerse: 18 }, text: "talant" });
    expect(parse(":16-18 iubit").filter).toEqual({ startVerse: 16, endVerse: 18 });
  });

  it("reads a chapter and verse with no book", () => {
    expect(parse("6:18")).toMatchObject({ filter: { chapter: 6, startVerse: 18, endVerse: 18 }, text: "" });
    expect(parse("6: duh").filter).toEqual({ chapter: 6 });
  });

  it("reads a full reference with words after it", () => {
    expect(parse("ioan 3:16-18 iubit")).toMatchObject({
      filter: { bookId: "JHN", chapter: 3, startVerse: 16, endVerse: 18 },
      text: "iubit",
    });
  });

  it("doesn't care where the filter sits", () => {
    const { filterRange: _a, ...after } = parse("talant :18");
    const { filterRange: _b, ...before } = parse(":18 talant");
    expect(after).toEqual(before);
    expect(parse("paine ioan:")).toMatchObject({ filter: { bookId: "JHN" }, text: "paine" });
  });

  it("matches book names of several words, and the translation's own name", () => {
    expect(parse("1 ioan 4: dragoste")).toMatchObject({ filter: { bookId: "1JN", chapter: 4 }, text: "dragoste" });
    expect(parse("plangerile lui ieremia: mila").filter).toEqual({ bookId: "LAM" });
    expect(parse("faptele apostolilor 2: duh").filter).toEqual({ bookId: "ACT", chapter: 2 });
  });

  it("keeps words before the book as text", () => {
    expect(parse("dragoste 1 ioan 4:")).toMatchObject({ filter: { bookId: "1JN", chapter: 4 }, text: "dragoste" });
  });

  it("matches a book by the start of its name, but not by one letter", () => {
    expect(parse("fapt: duh").filter).toEqual({ bookId: "ACT" });
    expect(parse("e: duh").filter).toBeNull();
  });

  it("matches English book names too", () => {
    expect(parse("john: bread").filter).toEqual({ bookId: "JHN" });
  });

  it("treats a filter it can't read as text", () => {
    // An unknown book, a chapter past the end, a verse without a chapter.
    expect(parse("xyz: paine")).toMatchObject({ filter: null, text: "xyz: paine" });
    expect(parse("ioan 40: paine")).toMatchObject({ filter: null, text: "ioan 40: paine" });
    expect(parse("ioan:18 paine")).toMatchObject({ filter: null, text: "ioan:18 paine" });
    expect(parse(": paine").filter).toBeNull();
    expect(parse("0:5").filter).toBeNull();
  });

  it("uses the first filter it can read", () => {
    expect(parse("xyz: ioan: paine")).toMatchObject({ filter: { bookId: "JHN" }, text: "xyz: paine" });
  });

  it("accepts a range still being typed", () => {
    expect(parse(":16- iubit").filter).toEqual({ startVerse: 16, endVerse: 16 });
  });

  it("keeps quoted phrases whole and out of the filter", () => {
    expect(parse('b: "a iubit lumea"')).toEqual({
      scope: "bible",
      filter: null,
      text: "a iubit lumea",
      phrases: ["a iubit lumea"],
    });
    expect(parse('ioan: "6:18" pace')).toMatchObject({ filter: { bookId: "JHN" }, text: "6:18 pace", phrases: ["6:18"] });
  });

  it("runs an unclosed quote to the end", () => {
    expect(parse('ioan: "a iubit').phrases).toEqual(["a iubit"]);
  });

  it("says where the filter was typed, so the remote can highlight it", () => {
    const range = (query: string) => {
      const r = parse(query).filterRange;
      return r && query.slice(r[0], r[1]);
    };
    expect(range("ioan 6: paine")).toBe("ioan 6:");
    expect(range("paine :18")).toBe(":18");
    expect(range("dragoste 1 ioan 4: pace")).toBe("1 ioan 4:");
    expect(range("plangerile lui ieremia: mila")).toBe("plangerile lui ieremia:");
    expect(range('b:  "a b" 6:18')).toBe("6:18");
    expect(range("xyz: ioan: paine")).toBe("ioan:");
    expect(parse("ioan paine").filterRange).toBeUndefined();
    expect(parse("xyz: paine").filterRange).toBeUndefined();
  });

  it("reads a scope before the filter", () => {
    expect(parse("b: ioan: paine")).toMatchObject({ scope: "bible", filter: { bookId: "JHN" }, text: "paine" });
    expect(parse("imn: har")).toEqual({ scope: "hymns", filter: null, text: "har", phrases: [] });
  });
});

describe("splitScope / withScope", () => {
  it("recognizes scope words in both languages, any case", () => {
    expect(splitScope("B: har")).toEqual({ scope: "bible", rest: "har" });
    expect(splitScope("hymn:har")).toEqual({ scope: "hymns", rest: "har" });
    expect(splitScope("media: intro")).toEqual({ scope: "media", rest: "intro" });
  });

  it("leaves book names alone", () => {
    expect(splitScope("ioan: paine")).toEqual({ scope: null, rest: "ioan: paine" });
  });

  it("round-trips", () => {
    expect(splitScope(withScope("hymns", "har"))).toEqual({ scope: "hymns", rest: "har" });
    expect(withScope(null, "har")).toBe("har");
  });
});

describe("filterListsAlone", () => {
  it("lists a chapter and verse in every book, nothing broader", () => {
    expect(filterListsAlone({ chapter: 6, startVerse: 18 })).toBe(true);
    expect(filterListsAlone({ startVerse: 18 })).toBe(false);
    expect(filterListsAlone({ chapter: 6 })).toBe(false);
    expect(filterListsAlone({ bookId: "JHN" })).toBe(false);
  });
});

describe("bookSuggestion", () => {
  const suggest = (query: string) => bookSuggestion(parse(query), books, "ro");

  it("offers the book reading of a plain query", () => {
    expect(suggest("ioan paine")).toEqual({ bookName: "Ioan", query: "ioan: paine" });
    expect(suggest("1 ioan dragoste")).toEqual({ bookName: "1 Ioan", query: "1 ioan: dragoste" });
  });

  it("needs words after the book, an exact name, and no filter", () => {
    expect(suggest("ioan")).toBeNull();
    expect(suggest("ioa paine")).toBeNull();
    expect(suggest("ioan: paine")).toBeNull();
    expect(suggest("lumina lumii")).toBeNull();
  });
});
