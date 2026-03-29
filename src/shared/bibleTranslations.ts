export type BibleFormat = "osis" | "usfx" | "zefania";

export interface BibleTranslationInfo {
  id: string;
  name: string;
  language: string;
  languageName: string;
  format: BibleFormat;
  filename: string;
  isDefault?: boolean;
  /** Bundled asset filename (loaded from assets/ dir, no download needed) */
  bundled?: string;
}

export const DEFAULT_TRANSLATION_ID = "ron-rccv";

export const BIBLE_TRANSLATIONS: BibleTranslationInfo[] = [
  // Albanian
  { id: "sqi-albanian", name: "Albanian Bible", language: "sqi", languageName: "Shqip", format: "osis", filename: "sqi-albanian.osis.xml" },
  // Bulgarian
  { id: "bul-bulgarian", name: "Bulgarian Bible", language: "bul", languageName: "Български", format: "osis", filename: "bul-bulgarian.osis.xml" },
  // Cherokee
  { id: "chr-cherokee", name: "Cherokee New Testament", language: "chr", languageName: "ᏣᎳᎩ", format: "usfx", filename: "chr-cherokee.usfx.xml" },
  // Chinese
  { id: "chi-cuv", name: "Chinese Union Version (Traditional)", language: "chi", languageName: "中文", format: "usfx", filename: "chi-cuv.usfx.xml" },
  { id: "chi-cuv-simp", name: "Chinese Union Version (Simplified)", language: "chi", languageName: "中文", format: "usfx", filename: "chi-cuv-simp.usfx.xml" },
  // Croatian
  { id: "hrv-croatian", name: "Croatian Bible", language: "hrv", languageName: "Hrvatski", format: "osis", filename: "hrv-croatian.osis.xml" },
  // Czech
  { id: "cze-bkr", name: "Bible Kralická", language: "cze", languageName: "Čeština", format: "zefania", filename: "cze-bkr.zefania.xml" },
  // Danish
  { id: "dan-danish", name: "Danish Bible", language: "dan", languageName: "Dansk", format: "osis", filename: "dan-danish.osis.xml" },
  // Dutch
  { id: "dut-statenvertaling", name: "Statenvertaling", language: "dut", languageName: "Nederlands", format: "zefania", filename: "dut-statenvertaling.zefania.xml" },
  // English
  { id: "eng-asv", name: "American Standard Version", language: "eng", languageName: "English", format: "zefania", filename: "eng-asv.zefania.xml" },
  { id: "eng-bbe", name: "Bible in Basic English", language: "eng", languageName: "English", format: "usfx", filename: "eng-bbe.usfx.xml" },
  { id: "eng-darby", name: "Darby Bible", language: "eng", languageName: "English", format: "zefania", filename: "eng-darby.zefania.xml" },
  { id: "eng-dra", name: "Douay-Rheims", language: "eng", languageName: "English", format: "zefania", filename: "eng-dra.zefania.xml" },
  { id: "eng-gb-oeb", name: "Open English Bible (UK)", language: "eng", languageName: "English", format: "osis", filename: "eng-gb-oeb.osis.xml" },
  { id: "eng-gb-webbe", name: "World English Bible (British)", language: "eng", languageName: "English", format: "usfx", filename: "eng-gb-webbe.usfx.xml" },
  { id: "eng-kjv", name: "King James Version", language: "eng", languageName: "English", format: "osis", filename: "eng-kjv.osis.xml" },
  { id: "eng-us-oeb", name: "Open English Bible (US)", language: "eng", languageName: "English", format: "osis", filename: "eng-us-oeb.osis.xml" },
  { id: "eng-web", name: "World English Bible", language: "eng", languageName: "English", format: "usfx", filename: "eng-web.usfx.xml" },
  { id: "eng-ylt", name: "Young's Literal Translation", language: "eng", languageName: "English", format: "zefania", filename: "eng-ylt.zefania.xml" },
  // Finnish
  { id: "fin-biblia", name: "Finnish Bible (1776)", language: "fin", languageName: "Suomi", format: "osis", filename: "fin-biblia.osis.xml" },
  // French
  { id: "fra-ostervald", name: "Ostervald", language: "fra", languageName: "Français", format: "osis", filename: "fra-ostervald.osis.xml" },
  // German
  { id: "deu-luther1912", name: "Luther Bible (1912)", language: "deu", languageName: "Deutsch", format: "osis", filename: "deu-luther1912.osis.xml" },
  // Hebrew
  { id: "heb-leningrad", name: "Leningrad Codex", language: "heb", languageName: "עברית", format: "usfx", filename: "heb-leningrad.usfx.xml" },
  // Hungarian
  { id: "hun-karoli", name: "Károli Bible", language: "hun", languageName: "Magyar", format: "osis", filename: "hun-karoli.osis.xml" },
  // Italian
  { id: "ita-riveduta", name: "Riveduta (1927)", language: "ita", languageName: "Italiano", format: "osis", filename: "ita-riveduta.osis.xml" },
  // Japanese
  { id: "jpn-kougo", name: "口語訳 (Kougo-yaku)", language: "jpn", languageName: "日本語", format: "osis", filename: "jpn-kougo.osis.xml" },
  // Korean
  { id: "kor-korean", name: "Korean Bible", language: "kor", languageName: "한국어", format: "osis", filename: "kor-korean.osis.xml" },
  // Latin
  { id: "lat-clementine", name: "Clementine Vulgate", language: "lat", languageName: "Latina", format: "usfx", filename: "lat-clementine.usfx.xml" },
  // Latvian
  { id: "lav-latvian", name: "Latvian Bible", language: "lav", languageName: "Latviešu", format: "osis", filename: "lav-latvian.osis.xml" },
  // Maori
  { id: "mri-maori", name: "Maori Bible", language: "mri", languageName: "Te Reo Māori", format: "osis", filename: "mri-maori.osis.xml" },
  // Norwegian
  { id: "nor-norwegian", name: "Norwegian Bible", language: "nor", languageName: "Norsk", format: "osis", filename: "nor-norwegian.osis.xml" },
  // Polish
  { id: "pol-gdanska", name: "Biblia Gdańska", language: "pol", languageName: "Polski", format: "osis", filename: "pol-gdanska.osis.xml" },
  // Portuguese
  { id: "por-almeida", name: "Almeida", language: "por", languageName: "Português", format: "usfx", filename: "por-almeida.usfx.xml" },
  // Romanian
  { id: "ron-rccv", name: "Cornilescu", language: "ron", languageName: "Română", format: "usfx", filename: "ron-rccv.usfx.xml", isDefault: true, bundled: "bible.xml" },
  { id: "ron-btf", name: "Traducerea Fidelă", language: "ron", languageName: "Română", format: "usfx", filename: "ronbtf_usfx.xml", bundled: "ronbtf_usfx.xml" },
  // Russian
  { id: "rus-synodal", name: "Synodal Translation", language: "rus", languageName: "Русский", format: "zefania", filename: "rus-synodal.zefania.xml" },
  // Spanish
  { id: "spa-bes", name: "La Biblia en Español Sencillo", language: "spa", languageName: "Español", format: "usfx", filename: "spa-bes.usfx.xml" },
  { id: "spa-pddpt", name: "Palabra de Dios para Ti", language: "spa", languageName: "Español", format: "usfx", filename: "spa-pddpt.usfx.xml" },
  { id: "spa-rv1909", name: "Reina-Valera (1909)", language: "spa", languageName: "Español", format: "usfx", filename: "spa-rv1909.usfx.xml" },
  { id: "spa-vbl", name: "Versión Biblia Libre", language: "spa", languageName: "Español", format: "usfx", filename: "spa-vbl.usfx.xml" },
  // Swahili
  { id: "swa-swahili", name: "Swahili Bible", language: "swa", languageName: "Kiswahili", format: "osis", filename: "swa-swahili.osis.xml" },
  // Swedish
  { id: "swe-swedish", name: "Swedish Bible", language: "swe", languageName: "Svenska", format: "osis", filename: "swe-swedish.osis.xml" },
  // Tagalog
  { id: "tgl-tagalog", name: "Ang Dating Biblia", language: "tgl", languageName: "Tagalog", format: "osis", filename: "tgl-tagalog.osis.xml" },
  // Thai
  { id: "tha-thai", name: "Thai Bible", language: "tha", languageName: "ไทย", format: "osis", filename: "tha-thai.osis.xml" },
  // Turkish
  { id: "tur-turkish", name: "Turkish Bible", language: "tur", languageName: "Türkçe", format: "osis", filename: "tur-turkish.osis.xml" },
  // Vietnamese
  { id: "vie-cadman", name: "Cadman Bible (1934)", language: "vie", languageName: "Tiếng Việt", format: "osis", filename: "vie-cadman.osis.xml" },
];

export function getTranslationById(id: string): BibleTranslationInfo | undefined {
  return BIBLE_TRANSLATIONS.find((t) => t.id === id);
}

export function getTranslationsByLanguage(): { languageName: string; translations: BibleTranslationInfo[] }[] {
  const map = new Map<string, BibleTranslationInfo[]>();
  for (const t of BIBLE_TRANSLATIONS) {
    const list = map.get(t.languageName) || [];
    list.push(t);
    map.set(t.languageName, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([languageName, translations]) => ({ languageName, translations }));
}
