import type { Language } from "./i18n";

export type BibleBookInfo = {
  id: string;
  name: string;
  abbrevs: string[];
};

// Romanian Bible book abbreviations and names
export const BIBLE_BOOKS_RO: BibleBookInfo[] = [
  // Old Testament
  { id: "GEN", name: "Geneza", abbrevs: ["gen", "geneza", "gn"] },
  { id: "EXO", name: "Exodul", abbrevs: ["exo", "exod", "exodul", "ex"] },
  {
    id: "LEV",
    name: "Leviticul",
    abbrevs: ["lev", "levitic", "leviticul", "lv"],
  },
  { id: "NUM", name: "Numeri", abbrevs: ["num", "numeri", "nm"] },
  {
    id: "DEU",
    name: "Deuteronomul",
    abbrevs: ["deu", "deut", "deuteronom", "deuteronomul", "dt"],
  },
  { id: "JOS", name: "Iosua", abbrevs: ["ios", "iosua", "jos"] },
  {
    id: "JDG",
    name: "Judecători",
    abbrevs: ["jud", "judecatori", "judecători", "jdg"],
  },
  { id: "RUT", name: "Rut", abbrevs: ["rut", "ru"] },
  {
    id: "1SA",
    name: "1 Samuel",
    abbrevs: ["1sam", "1samuel", "1sa", "1 sam", "1 samuel"],
  },
  {
    id: "2SA",
    name: "2 Samuel",
    abbrevs: ["2sam", "2samuel", "2sa", "2 sam", "2 samuel"],
  },
  {
    id: "1KI",
    name: "1 Împărați",
    abbrevs: [
      "1imp",
      "1imparati",
      "1împărați",
      "1ki",
      "1 imp",
      "1 imparati",
      "1regi",
    ],
  },
  {
    id: "2KI",
    name: "2 Împărați",
    abbrevs: [
      "2imp",
      "2imparati",
      "2împărați",
      "2ki",
      "2 imp",
      "2 imparati",
      "2regi",
    ],
  },
  {
    id: "1CH",
    name: "1 Cronici",
    abbrevs: ["1cron", "1cronici", "1ch", "1 cron", "1 cronici"],
  },
  {
    id: "2CH",
    name: "2 Cronici",
    abbrevs: ["2cron", "2cronici", "2ch", "2 cron", "2 cronici"],
  },
  { id: "EZR", name: "Ezra", abbrevs: ["ezr", "ezra"] },
  { id: "NEH", name: "Neemia", abbrevs: ["neh", "neemia", "ne"] },
  { id: "EST", name: "Estera", abbrevs: ["est", "estera"] },
  { id: "JOB", name: "Iov", abbrevs: ["iov", "job"] },
  {
    id: "PSA",
    name: "Psalmii",
    abbrevs: ["ps", "psalm", "psalmi", "psalmii", "psa"],
  },
  {
    id: "PRO",
    name: "Proverbele",
    abbrevs: ["pro", "prov", "proverbe", "proverbele", "pr"],
  },
  {
    id: "ECC",
    name: "Eclesiastul",
    abbrevs: ["ecl", "ecles", "eclesiast", "eclesiastul", "ecc"],
  },
  {
    id: "SNG",
    name: "Cântarea Cântărilor",
    abbrevs: ["cant", "cantarea", "cântarea", "sng", "cc"],
  },
  { id: "ISA", name: "Isaia", abbrevs: ["is", "isa", "isaia"] },
  { id: "JER", name: "Ieremia", abbrevs: ["ier", "ieremia", "jer"] },
  {
    id: "LAM",
    name: "Plângerile",
    abbrevs: ["plang", "plangeri", "plângerile", "lam"],
  },
  { id: "EZK", name: "Ezechiel", abbrevs: ["ez", "ezec", "ezechiel", "ezk"] },
  { id: "DAN", name: "Daniel", abbrevs: ["dan", "daniel", "dn"] },
  { id: "HOS", name: "Osea", abbrevs: ["os", "osea", "hos"] },
  { id: "JOL", name: "Ioel", abbrevs: ["ioel", "joel", "jol"] },
  { id: "AMO", name: "Amos", abbrevs: ["am", "amos", "amo"] },
  { id: "OBA", name: "Obadia", abbrevs: ["ob", "obadia", "oba"] },
  { id: "JON", name: "Iona", abbrevs: ["ion", "iona", "jon"] },
  { id: "MIC", name: "Mica", abbrevs: ["mic", "mica", "mi"] },
  { id: "NAM", name: "Naum", abbrevs: ["naum", "nam", "na"] },
  { id: "HAB", name: "Habacuc", abbrevs: ["hab", "habacuc"] },
  { id: "ZEP", name: "Țefania", abbrevs: ["tef", "tefania", "țefania", "zep"] },
  { id: "HAG", name: "Hagai", abbrevs: ["hag", "hagai"] },
  { id: "ZEC", name: "Zaharia", abbrevs: ["zah", "zaharia", "zec"] },
  { id: "MAL", name: "Maleahi", abbrevs: ["mal", "maleahi"] },
  // New Testament
  { id: "MAT", name: "Matei", abbrevs: ["mat", "matei", "mt"] },
  { id: "MRK", name: "Marcu", abbrevs: ["mar", "marcu", "mc", "mrk"] },
  { id: "LUK", name: "Luca", abbrevs: ["luc", "luca", "lk", "luk"] },
  { id: "JHN", name: "Ioan", abbrevs: ["io", "ioan", "in", "jn", "jhn"] },
  {
    id: "ACT",
    name: "Faptele Apostolilor",
    abbrevs: ["fap", "fapte", "faptele", "act", "fa"],
  },
  { id: "ROM", name: "Romani", abbrevs: ["rom", "romani", "ro"] },
  {
    id: "1CO",
    name: "1 Corinteni",
    abbrevs: ["1cor", "1corinteni", "1co", "1 cor", "1 corinteni"],
  },
  {
    id: "2CO",
    name: "2 Corinteni",
    abbrevs: ["2cor", "2corinteni", "2co", "2 cor", "2 corinteni"],
  },
  { id: "GAL", name: "Galateni", abbrevs: ["gal", "galateni", "ga"] },
  { id: "EPH", name: "Efeseni", abbrevs: ["ef", "efes", "efeseni", "eph"] },
  { id: "PHP", name: "Filipeni", abbrevs: ["fil", "filip", "filipeni", "php"] },
  { id: "COL", name: "Coloseni", abbrevs: ["col", "coloseni"] },
  {
    id: "1TH",
    name: "1 Tesaloniceni",
    abbrevs: ["1tes", "1tesaloniceni", "1th", "1 tes"],
  },
  {
    id: "2TH",
    name: "2 Tesaloniceni",
    abbrevs: ["2tes", "2tesaloniceni", "2th", "2 tes"],
  },
  {
    id: "1TI",
    name: "1 Timotei",
    abbrevs: ["1tim", "1timotei", "1ti", "1 tim"],
  },
  {
    id: "2TI",
    name: "2 Timotei",
    abbrevs: ["2tim", "2timotei", "2ti", "2 tim"],
  },
  { id: "TIT", name: "Tit", abbrevs: ["tit"] },
  { id: "PHM", name: "Filimon", abbrevs: ["flm", "filimon", "phm"] },
  { id: "HEB", name: "Evrei", abbrevs: ["evr", "evrei", "heb"] },
  { id: "JAS", name: "Iacov", abbrevs: ["iac", "iacov", "jas"] },
  {
    id: "1PE",
    name: "1 Petru",
    abbrevs: ["1pet", "1petru", "1pe", "1 pet", "1 petru"],
  },
  {
    id: "2PE",
    name: "2 Petru",
    abbrevs: ["2pet", "2petru", "2pe", "2 pet", "2 petru"],
  },
  {
    id: "1JN",
    name: "1 Ioan",
    abbrevs: ["1io", "1ioan", "1jn", "1 io", "1 ioan"],
  },
  {
    id: "2JN",
    name: "2 Ioan",
    abbrevs: ["2io", "2ioan", "2jn", "2 io", "2 ioan"],
  },
  {
    id: "3JN",
    name: "3 Ioan",
    abbrevs: ["3io", "3ioan", "3jn", "3 io", "3 ioan"],
  },
  { id: "JUD", name: "Iuda", abbrevs: ["iuda", "jud"] },
  {
    id: "REV",
    name: "Apocalipsa",
    abbrevs: ["ap", "apoc", "apocalipsa", "rev"],
  },
];

// English Bible book abbreviations and names
export const BIBLE_BOOKS_EN: BibleBookInfo[] = [
  // Old Testament
  { id: "GEN", name: "Genesis", abbrevs: ["gen", "genesis", "gn"] },
  { id: "EXO", name: "Exodus", abbrevs: ["exo", "exod", "exodus", "ex"] },
  { id: "LEV", name: "Leviticus", abbrevs: ["lev", "leviticus", "lv"] },
  { id: "NUM", name: "Numbers", abbrevs: ["num", "numbers", "nm"] },
  {
    id: "DEU",
    name: "Deuteronomy",
    abbrevs: ["deu", "deut", "deuteronomy", "dt"],
  },
  { id: "JOS", name: "Joshua", abbrevs: ["jos", "joshua", "josh"] },
  { id: "JDG", name: "Judges", abbrevs: ["jdg", "judg", "judges"] },
  { id: "RUT", name: "Ruth", abbrevs: ["rut", "ruth", "ru"] },
  {
    id: "1SA",
    name: "1 Samuel",
    abbrevs: ["1sam", "1samuel", "1sa", "1 sam", "1 samuel"],
  },
  {
    id: "2SA",
    name: "2 Samuel",
    abbrevs: ["2sam", "2samuel", "2sa", "2 sam", "2 samuel"],
  },
  {
    id: "1KI",
    name: "1 Kings",
    abbrevs: ["1ki", "1kings", "1kgs", "1 ki", "1 kings"],
  },
  {
    id: "2KI",
    name: "2 Kings",
    abbrevs: ["2ki", "2kings", "2kgs", "2 ki", "2 kings"],
  },
  {
    id: "1CH",
    name: "1 Chronicles",
    abbrevs: ["1ch", "1chr", "1chron", "1chronicles", "1 chr", "1 chronicles"],
  },
  {
    id: "2CH",
    name: "2 Chronicles",
    abbrevs: ["2ch", "2chr", "2chron", "2chronicles", "2 chr", "2 chronicles"],
  },
  { id: "EZR", name: "Ezra", abbrevs: ["ezr", "ezra"] },
  { id: "NEH", name: "Nehemiah", abbrevs: ["neh", "nehemiah", "ne"] },
  { id: "EST", name: "Esther", abbrevs: ["est", "esther"] },
  { id: "JOB", name: "Job", abbrevs: ["job"] },
  {
    id: "PSA",
    name: "Psalms",
    abbrevs: ["ps", "psa", "psalm", "psalms"],
  },
  {
    id: "PRO",
    name: "Proverbs",
    abbrevs: ["pro", "prov", "proverbs", "pr"],
  },
  {
    id: "ECC",
    name: "Ecclesiastes",
    abbrevs: ["ecc", "eccl", "eccles", "ecclesiastes"],
  },
  {
    id: "SNG",
    name: "Song of Solomon",
    abbrevs: ["sng", "song", "sos", "song of solomon", "song of songs"],
  },
  { id: "ISA", name: "Isaiah", abbrevs: ["isa", "isaiah", "is"] },
  { id: "JER", name: "Jeremiah", abbrevs: ["jer", "jeremiah"] },
  {
    id: "LAM",
    name: "Lamentations",
    abbrevs: ["lam", "lamentations"],
  },
  { id: "EZK", name: "Ezekiel", abbrevs: ["ezk", "ezek", "ezekiel"] },
  { id: "DAN", name: "Daniel", abbrevs: ["dan", "daniel", "dn"] },
  { id: "HOS", name: "Hosea", abbrevs: ["hos", "hosea"] },
  { id: "JOL", name: "Joel", abbrevs: ["jol", "joel"] },
  { id: "AMO", name: "Amos", abbrevs: ["amo", "amos", "am"] },
  { id: "OBA", name: "Obadiah", abbrevs: ["oba", "obad", "obadiah", "ob"] },
  { id: "JON", name: "Jonah", abbrevs: ["jon", "jonah"] },
  { id: "MIC", name: "Micah", abbrevs: ["mic", "micah", "mi"] },
  { id: "NAM", name: "Nahum", abbrevs: ["nam", "nah", "nahum", "na"] },
  { id: "HAB", name: "Habakkuk", abbrevs: ["hab", "habakkuk"] },
  { id: "ZEP", name: "Zephaniah", abbrevs: ["zep", "zeph", "zephaniah"] },
  { id: "HAG", name: "Haggai", abbrevs: ["hag", "haggai"] },
  { id: "ZEC", name: "Zechariah", abbrevs: ["zec", "zech", "zechariah"] },
  { id: "MAL", name: "Malachi", abbrevs: ["mal", "malachi"] },
  // New Testament
  { id: "MAT", name: "Matthew", abbrevs: ["mat", "matt", "matthew", "mt"] },
  { id: "MRK", name: "Mark", abbrevs: ["mrk", "mark", "mk"] },
  { id: "LUK", name: "Luke", abbrevs: ["luk", "luke", "lk"] },
  { id: "JHN", name: "John", abbrevs: ["jhn", "john", "jn"] },
  {
    id: "ACT",
    name: "Acts",
    abbrevs: ["act", "acts"],
  },
  { id: "ROM", name: "Romans", abbrevs: ["rom", "romans", "ro"] },
  {
    id: "1CO",
    name: "1 Corinthians",
    abbrevs: ["1co", "1cor", "1corinthians", "1 cor", "1 corinthians"],
  },
  {
    id: "2CO",
    name: "2 Corinthians",
    abbrevs: ["2co", "2cor", "2corinthians", "2 cor", "2 corinthians"],
  },
  { id: "GAL", name: "Galatians", abbrevs: ["gal", "galatians", "ga"] },
  { id: "EPH", name: "Ephesians", abbrevs: ["eph", "ephesians"] },
  { id: "PHP", name: "Philippians", abbrevs: ["php", "phil", "philippians"] },
  { id: "COL", name: "Colossians", abbrevs: ["col", "colossians"] },
  {
    id: "1TH",
    name: "1 Thessalonians",
    abbrevs: ["1th", "1thess", "1thessalonians", "1 thess"],
  },
  {
    id: "2TH",
    name: "2 Thessalonians",
    abbrevs: ["2th", "2thess", "2thessalonians", "2 thess"],
  },
  {
    id: "1TI",
    name: "1 Timothy",
    abbrevs: ["1ti", "1tim", "1timothy", "1 tim"],
  },
  {
    id: "2TI",
    name: "2 Timothy",
    abbrevs: ["2ti", "2tim", "2timothy", "2 tim"],
  },
  { id: "TIT", name: "Titus", abbrevs: ["tit", "titus"] },
  { id: "PHM", name: "Philemon", abbrevs: ["phm", "phlm", "philemon"] },
  { id: "HEB", name: "Hebrews", abbrevs: ["heb", "hebrews"] },
  { id: "JAS", name: "James", abbrevs: ["jas", "james"] },
  {
    id: "1PE",
    name: "1 Peter",
    abbrevs: ["1pe", "1pet", "1peter", "1 pet", "1 peter"],
  },
  {
    id: "2PE",
    name: "2 Peter",
    abbrevs: ["2pe", "2pet", "2peter", "2 pet", "2 peter"],
  },
  {
    id: "1JN",
    name: "1 John",
    abbrevs: ["1jn", "1john", "1 jn", "1 john"],
  },
  {
    id: "2JN",
    name: "2 John",
    abbrevs: ["2jn", "2john", "2 jn", "2 john"],
  },
  {
    id: "3JN",
    name: "3 John",
    abbrevs: ["3jn", "3john", "3 jn", "3 john"],
  },
  { id: "JUD", name: "Jude", abbrevs: ["jud", "jude"] },
  {
    id: "REV",
    name: "Revelation",
    abbrevs: ["rev", "revelation", "revelations"],
  },
];

// Backwards compatibility - default to Romanian
export const BIBLE_BOOKS = BIBLE_BOOKS_RO;

// Get books for a specific language
export function getBibleBooks(language: Language = "ro"): BibleBookInfo[] {
  return language === "en" ? BIBLE_BOOKS_EN : BIBLE_BOOKS_RO;
}

export interface ParsedReference {
  bookId: string;
  bookName: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}

/**
 * Parse a Bible reference string like:
 * - "gen 2:16" -> Genesis chapter 2, verse 16
 * - "1ki 1:20-25" -> 1 Kings chapter 1, verses 20-25
 * - "ps 23" -> Psalm 23 (all verses)
 * - "john 3:16" -> John 3:16
 */
export function parseBibleReference(
  input: string,
  language: Language = "ro"
): ParsedReference | null {
  const normalized = input.toLowerCase().trim();

  if (!normalized) return null;

  // Pattern: [book] [chapter]:[verse][-endVerse]
  // or: [book] [chapter] (whole chapter)
  const match = normalized.match(/^(.+?)\s*(\d+)(?::(\d+)(?:-(\d+))?)?$/);

  if (!match) return null;

  const [, bookPart, chapterStr, startVerseStr, endVerseStr] = match;
  const bookSearch = bookPart.trim();

  // Get books for the specified language
  const books = getBibleBooks(language);

  // Find the book
  const book = books.find(
    (b) =>
      b.abbrevs.some((abbrev) => abbrev === bookSearch) ||
      b.name.toLowerCase() === bookSearch ||
      b.id.toLowerCase() === bookSearch
  );

  if (!book) return null;

  const chapter = parseInt(chapterStr, 10);
  const startVerse = startVerseStr ? parseInt(startVerseStr, 10) : 1;
  const endVerse = endVerseStr ? parseInt(endVerseStr, 10) : startVerse;

  return {
    bookId: book.id,
    bookName: book.name,
    chapter,
    startVerse,
    endVerse: Math.max(startVerse, endVerse),
  };
}

/**
 * Get suggestions for book names based on partial input
 */
export function getBookSuggestions(
  input: string,
  language: Language = "ro"
): BibleBookInfo[] {
  const books = getBibleBooks(language);
  const normalized = input.toLowerCase().trim();

  if (!normalized) return books.slice(0, 10);

  return books
    .filter(
      (b) =>
        b.abbrevs.some((abbrev) => abbrev.startsWith(normalized)) ||
        b.name.toLowerCase().startsWith(normalized) ||
        b.id.toLowerCase().startsWith(normalized)
    )
    .slice(0, 10);
}
