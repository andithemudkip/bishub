import { describe, expect, it } from "vitest";
import {
  BIBLE_BOOKS_EN,
  BIBLE_BOOKS_RO,
  type BibleBookInfo,
  getBibleBooks,
  getBookSuggestions,
  parseBibleReference,
  parseBibleReferenceWithBooks,
} from "./bibleParser";
import type { Language } from "./i18n";
import { normalizeForSearch } from "./utils";

function ref(input: string, language: Language = "ro") {
  const parsed = parseBibleReference(input, language);
  return parsed && [parsed.bookId, parsed.chapter, parsed.startVerse, parsed.endVerse];
}

describe("book tables", () => {
  it.each([
    ["ro", BIBLE_BOOKS_RO],
    ["en", BIBLE_BOOKS_EN],
  ] as const)("%s has 66 books with unique ids", (_, books) => {
    expect(books).toHaveLength(66);
    expect(new Set(books.map((b) => b.id)).size).toBe(66);
  });

  it("lists the same ids in the same order in both languages", () => {
    expect(BIBLE_BOOKS_EN.map((b) => b.id)).toEqual(BIBLE_BOOKS_RO.map((b) => b.id));
  });

  it.each([
    ["ro", BIBLE_BOOKS_RO],
    ["en", BIBLE_BOOKS_EN],
  ] as const)("%s aliases are unambiguous", (language, books) => {
    // Two books sharing an alias means the first one silently wins. "jud" is
    // the one known case: Romanian operators type it for Judecători, which is
    // listed first, and Iuda is still reachable as "iuda".
    const allowed = language === "ro" ? ["jud"] : [];
    const owners = new Map<string, string[]>();
    for (const book of books) {
      const aliases = new Set([book.name, book.id, ...book.abbrevs].map(normalizeForSearch));
      for (const alias of aliases) owners.set(alias, [...(owners.get(alias) ?? []), book.id]);
    }
    const shared = [...owners].filter(([, ids]) => ids.length > 1).map(([alias]) => alias);
    expect(shared).toEqual(allowed);
  });

  it("getBibleBooks picks the table by language, Romanian by default", () => {
    expect(getBibleBooks()).toBe(BIBLE_BOOKS_RO);
    expect(getBibleBooks("ro")).toBe(BIBLE_BOOKS_RO);
    expect(getBibleBooks("en")).toBe(BIBLE_BOOKS_EN);
  });
});

describe("parseBibleReference", () => {
  it.each([
    // [input, language, bookId, chapter, startVerse, endVerse]
    ["ioan 3:16", "ro", "JHN", 3, 16, 16],
    ["Ioan 3:16", "ro", "JHN", 3, 16, 16],
    ["john 3:16", "en", "JHN", 3, 16, 16],
    ["ps 23", "ro", "PSA", 23, 1, 1],
    ["psalmi 23", "ro", "PSA", 23, 1, 1],
    ["gen 2:16-18", "ro", "GEN", 2, 16, 18],
    ["1ki 1:20-25", "en", "1KI", 1, 20, 25],
    ["ps 023", "ro", "PSA", 23, 1, 1],
  ] as const)("%s (%s)", (input, language, ...expected) => {
    expect(ref(input, language)).toEqual(expected);
  });

  it.each([
    ["1 ioan 2"],
    ["1ioan 2"],
    ["1 Ioan 2"],
  ])("numbered book %s", (input) => {
    expect(ref(input)).toEqual(["1JN", 2, 1, 1]);
  });

  it("matches with or without diacritics", () => {
    expect(ref("Plângerile 3")).toEqual(["LAM", 3, 1, 1]);
    expect(ref("plangerile 3")).toEqual(["LAM", 3, 1, 1]);
    expect(ref("1 Împărați 1")).toEqual(["1KI", 1, 1, 1]);
    expect(ref("1 imparati 1")).toEqual(["1KI", 1, 1, 1]);
  });

  it("ignores surrounding and repeated spaces", () => {
    expect(ref("  gen   2:16 ")).toEqual(["GEN", 2, 16, 16]);
  });

  it("accepts a chapter glued to the book", () => {
    expect(ref("gen2:16")).toEqual(["GEN", 2, 16, 16]);
  });

  it("collapses a backwards range to its start verse", () => {
    expect(ref("gen 2:18-16")).toEqual(["GEN", 2, 18, 18]);
  });

  it("names the book in the requested language", () => {
    expect(parseBibleReference("john 3:16", "ro")?.bookName).toBe("Ioan");
    expect(parseBibleReference("ioan 3:16", "en")?.bookName).toBe("John");
  });

  describe("language precedence", () => {
    it("prefers the active language's aliases", () => {
      expect(ref("jud 1", "ro")?.[0]).toBe("JDG");
      expect(ref("jud 1", "en")?.[0]).toBe("JUD");
    });

    it("falls back to the other language's aliases", () => {
      expect(ref("lamentations 3", "ro")).toEqual(["LAM", 3, 1, 1]);
      expect(ref("plangeri 3", "en")).toEqual(["LAM", 3, 1, 1]);
    });
  });

  describe("flags", () => {
    it("chapter only", () => {
      expect(parseBibleReference("ioan 3")).toMatchObject({
        bookOnly: false,
        verseGiven: false,
      });
    });

    it("chapter and verse", () => {
      expect(parseBibleReference("ioan 3:16")).toMatchObject({
        bookOnly: false,
        verseGiven: true,
      });
    });

    it("bare book name opens chapter 1", () => {
      expect(parseBibleReference("plangeri")).toMatchObject({
        bookId: "LAM",
        chapter: 1,
        startVerse: 1,
        bookOnly: true,
        verseGiven: false,
      });
    });
  });

  it("allows a prefix when a chapter follows, but not for a bare book", () => {
    // A partial word alone would otherwise hijack every text search.
    expect(ref("ge 1")).toEqual(["GEN", 1, 1, 1]);
    expect(parseBibleReference("ge")).toBeNull();
    expect(parseBibleReference("gen")?.bookId).toBe("GEN");
  });

  it("prefers an exact alias over an earlier book it prefixes", () => {
    // "io" prefixes Iosua, which comes first in the table, but it's an exact
    // alias for Ioan — exact must win regardless of table order.
    expect(ref("io 1")?.[0]).toBe("JHN");
  });

  it.each([
    [""],
    ["   "],
    ["xyz 3"],
    ["3:16"],
    ["Ioan, 3:16"],
    ["ioan 3:16-"],
    ["dragoste"],
  ])("returns null for %j", (input) => {
    expect(parseBibleReference(input)).toBeNull();
  });
});

describe("parseBibleReferenceWithBooks", () => {
  // A downloaded translation names books its own way.
  const books = [
    { id: "GEN", name: "Facerea" },
    { id: "LAM", name: "Plângerile lui Ieremia" },
    { id: "JHN", name: "Evanghelia după Ioan" },
  ];

  it("returns the translation's own book name", () => {
    expect(parseBibleReferenceWithBooks("ioan 3:16", books)).toMatchObject({
      bookId: "JHN",
      bookName: "Evanghelia după Ioan",
      chapter: 3,
      startVerse: 16,
    });
  });

  it.each([
    ["plangerile lui ieremia 3"],
    ["plangeri 3"],
    ["plang 3"],
    ["lam 3"],
    ["LAM 3"],
  ])("matches %s through own name, tables, prefix or id", (input) => {
    expect(parseBibleReferenceWithBooks(input, books)).toMatchObject({
      bookId: "LAM",
      chapter: 3,
    });
  });

  it("matches the translation's own name as a bare book", () => {
    expect(parseBibleReferenceWithBooks("facerea", books)).toMatchObject({
      bookId: "GEN",
      bookOnly: true,
    });
  });

  it("only resolves books the translation contains", () => {
    expect(parseBibleReferenceWithBooks("ps 23", books)).toBeNull();
  });
});

describe("getBookSuggestions", () => {
  const ids = (books: BibleBookInfo[]) => books.map((b) => b.id);

  it("returns the first ten books for empty input", () => {
    expect(ids(getBookSuggestions(""))).toEqual(ids(BIBLE_BOOKS_RO.slice(0, 10)));
  });

  it("keeps canonical order and caps at ten", () => {
    expect(ids(getBookSuggestions("j"))).toEqual([
      "JOS", "JDG", "JOB", "JER", "JOL", "JON", "JHN", "JAS", "JUD",
    ]);
    expect(getBookSuggestions("1")).toHaveLength(8);
  });

  it("matches without diacritics or case", () => {
    expect(ids(getBookSuggestions("Plâ"))).toEqual(["LAM"]);
    expect(ids(getBookSuggestions("pla"))).toEqual(["LAM"]);
  });

  it("uses only the active language's aliases", () => {
    expect(ids(getBookSuggestions("ioa", "ro"))).toEqual(["JHN"]);
    expect(getBookSuggestions("ioa", "en")).toEqual([]);
  });

  it("returns nothing for unknown input", () => {
    expect(getBookSuggestions("xyz")).toEqual([]);
  });
});
