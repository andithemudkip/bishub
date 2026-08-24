import { app } from "electron";
import fs from "fs";
import path from "path";
import type { HymnRef, LyricsTuning } from "../src/shared/types";

/**
 * Persisted karaoke timing corrections, keyed by hymnal slug and hymn number.
 *
 * The generated timings are right most of the time and wrong in ways no
 * automatic check detects — a hymn shifted by a whole bar looks perfectly
 * consistent to the generator. Corrections made by ear are kept here and
 * reapplied whenever the hymn loads, and `npm run pull-lyric-tuning` folds them
 * back into scripts/score-extract/overrides.json so the next generation bakes
 * them in.
 */
type Store = Record<string, Record<string, LyricsTuning>>;

const FILENAME = "lyric-tuning.json";

function storePath(): string {
  return path.join(app.getPath("userData"), FILENAME);
}

function read(): Store {
  try {
    return JSON.parse(fs.readFileSync(storePath(), "utf-8")) as Store;
  } catch {
    return {};
  }
}

function isEmpty(tuning: LyricsTuning): boolean {
  return !tuning.offset && tuning.breakpoints.length === 0;
}

export function loadSavedTuning(hymnRef?: HymnRef): LyricsTuning {
  const blank: LyricsTuning = { offset: 0, breakpoints: [] };
  if (!hymnRef) return blank;
  const saved = read()[hymnRef.book]?.[hymnRef.number];
  if (!saved) return blank;
  return {
    offset: saved.offset ?? 0,
    breakpoints: Array.isArray(saved.breakpoints) ? saved.breakpoints : [],
  };
}

export function saveTuning(hymnRef: HymnRef, tuning: LyricsTuning): void {
  const store = read();
  const book = (store[hymnRef.book] ??= {});
  // A correction reset to zero is a deletion, not a stored no-op — otherwise the
  // export would carry meaningless entries into the generator.
  if (isEmpty(tuning)) {
    delete book[hymnRef.number];
    if (Object.keys(book).length === 0) delete store[hymnRef.book];
  } else {
    book[hymnRef.number] = tuning;
  }
  try {
    fs.mkdirSync(path.dirname(storePath()), { recursive: true });
    fs.writeFileSync(storePath(), JSON.stringify(store, null, 2));
  } catch (err) {
    console.error("[lyricsTuning] could not save:", err);
  }
}
