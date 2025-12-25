// Romanian Bible book abbreviations and names
export const BIBLE_BOOKS: {
  id: string;
  name: string;
  abbrevs: string[];
}[] = [
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
 * - "imp 1:20-25" -> 1 Kings chapter 1, verses 20-25
 * - "ps 23" -> Psalm 23 (all verses)
 * - "ioan 3:16" -> John 3:16
 */
export function parseBibleReference(input: string): ParsedReference | null {
  const normalized = input.toLowerCase().trim();

  if (!normalized) return null;

  // Pattern: [book] [chapter]:[verse][-endVerse]
  // or: [book] [chapter] (whole chapter)
  const match = normalized.match(/^(.+?)\s*(\d+)(?::(\d+)(?:-(\d+))?)?$/);

  if (!match) return null;

  const [, bookPart, chapterStr, startVerseStr, endVerseStr] = match;
  const bookSearch = bookPart.trim();

  // Find the book
  const book = BIBLE_BOOKS.find(
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
export function getBookSuggestions(input: string): typeof BIBLE_BOOKS {
  const normalized = input.toLowerCase().trim();
  if (!normalized) return BIBLE_BOOKS.slice(0, 10);

  return BIBLE_BOOKS.filter(
    (b) =>
      b.abbrevs.some((abbrev) => abbrev.startsWith(normalized)) ||
      b.name.toLowerCase().startsWith(normalized) ||
      b.id.toLowerCase().startsWith(normalized)
  ).slice(0, 10);
}
