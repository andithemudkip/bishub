/**
 * One Quick Search result. Each carries what's needed to present it straight
 * away — no second lookup between pressing Enter and the display changing.
 */
export type QuickSearchHit =
  | {
      kind: "hymn";
      book: string;
      bookName: string;
      number: string;
      title: string;
      /** Why it matched, strongest first — also how it ranks. */
      match: "number" | "title" | "lyrics";
      hasMP3: boolean;
      hasSyncedLyrics: boolean;
    }
  | {
      kind: "reference";
      bookId: string;
      bookName: string;
      chapter: number;
      startVerse: number;
      endVerse: number;
      /** "ioan 3:16" highlights the verse; "ioan 3" opens the chapter at its start. */
      verseGiven: boolean;
    }
  | {
      kind: "verse";
      bookId: string;
      bookName: string;
      chapter: number;
      verse: number;
      text: string;
    }
  | { kind: "video"; id: string; name: string; path: string }
  | { kind: "audio"; id: string; name: string; path: string }
  | { kind: "image"; id: string; name: string; path: string }
  | {
      kind: "playlist";
      id: string;
      name: string;
      /** Tracks still in the library — the range a shuffle picks its start from. */
      trackCount: number;
    };

export type QuickSearchGroupKind = "hymns" | "reference" | "bible" | "media";

export interface QuickSearchGroup {
  kind: QuickSearchGroupKind;
  hits: QuickSearchHit[];
  /** Matches beyond the per-group cap, for "show all". */
  more: number;
}

export interface QuickSearchResponse {
  /** Echoed back so a reply to a stale query can be told apart. */
  query: string;
  /** Strongest group first. */
  groups: QuickSearchGroup[];
  /**
   * Bible text matches are still to come: ask `quickSearchVerses` for them.
   * They rank last, so they append to these groups.
   */
  versesFollow: boolean;
  /**
   * The verses a colon filter narrowed the Bible search to ("ioan 6: paine"),
   * shown above the results so it's clear how the query was read.
   */
  filter?: QuickSearchFilter;
  /** A plain query that starts with a book name: offers to search only in it. */
  suggestion?: { bookName: string; query: string };
}

export interface QuickSearchFilter {
  bookName?: string;
  chapter?: number;
  startVerse?: number;
  endVerse?: number;
  /** The words searched within it; empty when the filter stands alone. */
  text: string;
  /** Where it was typed, as [start, end) offsets into `query`, for highlighting. */
  range?: [number, number];
}
