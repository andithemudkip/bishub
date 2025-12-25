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
} from "../src/shared/types";
import type { Language } from "../src/shared/i18n";

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

export function formatHymnForDisplay(hymn: Hymn): {
  title: string;
  slides: string[];
} {
  const slides: string[] = [];

  hymn.verses.forEach((verse, index) => {
    // Add verse
    slides.push(verse);

    // Add chorus after each verse if it exists
    if (hymn.chorus && hymn.chorus.trim()) {
      slides.push(hymn.chorus);
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
