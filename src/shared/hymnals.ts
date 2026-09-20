export interface HymnalInfo {
  /** Matches the filename in assets/hymnals/{slug}.json, or userData/hymnals/{slug}.json when custom */
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
  /**
   * User-created book living in userData rather than assets. Absent on every
   * bundled book, so `!!custom` is the test for which directory to read.
   */
  custom?: boolean;
}

export const DEFAULT_HYMNAL_SLUG = "imnuri-crestine";

/**
 * The books we ship.
 *
 * This is the *bundled* catalog, not the full list the app shows: user-created
 * books are merged in at runtime by electron/hymnalRegistry.ts and pushed to the
 * renderer. Use it directly only as a seed value before that list arrives, or
 * where you specifically mean "the books we ship".
 */
export const BUNDLED_HYMNALS: HymnalInfo[] = [
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

/**
 * The helpers below take the list explicitly rather than closing over the
 * bundled const, because the real list is runtime data once a user can create
 * books: the main process applies them to the merged registry, the renderer to
 * whatever list it last received.
 */

export function getHymnalBySlug(
  hymnals: readonly HymnalInfo[],
  slug: string
): HymnalInfo | undefined {
  return hymnals.find((h) => h.slug === slug);
}

/** Books available in a UI language, falling back to all when none match. */
export function getHymnalsForLanguage(
  hymnals: readonly HymnalInfo[],
  language: string
): HymnalInfo[] {
  const matching = hymnals.filter((h) => h.language === language);
  return matching.length > 0 ? matching : [...hymnals];
}

/** The book to open when none is selected, preferring the UI language. */
export function getDefaultHymnal(
  hymnals: readonly HymnalInfo[],
  language: string
): HymnalInfo | undefined {
  const forLanguage = getHymnalsForLanguage(hymnals, language);
  return forLanguage.find((h) => h.isDefault) ?? forLanguage[0];
}

/** Whether a slug is a real book — guards values arriving over IPC/Socket.io. */
export function isValidHymnalSlug(
  hymnals: readonly HymnalInfo[],
  slug: string
): boolean {
  return hymnals.some((h) => h.slug === slug);
}
