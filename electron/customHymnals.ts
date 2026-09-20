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
export const MY_HYMNS_SLUG = "my-hymns";

type ChangeCallback = () => void;

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

  private notifyChange(): void {
    this.changeListeners.forEach((cb) => cb());
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
    this.notifyChange();
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
    this.notifyChange();
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

  /** The next unused number in the book, as a string. */
  nextNumber(slug: string): string {
    const used = new Set(this.loadHymns(slug).map((hymn) => Number(hymn.number)));
    let next = 1;
    while (used.has(next)) next++;
    return String(next);
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
    this.notifyChange();
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
    this.notifyChange();
    return updated;
  }

  deleteHymn(slug: string, number: string): boolean {
    const hymns = this.loadHymns(slug);
    const remaining = hymns.filter((hymn) => hymn.number !== number);
    if (remaining.length === hymns.length) return false;
    this.writeHymns(slug, remaining);
    this.notifyChange();
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
