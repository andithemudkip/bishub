import type {
  BibleBook,
  BibleChapter,
  BibleVerse,
  BibleData,
} from "../src/shared/types";
import type { BibleFormat } from "../src/shared/bibleTranslations";

export function parseBible(xml: string, format: BibleFormat): BibleData {
  switch (format) {
    case "usfx":
      return parseUSFX(xml);
    case "osis":
      return parseOSIS(xml);
    case "zefania":
      return parseZefania(xml);
  }
}

/** Strip XML tags and normalize whitespace */
function cleanText(raw: string): string {
  return raw.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/** Accumulate a verse into a chapter map */
function addVerse(
  chapters: Map<number, BibleVerse[]>,
  chapter: number,
  verse: number,
  text: string
): void {
  let arr = chapters.get(chapter);
  if (!arr) {
    arr = [];
    chapters.set(chapter, arr);
  }
  arr.push({ chapter, verse, text });
}

/** Convert a chapter Map to a sorted array */
function sortedChaptersFromMap(
  chapters: Map<number, BibleVerse[]>
): BibleChapter[] {
  return Array.from(chapters.entries())
    .sort(([a], [b]) => a - b)
    .map(([number, verses]) => ({
      number,
      verses: verses.sort((a, b) => a.verse - b.verse),
    }));
}

// ── OSIS book metadata ───────────────────────────────────────────────────────

interface OsisBookInfo {
  id: string;
  name: string;
}

const OSIS_BOOKS: Record<string, OsisBookInfo> = {
  Gen: { id: "GEN", name: "Genesis" }, Exod: { id: "EXO", name: "Exodus" },
  Lev: { id: "LEV", name: "Leviticus" }, Num: { id: "NUM", name: "Numbers" },
  Deut: { id: "DEU", name: "Deuteronomy" }, Josh: { id: "JOS", name: "Joshua" },
  Judg: { id: "JDG", name: "Judges" }, Ruth: { id: "RUT", name: "Ruth" },
  "1Sam": { id: "1SA", name: "1 Samuel" }, "2Sam": { id: "2SA", name: "2 Samuel" },
  "1Kgs": { id: "1KI", name: "1 Kings" }, "2Kgs": { id: "2KI", name: "2 Kings" },
  "1Chr": { id: "1CH", name: "1 Chronicles" }, "2Chr": { id: "2CH", name: "2 Chronicles" },
  Ezra: { id: "EZR", name: "Ezra" }, Neh: { id: "NEH", name: "Nehemiah" },
  Esth: { id: "EST", name: "Esther" }, Job: { id: "JOB", name: "Job" },
  Ps: { id: "PSA", name: "Psalms" }, Prov: { id: "PRO", name: "Proverbs" },
  Eccl: { id: "ECC", name: "Ecclesiastes" }, Song: { id: "SNG", name: "Song of Solomon" },
  Isa: { id: "ISA", name: "Isaiah" }, Jer: { id: "JER", name: "Jeremiah" },
  Lam: { id: "LAM", name: "Lamentations" }, Ezek: { id: "EZK", name: "Ezekiel" },
  Dan: { id: "DAN", name: "Daniel" }, Hos: { id: "HOS", name: "Hosea" },
  Joel: { id: "JOL", name: "Joel" }, Amos: { id: "AMO", name: "Amos" },
  Obad: { id: "OBA", name: "Obadiah" }, Jonah: { id: "JON", name: "Jonah" },
  Mic: { id: "MIC", name: "Micah" }, Nah: { id: "NAM", name: "Nahum" },
  Hab: { id: "HAB", name: "Habakkuk" }, Zeph: { id: "ZEP", name: "Zephaniah" },
  Hag: { id: "HAG", name: "Haggai" }, Zech: { id: "ZEC", name: "Zechariah" },
  Mal: { id: "MAL", name: "Malachi" }, Matt: { id: "MAT", name: "Matthew" },
  Mark: { id: "MRK", name: "Mark" }, Luke: { id: "LUK", name: "Luke" },
  John: { id: "JHN", name: "John" }, Acts: { id: "ACT", name: "Acts" },
  Rom: { id: "ROM", name: "Romans" }, "1Cor": { id: "1CO", name: "1 Corinthians" },
  "2Cor": { id: "2CO", name: "2 Corinthians" }, Gal: { id: "GAL", name: "Galatians" },
  Eph: { id: "EPH", name: "Ephesians" }, Phil: { id: "PHP", name: "Philippians" },
  Col: { id: "COL", name: "Colossians" }, "1Thess": { id: "1TH", name: "1 Thessalonians" },
  "2Thess": { id: "2TH", name: "2 Thessalonians" }, "1Tim": { id: "1TI", name: "1 Timothy" },
  "2Tim": { id: "2TI", name: "2 Timothy" }, Titus: { id: "TIT", name: "Titus" },
  Phlm: { id: "PHM", name: "Philemon" }, Heb: { id: "HEB", name: "Hebrews" },
  Jas: { id: "JAS", name: "James" }, "1Pet": { id: "1PE", name: "1 Peter" },
  "2Pet": { id: "2PE", name: "2 Peter" }, "1John": { id: "1JN", name: "1 John" },
  "2John": { id: "2JN", name: "2 John" }, "3John": { id: "3JN", name: "3 John" },
  Jude: { id: "JUD", name: "Jude" }, Rev: { id: "REV", name: "Revelation" },
};

// ── Zefania book number → ID map ────────────────────────────────────────────

const ZEFANIA_BOOK_NUM_MAP: Record<number, string> = {
  1: "GEN", 2: "EXO", 3: "LEV", 4: "NUM", 5: "DEU",
  6: "JOS", 7: "JDG", 8: "RUT", 9: "1SA", 10: "2SA",
  11: "1KI", 12: "2KI", 13: "1CH", 14: "2CH", 15: "EZR",
  16: "NEH", 17: "EST", 18: "JOB", 19: "PSA", 20: "PRO",
  21: "ECC", 22: "SNG", 23: "ISA", 24: "JER", 25: "LAM",
  26: "EZK", 27: "DAN", 28: "HOS", 29: "JOL", 30: "AMO",
  31: "OBA", 32: "JON", 33: "MIC", 34: "NAM", 35: "HAB",
  36: "ZEP", 37: "HAG", 38: "ZEC", 39: "MAL",
  40: "MAT", 41: "MRK", 42: "LUK", 43: "JHN", 44: "ACT",
  45: "ROM", 46: "1CO", 47: "2CO", 48: "GAL", 49: "EPH",
  50: "PHP", 51: "COL", 52: "1TH", 53: "2TH", 54: "1TI",
  55: "2TI", 56: "TIT", 57: "PHM", 58: "HEB", 59: "JAS",
  60: "1PE", 61: "2PE", 62: "1JN", 63: "2JN", 64: "3JN",
  65: "JUD", 66: "REV",
};

// ── USFX Parser ──────────────────────────────────────────────────────────────

function parseUSFX(xml: string): BibleData {
  const books: BibleBook[] = [];
  const bookRegex = /<book id="([^"]+)">([\s\S]*?)(?=<book |<\/usfx>)/g;
  let bookMatch;

  while ((bookMatch = bookRegex.exec(xml)) !== null) {
    const bookId = bookMatch[1];
    const bookContent = bookMatch[2];
    const nameMatch = bookContent.match(/<h>([^<]+)<\/h>/);
    const bookName = nameMatch ? nameMatch[1].trim() : bookId;
    const chapters: BibleChapter[] = [];
    const chapterRegex = /<c id="(\d+)"[^>]*\/>([\s\S]*?)(?=<c id="|$)/g;
    let chapterMatch;

    while ((chapterMatch = chapterRegex.exec(bookContent)) !== null) {
      const chapterNum = parseInt(chapterMatch[1], 10);
      const chapterContent = chapterMatch[2];
      const verses: BibleVerse[] = [];
      const verseRegex =
        /<v id="(\d+)"[^>]*\/>([\s\S]*?)(?=<v id="|<c id="|<\/p>|$)/g;
      let verseMatch;

      while ((verseMatch = verseRegex.exec(chapterContent)) !== null) {
        const text = cleanText(verseMatch[2]);
        if (text) {
          verses.push({
            chapter: chapterNum,
            verse: parseInt(verseMatch[1], 10),
            text,
          });
        }
      }

      if (verses.length > 0) chapters.push({ number: chapterNum, verses });
    }

    if (chapters.length > 0) books.push({ id: bookId, name: bookName, chapters });
  }

  return { books };
}

// ── OSIS Parser ──────────────────────────────────────────────────────────────

// Regex that accepts both single and double quoted attribute values
const Q = `["']([^"']+)["']`; // captures the value between quotes

function parseOSIS(xml: string): BibleData {
  const books: BibleBook[] = [];

  // Detect style: milestone (sID/eID) vs container (<verse>text</verse>)
  const isMilestone = /\ssID=/.test(xml);

  // Match book divs (attributes in any order)
  const bookRegex = new RegExp(
    `<div\\s+[^>]*\\btype=${Q}[^>]*>([\\s\\S]*?)(?=<div\\s+[^>]*\\btype=${Q}[^>]*>|</div>\\s*</div>\\s*</osisText>|$)`,
    "g"
  );
  let bookMatch;

  while ((bookMatch = bookRegex.exec(xml)) !== null) {
    if (bookMatch[1] !== "book") continue; // skip bookGroup divs etc.

    const divTag = bookMatch[0].slice(0, bookMatch[0].indexOf(">") + 1);
    const osisIdMatch = divTag.match(new RegExp(`\\bosisID=${Q}`));
    if (!osisIdMatch) continue;
    const osisBookId = osisIdMatch[1];
    const bookContent = bookMatch[2];

    const info = OSIS_BOOKS[osisBookId];
    const bookId = info?.id || osisBookId.toUpperCase().slice(0, 3);

    // Extract book name: USFM milestone > title short attr > English fallback
    let bookName = info?.name || osisBookId;
    const usfmMatch = bookContent.match(
      new RegExp(`<milestone[^>]*type=${Q}[^>]*n=${Q}[^>]*/?>`)
    );
    if (usfmMatch && usfmMatch[1] === "x-usfm-h") {
      bookName = usfmMatch[2].trim();
    } else {
      const titleMatch = bookContent.match(
        new RegExp(`<title[^>]*\\bshort=${Q}[^>]*>`)
      );
      if (titleMatch) bookName = titleMatch[1].trim();
    }

    const chapters = new Map<number, BibleVerse[]>();

    if (isMilestone) {
      // Milestone: <verse sID="..." osisID="..."/>text<verse eID="..."/>
      const verseTagRegex = /<verse\s[^>]*\/?\s*>/g;
      let verseTagMatch;

      while ((verseTagMatch = verseTagRegex.exec(bookContent)) !== null) {
        const tagStr = verseTagMatch[0];
        const sIDMatch = tagStr.match(/\bsID=["']([^"']+)["']/);
        if (!sIDMatch) continue;
        const sID = sIDMatch[1];
        const refMatch = tagStr.match(/\bosisID=["']([^"']+)["']/);
        const osisRef = refMatch ? refMatch[1] : sID;

        const refParts = osisRef.split(".");
        if (refParts.length < 3) continue;
        const chapterNum = parseInt(refParts[1], 10);
        const verseNum = parseInt(refParts[2], 10);
        if (isNaN(chapterNum) || isNaN(verseNum)) continue;

        // Find matching eID
        const escapedSID = sID.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const endRegex = new RegExp(
          `<verse\\s+eID=["']${escapedSID}["'][^>]*/?>`, "g"
        );
        endRegex.lastIndex = verseTagMatch.index + verseTagMatch[0].length;
        const endMatch = endRegex.exec(bookContent);
        if (!endMatch) continue;

        const text = cleanText(
          bookContent.slice(
            verseTagMatch.index + verseTagMatch[0].length,
            endMatch.index
          )
        );
        if (text) addVerse(chapters, chapterNum, verseNum, text);
      }
    } else {
      // Container: <verse osisID="Gen.1.1">text</verse>
      const verseRegex = new RegExp(
        `<verse\\s+osisID=${Q}[^>]*>([\\s\\S]*?)</verse>`, "g"
      );
      let verseMatch;

      while ((verseMatch = verseRegex.exec(bookContent)) !== null) {
        const refParts = verseMatch[1].split(".");
        if (refParts.length < 3) continue;
        const chapterNum = parseInt(refParts[1], 10);
        const verseNum = parseInt(refParts[2], 10);
        if (isNaN(chapterNum) || isNaN(verseNum)) continue;

        const text = cleanText(verseMatch[2]);
        if (text) addVerse(chapters, chapterNum, verseNum, text);
      }
    }

    const sorted = sortedChaptersFromMap(chapters);
    if (sorted.length > 0) books.push({ id: bookId, name: bookName, chapters: sorted });
  }

  return { books };
}

// ── Zefania Parser ───────────────────────────────────────────────────────────

function parseZefania(xml: string): BibleData {
  const books: BibleBook[] = [];
  const bookRegex =
    /<BIBLEBOOK[^>]*bnumber="(\d+)"[^>]*bname="([^"]*)"[^>]*>([\s\S]*?)(?=<BIBLEBOOK|<\/XMLBIBLE>|$)/g;
  let bookMatch;

  while ((bookMatch = bookRegex.exec(xml)) !== null) {
    const bookNum = parseInt(bookMatch[1], 10);
    const bookName = bookMatch[2].trim();
    const bookContent = bookMatch[3];
    const bookId = ZEFANIA_BOOK_NUM_MAP[bookNum] || `B${bookNum}`;
    const chapters: BibleChapter[] = [];
    const chapterRegex =
      /<CHAPTER[^>]*cnumber="(\d+)"[^>]*>([\s\S]*?)(?=<CHAPTER|<\/BIBLEBOOK>|$)/g;
    let chapterMatch;

    while ((chapterMatch = chapterRegex.exec(bookContent)) !== null) {
      const chapterNum = parseInt(chapterMatch[1], 10);
      const chapterContent = chapterMatch[2];
      const verses: BibleVerse[] = [];
      const verseRegex = /<VERS[^>]*vnumber="(\d+)"[^>]*>([\s\S]*?)<\/VERS>/g;
      let verseMatch;

      while ((verseMatch = verseRegex.exec(chapterContent)) !== null) {
        const text = cleanText(verseMatch[2]);
        if (text) {
          verses.push({
            chapter: chapterNum,
            verse: parseInt(verseMatch[1], 10),
            text,
          });
        }
      }

      if (verses.length > 0) chapters.push({ number: chapterNum, verses });
    }

    if (chapters.length > 0) books.push({ id: bookId, name: bookName, chapters });
  }

  return { books };
}
