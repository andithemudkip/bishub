import fs from "fs";
import path from "path";
import { MAX_PPTX_BYTES, parsePptx, PptxParseError } from "./pptxParser";
import { getCustomHymnals, MY_HYMNS_SLUG } from "./customHymnals";
import { sanitizeImportedHymn } from "../src/shared/hymnImport";
import {
  getTranslations,
  LANGUAGE_NAMES,
  type Language,
} from "../src/shared/i18n";
import type { HymnCommitResult, PptxImportResult } from "../src/shared/types";

/**
 * The import backend both transports call.
 *
 * Per the Web Remote Parity invariant, importing has to work the same from the
 * Electron remote (native picker → IPC) and from a phone (file input → HTTP
 * upload). The two differ only in how the bytes arrive, so everything after
 * that lives here instead of being written twice in main.ts and server.ts —
 * where the two copies would drift and a web import would start producing
 * different hymns than a desktop one.
 */

/**
 * Decks accepted in one request. The native picker allows multi-select and the
 * review screen works through them as a queue, so this is a sanity bound on a
 * single upload, not a limit on how many hymns a user may import.
 */
export const MAX_IMPORT_FILES = 40;

/**
 * Create the user's own book if it is not there yet.
 *
 * Called at startup, not only on first import, because the book's pill is the
 * only way into the import screen: leaving it out until something had been
 * imported meant a new user could never reach the button that does the
 * importing. An empty book costs one small file and gives the feature somewhere
 * to introduce itself.
 */
export function ensureMyHymnsBook(language: Language): void {
  const t = getTranslations(language).hymnImport;
  getCustomHymnals().ensureBook({
    slug: MY_HYMNS_SLUG,
    name: t.myHymns,
    shortName: t.myHymnsShort,
    language,
    languageName: LANGUAGE_NAMES[language],
  });
}

/** Parse bytes already in hand — the web upload path. */
export function parseDeckBuffer(
  fileName: string,
  buf: Buffer
): PptxImportResult {
  try {
    return { ok: true, fileName, deck: parsePptx(buf) };
  } catch (error) {
    if (error instanceof PptxParseError) {
      return { ok: false, fileName, reason: error.reason };
    }
    console.error(`Failed to parse ${fileName}:`, error);
    return { ok: false, fileName, reason: "not-a-pptx" };
  }
}

/** Parse a file on disk — the Electron picker path. */
export function parseDeckFile(filePath: string): PptxImportResult {
  const fileName = path.basename(filePath);
  let buf: Buffer;
  try {
    // Size first: reading a 2 GB file into memory only to have the parser
    // reject it is the stall the cap exists to prevent.
    if (fs.statSync(filePath).size > MAX_PPTX_BYTES) {
      return { ok: false, fileName, reason: "too-large" };
    }
    buf = fs.readFileSync(filePath);
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error);
    return { ok: false, fileName, reason: "unreadable" };
  }
  return parseDeckBuffer(fileName, buf);
}

/**
 * Commit a reviewed hymn into the user's own book, creating that book on first
 * import.
 *
 * `language` names the book. Book names are stored data rather than strings
 * translated at render time — the same as the ten we ship — so the book is
 * named once, in whatever language the user was using when it was created.
 *
 * The payload is validated, not trusted: on the web path it arrives from a
 * browser, and `source` provenance is stamped here rather than accepted from
 * the sender.
 */
export function commitHymn(
  raw: unknown,
  language: Language,
  fileName?: string
): HymnCommitResult {
  const hymn = sanitizeImportedHymn(raw);
  if (!hymn) return { ok: false, reason: "invalid-hymn" };

  try {
    // Still ensured here: a commit can be the first thing that happens after an
    // upgrade, before any startup path has run against the new storage.
    ensureMyHymnsBook(language);
    const stored = getCustomHymnals().addHymn(MY_HYMNS_SLUG, {
      ...hymn,
      source: {
        kind: "pptx",
        importedAt: new Date().toISOString(),
        // Recorded as a label, never used as a path — basename anyway, so a
        // client cannot smuggle a traversal string into the stored book.
        ...(fileName?.trim()
          ? { fileName: path.basename(fileName.trim()).slice(0, 200) }
          : {}),
      },
    });
    return { ok: true, slug: MY_HYMNS_SLUG, hymn: stored };
  } catch (error) {
    console.error("Failed to commit imported hymn:", error);
    return { ok: false, reason: "write-failed" };
  }
}

/** Remove a hymn from a user book. Bundled books are never writable. */
export function deleteCustomHymn(slug: string, number: string): boolean {
  const manager = getCustomHymnals();
  // Guard the slug rather than the caller: a client could name a bundled book,
  // which lives in assets/ and must stay read-only.
  if (!manager.isCustom(slug)) return false;
  return manager.deleteHymn(slug, number);
}
