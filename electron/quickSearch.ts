import type { Hymn, HymnBlock } from "../src/shared/types";
import type { Language } from "../src/shared/i18n";
import type {
  QuickSearchGroup,
  QuickSearchHit,
  QuickSearchResponse,
} from "../src/shared/quickSearch.types";
import { normalizeForSearch } from "../src/shared/utils";
import { parseBibleReferenceWithBooks } from "../src/shared/bibleParser";
import { getHymnals } from "./hymnalRegistry";
import { loadHymns, getBibleBooks, searchBibleVerses } from "./dataLoader";
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

/**
 * One search across hymns, Bible and media, ranked and grouped on the server
 * so the Electron and web remotes get identical results from one round trip.
 * Measured at ~30–50ms warm (the Bible full-text scan dominates), which is
 * fast enough to run as the operator types.
 */
export function quickSearch(
  query: string,
  language: Language,
  translationId: string,
  currentHymnal: string
): QuickSearchResponse {
  const trimmed = query.trim();
  const normalized = normalizeForSearch(trimmed);
  if (!normalized) return { query, groups: [] };

  const words = normalized.split(/\s+/).filter(Boolean);
  const hasAllWords = (text: string) => words.every((w) => text.includes(w));
  const isNumber = /^\d+$/.test(trimmed);
  const results: { group: QuickSearchGroup; rank: number }[] = [];

  // ── Hymns ────────────────────────────────────────────────────────────────
  // The operator's current book first, then the rest in registry order.
  const hymnals = [...getHymnals()].sort(
    (a, b) => Number(b.slug === currentHymnal) - Number(a.slug === currentHymnal)
  );
  const hymnHits: Ranked[] = [];
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
        const title = normalizeForSearch(hymn.title);
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
  if (hymnHits.length > 0) {
    // Stable sort: within a tier, the book order and hymn order above hold.
    hymnHits.sort((a, b) => a.tier - b.tier);
    results.push(group("hymns", hymnHits));
  }

  // ── Bible reference ──────────────────────────────────────────────────────
  const books = getBibleBooks(translationId);
  let reference: QuickSearchHit | null = null;
  // A bare number is a hymn or a psalm, never a reference the parser would
  // read into it ("23" as book "2", chapter 3).
  const parsed = isNumber ? null : parseBibleReferenceWithBooks(trimmed, books, language);
  if (parsed && !parsed.bookOnly) {
    const book = books.find((b) => b.id === parsed.bookId);
    if (book && parsed.chapter >= 1 && parsed.chapter <= book.chapterCount) {
      reference = {
        kind: "reference",
        bookId: parsed.bookId,
        bookName: book.name,
        chapter: parsed.chapter,
        startVerse: parsed.startVerse,
        endVerse: parsed.endVerse,
        verseGiven: parsed.verseGiven,
      };
    }
  } else if (isNumber) {
    const n = parseInt(trimmed, 10);
    const psalms = books.find((b) => b.id === PSALMS_ID);
    if (psalms && n >= 1 && n <= Math.min(PSALM_COUNT, psalms.chapterCount)) {
      reference = {
        kind: "reference",
        bookId: PSALMS_ID,
        bookName: psalms.name,
        chapter: n,
        startVerse: 1,
        endVerse: 1,
        verseGiven: false,
      };
    }
  }
  if (reference) results.push(group("reference", [{ hit: reference, tier: TIER.reference }]));

  // ── Media ────────────────────────────────────────────────────────────────
  const mediaHits: Ranked[] = [];
  const addMedia = (hit: QuickSearchHit & { name: string }) => {
    if (hasAllWords(normalizeForSearch(hit.name))) mediaHits.push({ hit, tier: TIER.media });
  };
  for (const v of getVideoLibrary().getAll()) addMedia({ kind: "video", id: v.id, name: v.name, path: v.path });
  for (const a of getAudioLibrary().getAll()) addMedia({ kind: "audio", id: a.id, name: a.name, path: a.path });
  for (const p of getAudioPlaylists().getAll()) addMedia({ kind: "playlist", id: p.id, name: p.name });
  for (const i of getImageLibrary().getAll()) addMedia({ kind: "image", id: i.id, name: i.name, path: i.path });
  if (mediaHits.length > 0) results.push(group("media", mediaHits));

  // ── Bible full text ──────────────────────────────────────────────────────
  // A typed reference is a direct jump; searching its text too would only bury it.
  if (!reference && !isNumber && normalized.length >= MIN_LYRICS_QUERY) {
    const verses = searchBibleVerses(trimmed, translationId);
    if (verses.length > 0) {
      results.push(
        group(
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
        )
      );
    }
  }

  results.sort((a, b) => a.rank - b.rank);
  return { query, groups: results.map((r) => r.group) };
}
