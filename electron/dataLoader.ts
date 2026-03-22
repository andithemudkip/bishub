import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type {
  Hymn,
  BibleBook,
  BibleChapter,
  BibleVerse,
  BibleData,
  BibleContext,
  BibleSearchResult,
} from "../src/shared/types";
import { type Language, getTranslations } from "../src/shared/i18n";
import { normalizeForSearch } from "../src/shared/utils";

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get assets path - works in both dev and production
function getAssetsPath(): string {
  // In production (packaged), assets are in the app resources
  // In dev, assets are in project root
  return path.join(__dirname, "..", "assets");
}

// Get language-specific asset path with fallback to default
// Future: assets/{language}/hymns.json, assets/{language}/bible.xml
// Current: assets/hymns.json, assets/bible.xml (Romanian only)
function getLanguageAssetPath(language: Language, filename: string): string {
  const assetsPath = getAssetsPath();

  // Try language-specific path first
  const langPath = path.join(assetsPath, language, filename);
  if (fs.existsSync(langPath)) {
    return langPath;
  }

  // Fallback to default path (current Romanian data)
  return path.join(assetsPath, filename);
}

// Cache structure to support multiple languages
const hymnsCache = new Map<Language, Hymn[]>();
const bibleCache = new Map<Language, BibleData>();

export function loadHymns(language: Language = "ro"): Hymn[] {
  if (hymnsCache.has(language)) return hymnsCache.get(language)!;

  const hymnsPath = getLanguageAssetPath(language, "hymns.json");
  try {
    const data = fs.readFileSync(hymnsPath, "utf-8");
    const hymns = JSON.parse(data) as Hymn[];
    hymnsCache.set(language, hymns);
    return hymns;
  } catch (error) {
    console.error(`Failed to load hymns for ${language}:`, error);
    return [];
  }
}

export function getHymnByNumber(
  number: string,
  language: Language = "ro"
): Hymn | null {
  const hymns = loadHymns(language);
  return hymns.find((h) => h.number === number) || null;
}

export function searchHymns(query: string, language: Language = "ro"): Hymn[] {
  const hymns = loadHymns(language);
  const lowerQuery = query.toLowerCase();
  return hymns
    .filter(
      (h) =>
        h.number.includes(query) || h.title.toLowerCase().includes(lowerQuery)
    )
    .slice(0, 20); // Limit results
}

export function loadBible(language: Language = "ro"): BibleData {
  if (bibleCache.has(language)) return bibleCache.get(language)!;

  const biblePath = getLanguageAssetPath(language, "bible.xml");
  try {
    const xml = fs.readFileSync(biblePath, "utf-8");
    const bible = parseBibleXML(xml);
    bibleCache.set(language, bible);
    return bible;
  } catch (error) {
    console.error(`Failed to load bible for ${language}:`, error);
    return { books: [] };
  }
}

function parseBibleXML(xml: string): BibleData {
  const books: BibleBook[] = [];

  // Match each book
  const bookRegex = /<book id="([^"]+)">([\s\S]*?)(?=<book |<\/usfx>)/g;
  let bookMatch;

  while ((bookMatch = bookRegex.exec(xml)) !== null) {
    const bookId = bookMatch[1];
    const bookContent = bookMatch[2];

    // Get book name from <h> tag
    const nameMatch = bookContent.match(/<h>([^<]+)<\/h>/);
    const bookName = nameMatch ? nameMatch[1].trim() : bookId;

    const chapters: BibleChapter[] = [];

    // Split by chapters
    const chapterRegex = /<c id="(\d+)"[^>]*\/>([\s\S]*?)(?=<c id="|$)/g;
    let chapterMatch;

    while ((chapterMatch = chapterRegex.exec(bookContent)) !== null) {
      const chapterNum = parseInt(chapterMatch[1], 10);
      const chapterContent = chapterMatch[2];

      const verses: BibleVerse[] = [];

      // Extract verses
      const verseRegex =
        /<v id="(\d+)"[^>]*\/>([\s\S]*?)(?=<v id="|<c id="|<\/p>|$)/g;
      let verseMatch;

      while ((verseMatch = verseRegex.exec(chapterContent)) !== null) {
        const verseNum = parseInt(verseMatch[1], 10);
        let verseText = verseMatch[2];

        // Clean up the verse text - remove XML tags and extra whitespace
        verseText = verseText
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim();

        if (verseText) {
          verses.push({
            chapter: chapterNum,
            verse: verseNum,
            text: verseText,
          });
        }
      }

      if (verses.length > 0) {
        chapters.push({
          number: chapterNum,
          verses,
        });
      }
    }

    if (chapters.length > 0) {
      books.push({
        id: bookId,
        name: bookName,
        chapters,
      });
    }
  }

  return { books };
}

export function getBibleBooks(language: Language = "ro"): {
  id: string;
  name: string;
  chapterCount: number;
}[] {
  const bible = loadBible(language);
  return bible.books.map((b) => ({
    id: b.id,
    name: b.name,
    chapterCount: b.chapters.length,
  }));
}

export function getBibleChapter(
  bookId: string,
  chapter: number,
  language: Language = "ro"
): BibleVerse[] {
  const bible = loadBible(language);
  const book = bible.books.find((b) => b.id === bookId);
  if (!book) return [];

  const ch = book.chapters.find((c) => c.number === chapter);
  return ch?.verses || [];
}

export function getBibleVerses(
  bookId: string,
  chapter: number,
  startVerse: number,
  endVerse?: number,
  language: Language = "ro"
): BibleVerse[] {
  const verses = getBibleChapter(bookId, chapter, language);
  const end = endVerse || startVerse;
  return verses.filter((v) => v.verse >= startVerse && v.verse <= end);
}

// Push text as one or two slides, splitting at the midpoint if >= 8 lines
function pushSlides(slides: string[], text: string): void {
  const lines = text.split(/\r?\n/);
  if (lines.length >= 8) {
    const mid = Math.ceil(lines.length / 2);
    slides.push(lines.slice(0, mid).join("\n"));
    slides.push(lines.slice(mid).join("\n"));
  } else {
    slides.push(text);
  }
}

export function formatHymnForDisplay(
  hymn: Hymn,
  language: Language = "ro",
): {
  title: string;
  slides: string[];
} {
  const slides: string[] = [];
  const t = getTranslations(language);
  const chorus =
    hymn.chorus && hymn.chorus.trim()
      ? `${t.hymns.chorusPrefix}: ${hymn.chorus.trim()}`
      : null;

  hymn.verses.forEach((verse, index) => {
    pushSlides(slides, `${index + 1}. ${verse}`);

    if (chorus) {
      pushSlides(slides, chorus);
    }
  });

  return {
    title: `${hymn.number}. ${hymn.title}`,
    slides,
  };
}

export function formatBibleVersesForDisplay(
  bookName: string,
  chapter: number,
  verses: BibleVerse[]
): { title: string; slides: string[] } {
  const startVerse = verses[0]?.verse || 1;
  const endVerse = verses[verses.length - 1]?.verse || startVerse;

  const title =
    startVerse === endVerse
      ? `${bookName} ${chapter}:${startVerse}`
      : `${bookName} ${chapter}:${startVerse}-${endVerse}`;

  // Each verse is a slide
  const slides = verses.map((v) => `${v.verse}. ${v.text}`);

  return { title, slides };
}

export function formatBibleChapterForDisplay(
  bookId: string,
  bookName: string,
  chapter: number,
  allVerses: BibleVerse[],
  startAtVerse: number = 1
): {
  title: string;
  slides: string[];
  startIndex: number;
  bibleContext: BibleContext;
} {
  const title = `${bookName} ${chapter}`;
  const slides = allVerses.map((v) => `${v.verse}. ${v.text}`);
  const startIndex = allVerses.findIndex((v) => v.verse === startAtVerse);

  return {
    title,
    slides,
    startIndex: startIndex >= 0 ? startIndex : 0,
    bibleContext: { bookId, bookName, chapter, verses: allVerses },
  };
}


// Cache for normalized verse text
const normalizedBibleCache = new Map<Language, Map<string, string>>();

function getNormalizedVerse(
  bookId: string,
  chapter: number,
  verse: number,
  text: string,
  language: Language
): string {
  let langCache = normalizedBibleCache.get(language);
  if (!langCache) {
    langCache = new Map();
    normalizedBibleCache.set(language, langCache);
  }

  const key = `${bookId}:${chapter}:${verse}`;
  let normalized = langCache.get(key);
  if (!normalized) {
    normalized = normalizeForSearch(text);
    langCache.set(key, normalized);
  }
  return normalized;
}

export function searchBibleVerses(
  query: string,
  language: Language = "ro"
): BibleSearchResult[] {
  const bible = loadBible(language);
  const normalizedQuery = normalizeForSearch(query.trim());

  if (normalizedQuery.length < 3) {
    return [];
  }

  const queryWords = normalizedQuery.split(/\s+/).filter((w) => w.length > 0);
  if (queryWords.length === 0) {
    return [];
  }

  const results: BibleSearchResult[] = [];

  for (const book of bible.books) {
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        const normalizedText = getNormalizedVerse(
          book.id,
          chapter.number,
          verse.verse,
          verse.text,
          language
        );

        const score = calculateRelevanceScore(
          normalizedQuery,
          queryWords,
          normalizedText
        );

        if (score > 0) {
          results.push({
            bookId: book.id,
            bookName: book.name,
            chapter: chapter.number,
            verse: verse.verse,
            text: verse.text,
            score,
          });
        }
      }
    }
  }

  // Build book index for canonical ordering
  const bookIndex = new Map<string, number>();
  bible.books.forEach((book, i) => bookIndex.set(book.id, i));

  // Sort by score descending, then by canonical order
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.bookId !== b.bookId) {
      return (bookIndex.get(a.bookId) ?? 0) - (bookIndex.get(b.bookId) ?? 0);
    }
    if (a.chapter !== b.chapter) return a.chapter - b.chapter;
    return a.verse - b.verse;
  });

  return results.slice(0, 50);
}

function calculateRelevanceScore(
  normalizedQuery: string,
  queryWords: string[],
  normalizedText: string
): number {
  // Tier 1: Exact phrase match (highest priority)
  if (normalizedText.includes(normalizedQuery)) {
    let score = 100;
    // Bonus for match at start of verse
    if (normalizedText.startsWith(normalizedQuery)) score += 10;
    // Bonus for shorter verses (more focused match)
    score += Math.max(0, 5 - Math.floor(normalizedText.length / 50));
    return score;
  }

  // Find positions of each query word in the text
  const textWords = normalizedText.split(/\s+/);
  const wordPositions: number[] = []; // position of first occurrence of each query word
  let matchedCount = 0;

  for (const qw of queryWords) {
    // Try exact word match first, then prefix match
    let pos = textWords.findIndex((tw) => tw === qw);
    if (pos === -1) pos = textWords.findIndex((tw) => tw.startsWith(qw));
    if (pos !== -1) {
      wordPositions.push(pos);
      matchedCount++;
    }
  }

  // Require at least half the query words to match (rounded up)
  const minRequired = Math.ceil(queryWords.length / 2);
  if (matchedCount < minRequired) return 0;

  const matchRatio = matchedCount / queryWords.length;

  // Tier 2: All words present
  if (matchedCount === queryWords.length) {
    let score = 50;

    // Proximity bonus: how close together are the matched words?
    // Calculate the span (distance between earliest and latest match)
    const minPos = Math.min(...wordPositions);
    const maxPos = Math.max(...wordPositions);
    const span = maxPos - minPos + 1;
    // Perfect proximity = words are adjacent (span equals word count)
    // Up to 30 points for proximity
    const idealSpan = queryWords.length;
    const proximityScore = Math.max(0, 30 - (span - idealSpan) * 3);
    score += proximityScore;

    // Order bonus: do words appear in the same order as the query?
    let inOrder = true;
    for (let i = 1; i < wordPositions.length; i++) {
      if (wordPositions[i] <= wordPositions[i - 1]) {
        inOrder = false;
        break;
      }
    }
    if (inOrder) score += 10;

    return score;
  }

  // Tier 3: Partial word matches (at least half the words present)
  return 15 * matchRatio;
}
