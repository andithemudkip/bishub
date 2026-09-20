import {
  BUNDLED_HYMNALS,
  DEFAULT_HYMNAL_SLUG,
  getDefaultHymnal as pickDefaultHymnal,
  getHymnalBySlug as findHymnalBySlug,
  isValidHymnalSlug as slugIsValid,
  type HymnalInfo,
} from "../src/shared/hymnals";
import { getCustomHymnals } from "./customHymnals";

/**
 * The merged book list: what we ship, plus what the user created.
 *
 * Single source of truth main-side. `BUNDLED_HYMNALS` in src/shared/hymnals.ts
 * is only the shipped catalog — reading it directly in the main process would
 * silently ignore every user book, so the electron call sites go through here.
 *
 * Naming: this is the *local* merged list. It is unrelated to any future online
 * "shared hymn registry".
 */

type ChangeCallback = (hymnals: HymnalInfo[]) => void;

const changeListeners: ChangeCallback[] = [];
let unsubscribeFromStorage: (() => void) | null = null;

/** Custom books are described by their metadata; songCount is always computed. */
function customHymnals(): HymnalInfo[] {
  const manager = getCustomHymnals();
  return manager.list().map((book) => ({
    slug: book.slug,
    name: book.name,
    shortName: book.shortName,
    language: book.language,
    languageName: book.languageName,
    // Computed, never stored: a literal goes stale the moment a hymn is added.
    songCount: manager.songCount(book.slug),
    // Never karaoke. MP3/TTML are keyed by bare hymn number and stay unambiguous
    // only while a single book uses them.
    custom: true,
  }));
}

export function getHymnals(): HymnalInfo[] {
  return [...BUNDLED_HYMNALS, ...customHymnals()];
}

export function getHymnalBySlug(slug: string): HymnalInfo | undefined {
  return findHymnalBySlug(getHymnals(), slug);
}

export function isValidHymnalSlug(slug: string): boolean {
  return slugIsValid(getHymnals(), slug);
}

export function getDefaultHymnal(language: string): HymnalInfo | undefined {
  return pickDefaultHymnal(getHymnals(), language);
}

/** Whether this book lives in userData rather than assets. */
export function isCustomHymnal(slug: string): boolean {
  return getCustomHymnals().isCustom(slug);
}

/** The slug to fall back to when a requested one is not a real book. */
export function getFallbackHymnalSlug(language: string): string {
  return getDefaultHymnal(language)?.slug ?? DEFAULT_HYMNAL_SLUG;
}

/**
 * Subscribe to book-list changes. Lazily attaches to the storage layer so that
 * importing this module never constructs the electron-store before app.ready.
 */
export function onHymnalsChange(callback: ChangeCallback): () => void {
  changeListeners.push(callback);
  if (!unsubscribeFromStorage) {
    unsubscribeFromStorage = getCustomHymnals().onChange(() => {
      const hymnals = getHymnals();
      changeListeners.forEach((cb) => cb(hymnals));
    });
  }
  return () => {
    const index = changeListeners.indexOf(callback);
    if (index !== -1) changeListeners.splice(index, 1);
  };
}
