import type { BibleSearchResult, Hymn, HymnBlock } from "../src/shared/types";
import type { Language } from "../src/shared/i18n";
import type {
  QuickSearchGroup,
  QuickSearchHit,
  QuickSearchResponse,
} from "../src/shared/quickSearch.types";
import { normalizeForSearch } from "../src/shared/utils";
import { parseBibleReferenceWithBooks } from "../src/shared/bibleParser";
import {
  bookSuggestion,
  filterListsAlone,
  parseQuickSearchQuery,
  type ParsedQuickSearch,
  type QuickSearchScope,
  type VerseFilter,
} from "../src/shared/quickSearchQuery";
import { getHymnals } from "./hymnalRegistry";
import { loadHymns, getBibleBooks, searchBibleVerses, warmBibleSearch } from "./dataLoader";
import { getVideoLibrary } from "./videoLibrary";
import { getAudioLibrary } from "./audioLibrary";
import { getImageLibrary } from "./imageLibrary";
import { getAudioPlaylists } from "./audioPlaylists";

/** Rows per group; the rest are counted for "show all". */
const GROUP_CAP = 5;

/**
 * Explicit tiers rather than a fuzzy score: lower ranks first, and a group
 * ranks by its best hit. Hymn numbers come first because that's how
 * operators think ("23" is hymn 23 before it's Psalm 23). A query that parses
 * as a chapter reference is a deliberate jump, so it beats hymn titles that
 * merely start the same way ("ioan 3" vs a hymn called "Ioan 3,16").
 */
const TIER = {
  hymnNumber: 1,
  reference: 2,
  hymnTitlePrefix: 3,
  hymnTitle: 4,
  hymnLyrics: 5,
  media: 6,
  bibleText: 7,
} as const;

/** Lyric matching on fewer characters than this is all noise. */
const MIN_LYRICS_QUERY = 3;
/** Psalms is the book a bare number can mean. */
const PSALMS_ID = "PSA";
const PSALM_COUNT = 150;

/**
 * Normalized lyrics, keyed by the hymn's blocks array: bundled books keep the
 * same array for the life of the process (karaoke annotation copies the hymn,
 * not its blocks), and an edited custom hymn gets a new one, so this never
 * goes stale and never needs clearing.
 */
const lyricsCache = new WeakMap<HymnBlock[], string>();

/** Titles repeat across calls; normalizing ~3,000 of them per keystroke adds up. */
const titleCache = new Map<string, string>();

function normalizedTitle(hymn: Hymn): string {
  let title = titleCache.get(hymn.title);
  if (title === undefined) {
    title = normalizeForSearch(hymn.title);
    titleCache.set(hymn.title, title);
  }
  return title;
}

function normalizedLyrics(hymn: Hymn): string {
  let text = lyricsCache.get(hymn.blocks);
  if (text === undefined) {
    text = normalizeForSearch(hymn.blocks.map((b) => b.text).join(" "));
    lyricsCache.set(hymn.blocks, text);
  }
  return text;
}

interface Ranked {
  hit: QuickSearchHit;
  tier: number;
}

function group(kind: QuickSearchGroup["kind"], ranked: Ranked[]) {
  return {
    group: {
      kind,
      hits: ranked.slice(0, GROUP_CAP).map((r) => r.hit),
      more: Math.max(0, ranked.length - GROUP_CAP),
    },
    rank: Math.min(...ranked.map((r) => r.tier)),
  };
}

type Books = ReturnType<typeof getBibleBooks>;

/** What a query asks for, worked out once and shared by both halves. */
interface Plan {
  parsed: ParsedQuickSearch;
  books: Books;
  /** Text to match, normalized. */
  normalized: string;
  isNumber: boolean;
  inScope: (scope: QuickSearchScope) => boolean;
  reference: QuickSearchHit | null;
  versesFollow: boolean;
}

function plan(query: string, language: Language, translationId: string): Plan {
  const books = getBibleBooks(translationId);
  const parsed = parseQuickSearchQuery(query, books, language);
  const { filter, text } = parsed;
  // A colon filter is a Bible search by definition.
  const scope = filter ? "bible" : parsed.scope;
  const inScope = (s: QuickSearchScope) => !scope || scope === s;
  const normalized = normalizeForSearch(text);
  const isNumber = /^\d+$/.test(text);

  let reference: QuickSearchHit | null = null;
  if (inScope("bible")) {
    if (!filter) reference = findReference(text, isNumber, books, language);
    else if (filter.bookId && !text) reference = referenceFromFilter(filter, parsed.bookName ?? "");
  }
  const versesFollow =
    inScope("bible") &&
    (filter
      ? !!text || filterListsAlone(filter)
      : !reference && !isNumber && normalized.length >= MIN_LYRICS_QUERY);
  return { parsed, books, normalized, isNumber, inScope, reference, versesFollow };
}

/**
 * One search across hymns, Bible references and media, ranked and grouped on
 * the server so the Electron and web remotes get identical results. Bible
 * full text comes from `quickSearchVerses` when `versesFollow` says so. Warm,
 * this half measures ~2ms on a recent Mac and the verse scan ~10ms.
 */
export function quickSearch(
  query: string,
  language: Language,
  translationId: string,
  currentHymnal: string
): QuickSearchResponse {
  const p = plan(query, language, translationId);
  const { normalized, isNumber, inScope, reference, parsed } = p;
  const trimmed = parsed.text;
  const results: { group: QuickSearchGroup; rank: number }[] = [];
  const words = normalized.split(/\s+/).filter(Boolean);
  const hasAllWords = (text: string) => words.every((w) => text.includes(w));

  // ── Hymns ────────────────────────────────────────────────────────────────
  // The operator's current book first, then the rest in registry order.
  const hymnHits: Ranked[] = [];
  if (normalized && inScope("hymns")) {
    const hymnals = [...getHymnals()].sort(
      (a, b) => Number(b.slug === currentHymnal) - Number(a.slug === currentHymnal)
    );
    for (const hymnal of hymnals) {
      for (const hymn of loadHymns(hymnal.slug)) {
        let tier: number | null = null;
        let match: "number" | "title" | "lyrics" = "title";
        if (isNumber) {
          if (parseInt(hymn.number, 10) === parseInt(trimmed, 10)) {
            tier = TIER.hymnNumber;
            match = "number";
          }
        } else {
          const title = normalizedTitle(hymn);
          if (title.startsWith(normalized)) tier = TIER.hymnTitlePrefix;
          else if (hasAllWords(title)) tier = TIER.hymnTitle;
          // Titles match words in any order; lyrics only the phrase — any-order
          // words across a whole hymn match nearly everything.
          else if (normalized.length >= MIN_LYRICS_QUERY && normalizedLyrics(hymn).includes(normalized)) {
            tier = TIER.hymnLyrics;
            match = "lyrics";
          }
        }
        if (tier === null) continue;
        hymnHits.push({
          tier,
          hit: {
            kind: "hymn",
            book: hymnal.slug,
            bookName: hymnal.shortName,
            number: hymn.number,
            title: hymn.title,
            match,
            hasMP3: hymn.audioAvailability === "cached",
            hasSyncedLyrics: !!hymn.hasSyncedLyrics,
          },
        });
      }
    }
  }
  if (hymnHits.length > 0) {
    // Stable sort: within a tier, the book order and hymn order above hold.
    hymnHits.sort((a, b) => a.tier - b.tier);
    results.push(group("hymns", hymnHits));
  }

  // ── Bible reference ──────────────────────────────────────────────────────
  if (reference) results.push(group("reference", [{ hit: reference, tier: TIER.reference }]));

  // ── Media ────────────────────────────────────────────────────────────────
  const mediaHits: Ranked[] = [];
  if (normalized && inScope("media")) {
    const addMedia = (hit: QuickSearchHit & { name: string }) => {
      if (hasAllWords(normalizeForSearch(hit.name))) mediaHits.push({ hit, tier: TIER.media });
    };
    for (const v of getVideoLibrary().getAll()) addMedia({ kind: "video", id: v.id, name: v.name, path: v.path });
    const audioLibrary = getAudioLibrary();
    for (const a of audioLibrary.getAll()) addMedia({ kind: "audio", id: a.id, name: a.name, path: a.path });
    for (const pl of getAudioPlaylists().getAll()) {
      const trackCount = pl.audioIds.filter((id) => audioLibrary.getById(id)).length;
      addMedia({ kind: "playlist", id: pl.id, name: pl.name, trackCount });
    }
    for (const i of getImageLibrary().getAll()) addMedia({ kind: "image", id: i.id, name: i.name, path: i.path });
  }
  if (mediaHits.length > 0) results.push(group("media", mediaHits));

  results.sort((a, b) => a.rank - b.rank);
  const response: QuickSearchResponse = {
    query,
    groups: results.map((r) => r.group),
    versesFollow: p.versesFollow,
  };
  const { filter } = parsed;
  // "ioan:" alone is just the reference row; the line explains the rest.
  if (filter && (parsed.text || !reference)) {
    response.filter = {
      bookName: parsed.bookName,
      chapter: filter.chapter,
      startVerse: filter.startVerse,
      endVerse: filter.endVerse,
      text: parsed.text,
    };
  }
  if (p.versesFollow) {
    const suggestion = bookSuggestion(parsed, p.books, language);
    if (suggestion) response.suggestion = suggestion;
  }
  return response;
}

/**
 * The Bible full-text half of a Quick Search, asked for separately once
 * `quickSearch` says it applies. It scans every verse, so it costs more than
 * everything else together; splitting it off puts hymns and references on
 * screen without waiting for it. Its group always ranks last, so arriving
 * second never reorders what's already shown.
 */
export function quickSearchVerses(
  query: string,
  language: Language,
  translationId: string
): QuickSearchResponse {
  const { parsed, versesFollow } = plan(query, language, translationId);
  if (!versesFollow) return { query, groups: [], versesFollow: false };
  const verses = searchParsed(parsed, translationId);
  if (verses.length === 0) return { query, groups: [], versesFollow: false };
  const { group: bible } = group(
    "bible",
    verses.map((v) => ({
      tier: TIER.bibleText,
      hit: {
        kind: "verse",
        bookId: v.bookId,
        bookName: v.bookName,
        chapter: v.chapter,
        verse: v.verse,
        text: v.text,
      },
    }))
  );
  return { query, groups: [bible], versesFollow: false };
}

function searchParsed(parsed: ParsedQuickSearch, translationId: string) {
  return searchBibleVerses(parsed.text, translationId, {
    filter: parsed.filter ?? undefined,
    phrases: parsed.phrases,
  });
}

/**
 * The Bible page's text search, which understands the same filters and
 * phrases, so "show all" from Quick Search lands on the same verses. A scope
 * prefix means nothing there and is ignored.
 */
export function searchBibleText(
  query: string,
  language: Language,
  translationId: string
): BibleSearchResult[] {
  const parsed = parseQuickSearchQuery(query, getBibleBooks(translationId), language);
  if (parsed.filter && !parsed.text && !filterListsAlone(parsed.filter)) return [];
  return searchParsed(parsed, translationId);
}

function referenceFromFilter(filter: VerseFilter, bookName: string): QuickSearchHit {
  const startVerse = filter.startVerse ?? 1;
  return {
    kind: "reference",
    bookId: filter.bookId ?? "",
    bookName,
    chapter: filter.chapter ?? 1,
    startVerse,
    endVerse: filter.endVerse ?? startVerse,
    verseGiven: filter.startVerse !== undefined,
  };
}

function findReference(
  trimmed: string,
  isNumber: boolean,
  books: Books,
  language: Language
): QuickSearchHit | null {
  // A bare number is a hymn or a psalm, never a reference the parser would
  // read into it ("23" as book "2", chapter 3).
  if (isNumber) {
    const n = parseInt(trimmed, 10);
    const psalms = books.find((b) => b.id === PSALMS_ID);
    if (psalms && n >= 1 && n <= Math.min(PSALM_COUNT, psalms.chapterCount)) {
      return {
        kind: "reference",
        bookId: PSALMS_ID,
        bookName: psalms.name,
        chapter: n,
        startVerse: 1,
        endVerse: 1,
        verseGiven: false,
      };
    }
    return null;
  }
  const parsed = parseBibleReferenceWithBooks(trimmed, books, language);
  if (!parsed || parsed.bookOnly) return null;
  const book = books.find((b) => b.id === parsed.bookId);
  if (!book || parsed.chapter < 1 || parsed.chapter > book.chapterCount) return null;
  return {
    kind: "reference",
    bookId: parsed.bookId,
    bookName: book.name,
    chapter: parsed.chapter,
    startVerse: parsed.startVerse,
    endVerse: parsed.endVerse,
    verseGiven: parsed.verseGiven,
  };
}

/**
 * Normalizes every hymn and verse ahead of the first search, which would
 * otherwise pay for it while the operator waits — on a slow church PC, long
 * enough to notice.
 */
export function warmQuickSearch(translationId: string): void {
  for (const hymnal of getHymnals()) {
    for (const hymn of loadHymns(hymnal.slug)) {
      normalizedTitle(hymn);
      normalizedLyrics(hymn);
    }
  }
  warmBibleSearch(translationId);
}
