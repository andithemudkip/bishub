export interface HymnalInfo {
  /** Matches the filename in assets/hymnals/{slug}.json */
  slug: string;
  name: string;
  /** Short label for tight spaces (book pills on narrow screens) */
  shortName: string;
  language: string;
  languageName: string;
  songCount: number;
  isDefault?: boolean;
  /**
   * Whether word-synced karaoke assets exist for this book. Karaoke MP3s and
   * TTML are keyed by bare padded hymn number, which only stays unambiguous
   * while exactly one book uses them — so this must remain true for at most
   * one hymnal. Adding a second means re-keying the assets by slug.
   */
  karaoke?: boolean;
}

export const DEFAULT_HYMNAL_SLUG = "imnuri-crestine";

export const HYMNALS: HymnalInfo[] = [
  // Romanian
  { slug: "imnuri-crestine", name: "Imnuri Creștine", shortName: "Creștine", language: "ro", languageName: "Română", songCount: 920, isDefault: true, karaoke: true },
  { slug: "imnuri-tineret", name: "Imnuri Tineret", shortName: "Tineret", language: "ro", languageName: "Română", songCount: 69 },
  { slug: "imnuri-exploratori", name: "Imnuri Exploratori", shortName: "Exploratori", language: "ro", languageName: "Română", songCount: 150 },
  { slug: "imnuri-companioni", name: "Imnuri Companioni", shortName: "Companioni", language: "ro", languageName: "Română", songCount: 63 },
  { slug: "imnuri-amicus", name: "Imnuri Amicus", shortName: "Amicus", language: "ro", languageName: "Română", songCount: 36 },
  { slug: "imnuri-licurici", name: "Imnuri Licurici", shortName: "Licurici", language: "ro", languageName: "Română", songCount: 86 },
  // English
  { slug: "sda-hymnal", name: "Seventh-Day Adventist Hymnal", shortName: "SDA Hymnal", language: "en", languageName: "English", songCount: 695, isDefault: true },
  // Spanish
  { slug: "nuevo-himnario-adventista", name: "Nuevo Himnario Adventista", shortName: "Himnario", language: "es", languageName: "Español", songCount: 613, isDefault: true },
  // French
  { slug: "hymnes-et-louanges", name: "Hymnes et Louanges", shortName: "Hymnes", language: "fr", languageName: "Français", songCount: 621, isDefault: true },
];

export function getHymnalBySlug(slug: string): HymnalInfo | undefined {
  return HYMNALS.find((h) => h.slug === slug);
}

/** Books available in a UI language, falling back to all when none match. */
export function getHymnalsForLanguage(language: string): HymnalInfo[] {
  const matching = HYMNALS.filter((h) => h.language === language);
  return matching.length > 0 ? matching : HYMNALS;
}

/** The book to open when none is selected, preferring the UI language. */
export function getDefaultHymnal(language: string): HymnalInfo {
  const forLanguage = getHymnalsForLanguage(language);
  return forLanguage.find((h) => h.isDefault) ?? forLanguage[0];
}

/** Whether a slug is a real book — guards values arriving over IPC/Socket.io. */
export function isValidHymnalSlug(slug: string): boolean {
  return HYMNALS.some((h) => h.slug === slug);
}
