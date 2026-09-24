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
      /** "ioan 3:16" projects; "ioan 3" opens the chapter on the Bible page. */
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
  | { kind: "playlist"; id: string; name: string };

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
}
