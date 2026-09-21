import fs from "fs";
import path from "path";
import { app } from "electron";
import Store from "electron-store";
import type { CustomHymnalMeta, Hymn } from "../src/shared/types";

/**
 * User-created hymn books.
 *
 * Storage mirrors bibleManager.ts: what we ship lives in assets/, what the user
 * creates lives in userData/. The payload is the same `Hymn[]` array shape as
 * assets/hymnals/{slug}.json, so dataLoader's loadHymns() reads either with one
 * path swap rather than a second code path.
 *
 *   userData/hymnals/{slug}.json   the hymns
 *   custom-hymnals.json            book metadata (electron-store)
 *
 * Metadata is kept in the store rather than inside the array file so that
 * listing books never has to parse every book.
 */

interface CustomHymnalsSchema {
  books: CustomHymnalMeta[];
}

/** Bumped when the on-disk shape changes. */
const SCHEMA_VERSION = 1;

/** The one book v1 creates; the format is per-slug so more can come later. */
export { MY_HYMNS_SLUG } from "../src/shared/hymnals";

/** The slug that changed, so a listener can refresh just that book. */
type ChangeCallback = (slug: string) => void;

export class CustomHymnalManager {
  private store: Store<CustomHymnalsSchema>;
  private changeListeners: ChangeCallback[] = [];
  /** Parsed books, dropped for a slug on every write to it. */
  private cache = new Map<string, Hymn[]>();

  constructor() {
    this.store = new Store<CustomHymnalsSchema>({
      name: "custom-hymnals",
      defaults: { books: [] },
    });
  }

  // ── events ────────────────────────────────────────────────────────────────

  onChange(callback: ChangeCallback): () => void {
    this.changeListeners.push(callback);
    return () => {
      this.changeListeners = this.changeListeners.filter((cb) => cb !== callback);
    };
  }

  private notifyChange(slug: string): void {
    this.changeListeners.forEach((cb) => cb(slug));
  }

  // ── paths ─────────────────────────────────────────────────────────────────

  private getDir(): string {
    const dir = path.join(app.getPath("userData"), "hymnals");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  /** Public so dataLoader can read a custom book without duplicating the path. */
  getHymnalPath(slug: string): string {
    return path.join(this.getDir(), `${slug}.json`);
  }

  // ── books ─────────────────────────────────────────────────────────────────

  list(): CustomHymnalMeta[] {
    return this.store.get("books", []);
  }

  get(slug: string): CustomHymnalMeta | null {
    return this.list().find((book) => book.slug === slug) ?? null;
  }

  isCustom(slug: string): boolean {
    return this.list().some((book) => book.slug === slug);
  }

  /** Creates the book if it does not exist yet; returns it either way. */
  ensureBook(meta: Omit<CustomHymnalMeta, "version" | "createdAt">): CustomHymnalMeta {
    const existing = this.get(meta.slug);
    if (existing) return existing;

    const book: CustomHymnalMeta = {
      ...meta,
      version: SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
    };
    this.store.set("books", [...this.list(), book]);
    if (!fs.existsSync(this.getHymnalPath(book.slug))) {
      this.writeHymns(book.slug, []);
    }
    this.notifyChange(book.slug);
    return book;
  }

  deleteBook(slug: string): boolean {
    if (!this.isCustom(slug)) return false;
    this.store.set(
      "books",
      this.list().filter((book) => book.slug !== slug)
    );
    const file = this.getHymnalPath(slug);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    this.cache.delete(slug);
    this.notifyChange(slug);
    return true;
  }

  /** Computed, never a stored literal — a stale count is a silent lie. */
  songCount(slug: string): number {
    return this.loadHymns(slug).length;
  }

  // ── hymns ─────────────────────────────────────────────────────────────────

  loadHymns(slug: string): Hymn[] {
    const cached = this.cache.get(slug);
    if (cached) return cached;

    const file = this.getHymnalPath(slug);
    if (!fs.existsSync(file)) return [];
    try {
      const hymns = JSON.parse(fs.readFileSync(file, "utf-8")) as Hymn[];
      this.cache.set(slug, hymns);
      return hymns;
    } catch (error) {
      console.error(`Failed to read custom hymnal ${slug}:`, error);
      return [];
    }
  }

  /**
   * Temp file + rename, so an interrupted write cannot leave a truncated book
   * behind — the same shape bibleManager.ts uses for downloaded translations.
   */
  private writeHymns(slug: string, hymns: Hymn[]): void {
    const file = this.getHymnalPath(slug);
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(hymns, null, 2) + "\n");
    fs.renameSync(tmp, file);
    // dataLoader caches parsed books too; a stale entry would keep presenting
    // the old text until restart.
    this.cache.set(slug, hymns);
  }

  /**
   * The number a new hymn gets: one past the highest in use.
   *
   * Deliberately not the lowest free number. A number is an identity here — it
   * is what someone writes in a service order, and what loadHymn and deleteHymn
   * address a hymn by — so a gap in the middle stays a gap rather than being
   * handed to a different song, which would point a note written last week at
   * the wrong hymn.
   *
   * It also keeps the promise the import screen makes: numbers run in the order
   * hymns were added, so a hymn added today sorts last instead of appearing in
   * the middle of the list where an old one used to be.
   *
   * Deleting the *newest* hymn does free its number again, since the highest in
   * use drops back. That is the case worth allowing: deleting a deck imported by
   * mistake and importing the right one puts it in the same place, rather than
   * leaving a hole at the end. Never reusing anything would need a counter
   * persisted in the book's metadata, which is not worth a schema field for a
   * number nobody had time to write down.
   */
  nextNumber(slug: string): string {
    const used = this.loadHymns(slug)
      .map((hymn) => Number(hymn.number))
      .filter((value) => Number.isFinite(value));
    return String(used.length === 0 ? 1 : Math.max(...used) + 1);
  }

  /**
   * Add a hymn, renumbering on collision rather than refusing.
   *
   * Two imports can race — the renderer picked its number before either
   * committed — so the number is re-checked here and bumped if taken. Returns
   * the hymn as stored, whose number may differ from the one passed in.
   */
  addHymn(slug: string, hymn: Hymn): Hymn {
    const hymns = this.loadHymns(slug);
    const taken = new Set(hymns.map((h) => h.number));
    const stored: Hymn = {
      ...hymn,
      number: taken.has(hymn.number) ? this.nextNumber(slug) : hymn.number,
    };
    this.writeHymns(slug, sortByNumber([...hymns, stored]));
    this.notifyChange(slug);
    return stored;
  }

  updateHymn(slug: string, number: string, changes: Partial<Hymn>): Hymn | null {
    const hymns = this.loadHymns(slug);
    const index = hymns.findIndex((hymn) => hymn.number === number);
    if (index === -1) return null;

    const updated: Hymn = {
      ...hymns[index],
      ...changes,
      // Never let an edit move a hymn onto another's number.
      number: hymns[index].number,
      // Provenance records that this no longer matches what was imported, so a
      // future registry sync knows not to clobber it.
      source: hymns[index].source
        ? { ...hymns[index].source, ...changes.source, edited: true }
        : changes.source,
    };
    const next = [...hymns];
    next[index] = updated;
    this.writeHymns(slug, next);
    this.notifyChange(slug);
    return updated;
  }

  deleteHymn(slug: string, number: string): boolean {
    const hymns = this.loadHymns(slug);
    const remaining = hymns.filter((hymn) => hymn.number !== number);
    if (remaining.length === hymns.length) return false;
    this.writeHymns(slug, remaining);
    this.notifyChange(slug);
    return true;
  }
}

/** Numeric where possible, so 2 sorts before 10. */
function sortByNumber(hymns: Hymn[]): Hymn[] {
  return [...hymns].sort((a, b) => {
    const left = Number(a.number);
    const right = Number(b.number);
    if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
    return a.number.localeCompare(b.number);
  });
}

// Singleton instance
let customHymnalsInstance: CustomHymnalManager | null = null;

export function getCustomHymnals(): CustomHymnalManager {
  if (!customHymnalsInstance) {
    customHymnalsInstance = new CustomHymnalManager();
  }
  return customHymnalsInstance;
}
