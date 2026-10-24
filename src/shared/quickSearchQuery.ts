import type { Language } from "./i18n";
import { matchBibleBook, type DynamicBookInfo } from "./bibleParser";

/**
 * Quick Search's optional syntax (docs/PLAN_QUICK_SEARCH_SYNTAX.md): a scope
 * prefix ("b:"), one reference filter marked by a colon ("ioan:", "6:18",
 * ":18") and quoted phrases. A query without any of them parses to just its
 * text, so plain searches behave exactly as before.
 */

export type QuickSearchScope = "bible" | "hymns" | "media";

const SCOPE_WORDS: Record<string, QuickSearchScope> = {
  b: "bible",
  biblie: "bible",
  bible: "bible",
  i: "hymns",
  imn: "hymns",
  imnuri: "hymns",
  h: "hymns",
  hymn: "hymns",
  hymns: "hymns",
  m: "media",
  media: "media",
};

/** What the remote puts in front of the text when a scope pill is on. */
const SCOPE_PREFIX: Record<QuickSearchScope, string> = { bible: "b", hymns: "i", media: "m" };

const SCOPE_PATTERN = /^\s*(\p{L}+):\s*/u;

/** A leading "b:" / "imn:" / "media:" and the query after it. */
export function splitScope(query: string): { scope: QuickSearchScope | null; rest: string } {
  const match = SCOPE_PATTERN.exec(query);
  const scope = match ? SCOPE_WORDS[match[1].toLowerCase()] : undefined;
  return scope && match ? { scope, rest: query.slice(match[0].length) } : { scope: null, rest: query };
}

export function withScope(scope: QuickSearchScope | null, text: string): string {
  return scope ? `${SCOPE_PREFIX[scope]}: ${text}` : text;
}

/** Which verses a Bible text search may look at; every part is optional. */
export interface VerseFilter {
  bookId?: string;
  chapter?: number;
  startVerse?: number;
  endVerse?: number;
}

export interface ParsedQuickSearch {
  scope: QuickSearchScope | null;
  filter: VerseFilter | null;
  /** The filter's book as the translation names it. */
  bookName?: string;
  /**
   * What's left to match as text, phrases included but unquoted. Without a
   * filter or quotes it's the query (minus scope) trimmed, untouched.
   */
  text: string;
  /** Quoted parts, each of which a verse must contain as written. */
  phrases: string[];
  /** Where the filter was typed, as [start, end) offsets into the query. */
  filterRange?: [number, number];
}

export type FilterBook = DynamicBookInfo & { chapterCount: number };

interface Token {
  s: string;
  quoted: boolean;
  /** Offsets into the query, end exclusive. */
  start: number;
  end: number;
}

/** Book names run to three words ("Plângerile lui Ieremia", "Song of Songs"). */
const MAX_BOOK_WORDS = 3;

// "ioan:", "6:", "6:18", ":18", ":16-18". A trailing "-" is a range still
// being typed.
const REF_TOKEN = /^([^:]*):(\d+)?(?:-(\d*))?$/;

// A quoted phrase (an unclosed quote runs to the end), or a word.
const TOKEN = /"([^"]*)(?:"|$)|[^\s"]+/g;

/** `offset`: where `rest` starts in the query, so offsets point into it. */
function tokenize(rest: string, offset: number): Token[] {
  const tokens: Token[] = [];
  for (const match of rest.matchAll(TOKEN)) {
    const start = offset + (match.index ?? 0);
    const end = start + match[0].length;
    if (match[1] === undefined) {
      tokens.push({ s: match[0], quoted: false, start, end });
    } else if (match[1].trim()) {
      tokens.push({ s: match[1].trim(), quoted: true, start, end });
    }
  }
  return tokens;
}

/**
 * The longest run of words ending at `end` (exclusive) that names a book.
 * Prefixes count ("fapt" → Faptele) except for a single letter, which would
 * match whichever book comes first.
 */
function bookBefore<T extends FilterBook>(
  tokens: Token[],
  end: number,
  last: string | null,
  books: T[],
  language: Language
): { book: T; start: number } | null {
  const lastCount = last === null ? 0 : 1;
  for (let start = Math.max(0, end - (MAX_BOOK_WORDS - lastCount)); start <= end; start++) {
    const words = tokens.slice(start, end);
    if (words.some((t) => t.quoted)) continue;
    const name = [...words.map((t) => t.s), ...(last === null ? [] : [last])].join(" ");
    if (!/\p{L}/u.test(name)) continue;
    const book = matchBibleBook(name, books, language, name.length > 1);
    if (book) return { book, start };
  }
  return null;
}

interface FoundFilter {
  filter: VerseFilter;
  bookName?: string;
  /** Tokens it used, from `start` to the colon token inclusive. */
  start: number;
}

function filterAt<T extends FilterBook>(
  tokens: Token[],
  at: number,
  books: T[],
  language: Language
): FoundFilter | null {
  const match = REF_TOKEN.exec(tokens[at].s);
  if (!match) return null;
  const [, before, startStr, endStr] = match;
  const verses: VerseFilter = {};
  if (startStr) {
    const start = parseInt(startStr, 10);
    if (start < 1) return null;
    verses.startVerse = start;
    verses.endVerse = Math.max(start, endStr ? parseInt(endStr, 10) : start);
  }

  // ":18" — a verse number, any book and chapter.
  if (before === "") {
    return startStr ? { filter: verses, start: at } : null;
  }

  // "6:18", "ioan 6:" — a chapter, with or without a book before it.
  if (/^\d+$/.test(before)) {
    const chapter = parseInt(before, 10);
    if (chapter < 1) return null;
    const found = bookBefore(tokens, at, null, books, language);
    if (!found) return { filter: { chapter, ...verses }, start: at };
    if (chapter > found.book.chapterCount) return null;
    return {
      filter: { bookId: found.book.id, chapter, ...verses },
      bookName: found.book.name,
      start: found.start,
    };
  }

  // "ioan:" — a book, any chapter. "ioan:18" (a verse with no chapter) isn't
  // part of the syntax.
  if (startStr || !/\p{L}/u.test(before)) return null;
  const found = bookBefore(tokens, at, before, books, language);
  if (!found) return null;
  return { filter: { bookId: found.book.id }, bookName: found.book.name, start: found.start };
}

export function parseQuickSearchQuery<T extends FilterBook>(
  query: string,
  books: T[],
  language: Language
): ParsedQuickSearch {
  const { scope, rest } = splitScope(query);
  // The common case: no syntax at all, nothing to tokenize.
  if (!rest.includes(":") && !rest.includes('"')) {
    return { scope, filter: null, text: rest.trim(), phrases: [] };
  }

  const tokens = tokenize(rest, query.length - rest.length);
  let found: FoundFilter | null = null;
  let colonAt = -1;
  for (let i = 0; i < tokens.length && !found; i++) {
    if (tokens[i].quoted || !tokens[i].s.includes(":")) continue;
    found = filterAt(tokens, i, books, language);
    colonAt = i;
  }

  const remaining = found
    ? [...tokens.slice(0, found.start), ...tokens.slice(colonAt + 1)]
    : tokens;
  const phrases = remaining.filter((t) => t.quoted).map((t) => t.s);
  const text = found || phrases.length > 0 ? remaining.map((t) => t.s).join(" ") : rest.trim();
  return {
    scope,
    filter: found?.filter ?? null,
    ...(found?.bookName ? { bookName: found.bookName } : {}),
    text,
    phrases,
    ...(found ? { filterRange: [tokens[found.start].start, tokens[colonAt].end] } : {}),
  };
}

/**
 * Whether a filter with no words is worth listing: "6:18" is a few dozen
 * verses to scan by eye, ":18" or "ioan:" is a thousand.
 */
export function filterListsAlone(filter: VerseFilter): boolean {
  return !filter.bookId && filter.chapter !== undefined && filter.startVerse !== undefined;
}

/**
 * "ioan paine" means the words; "ioan: paine" means the book. When a plain
 * query starts with a book's exact name, offer the second reading.
 */
export function bookSuggestion<T extends FilterBook>(
  parsed: ParsedQuickSearch,
  books: T[],
  language: Language
): { bookName: string; query: string } | null {
  if (parsed.filter || parsed.phrases.length > 0) return null;
  const words = parsed.text.split(/\s+/).filter(Boolean);
  for (let count = Math.min(MAX_BOOK_WORDS, words.length - 1); count >= 1; count--) {
    const name = words.slice(0, count).join(" ");
    if (!/\p{L}/u.test(name)) continue;
    const book = matchBibleBook(name, books, language);
    if (book) return { bookName: book.name, query: `${name}: ${words.slice(count).join(" ")}` };
  }
  return null;
}
