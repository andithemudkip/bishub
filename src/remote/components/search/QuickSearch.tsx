import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Translations } from "../../../shared/i18n";
import type { ActivityTarget } from "../../../shared/stage.types";
import type {
  QuickSearchGroup,
  QuickSearchHit,
  QuickSearchResponse,
} from "../../../shared/quickSearch.types";
import { useSearchHistory } from "../../hooks/useSearchHistory";
import { sendPageIntent } from "../../hooks/usePageIntent";
import { HymnsIcon } from "../icons/hymns";
import { BibleIcon } from "../icons/bible";
import { VideoIcon } from "../icons/video";
import { AudioIcon } from "../icons/audio";
import { ImageIcon } from "../icons/image";
import {
  ArrowRightIcon,
  CloseIcon,
  MusicNoteIcon,
  QueueListIcon,
  SearchIcon,
} from "../icons/ui";

export interface QuickSearchActions {
  search: (query: string) => Promise<QuickSearchResponse>;
  loadHymn: (book: string, number: string) => void;
  loadBibleVerses: (
    bookId: string,
    bookName: string,
    chapter: number,
    startVerse: number,
    endVerse?: number
  ) => void;
  loadVideo: (src: string, videoId?: string) => void;
  playVideo: () => void;
  loadAudio: (src: string, name: string) => void;
  playAudio: () => void;
  loadImage: (src: string, imageId: string) => void;
  playAudioPlaylist: (playlistId: string) => void;
}

interface Props {
  open: boolean;
  /** Typed-to-open keystroke, or "" from the button / shortcut. */
  initialQuery: string;
  onClose: () => void;
  onNavigate: (page: ActivityTarget) => void;
  actions: QuickSearchActions;
  t: Translations;
}

/** Waits this long after the last keystroke; searches measure ~30–50ms. */
const DEBOUNCE_MS = 120;
const RECENTS_KEY = "bishub-quick-search-recents";
const MAX_RECENTS = 8;
/**
 * After Escape closes the overlay, a second Escape within this window is
 * swallowed: Escape is also "go idle", and pressing it twice to make sure the
 * search closed must not blank the projector.
 */
const ESCAPE_GUARD_MS = 500;

interface RecentEntry {
  id: string;
  hit: QuickSearchHit;
}

type Row =
  | { type: "hit"; hit: QuickSearchHit; group: number }
  | { type: "showAll"; group: number; groupKind: "hymns" | "bible"; more: number };

function hitKey(hit: QuickSearchHit): string {
  switch (hit.kind) {
    case "hymn":
      return `hymn:${hit.book}:${hit.number}`;
    case "reference":
      return `ref:${hit.bookId}:${hit.chapter}:${hit.startVerse}-${hit.endVerse}:${hit.verseGiven}`;
    case "verse":
      return `verse:${hit.bookId}:${hit.chapter}:${hit.verse}`;
    default:
      return `${hit.kind}:${hit.id}`;
  }
}

/**
 * One box across hymns, Bible and media. Results are actions, not a page:
 * Enter shows the selected result on the display, Shift+Enter (or the arrow
 * on each row) opens it on its own page instead.
 */
export function QuickSearch({ open, initialQuery, onClose, onNavigate, actions, t }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [response, setResponse] = useState<QuickSearchResponse | null>(null);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const latestQuery = useRef(initialQuery);
  // Read through a ref: the effect below must re-run on typing, not on every
  // parent render (Layout re-renders several times a second during playback).
  const searchRef = useRef(actions.search);
  searchRef.current = actions.search;
  const recents = useSearchHistory<RecentEntry>(RECENTS_KEY, MAX_RECENTS);

  // Fresh state on every open.
  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery);
    setResponse(null);
    setSelected(0);
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }, [open, initialQuery]);

  useEffect(() => {
    latestQuery.current = query;
    if (!open || !query.trim()) {
      setResponse(null);
      return;
    }
    const timer = setTimeout(() => {
      searchRef.current(query).then((r) => {
        // Typing moved on while this was in flight.
        if (r.query !== latestQuery.current) return;
        setResponse(r);
        setSelected(0);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, query]);

  const showingRecents = !query.trim();
  const groups: QuickSearchGroup[] = useMemo(
    () =>
      showingRecents
        ? recents.entries.length > 0
          ? [{ kind: "hymns", hits: recents.entries.map((e) => e.hit), more: 0 }]
          : []
        : (response?.groups ?? []),
    [showingRecents, recents.entries, response]
  );

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    groups.forEach((g, i) => {
      for (const hit of g.hits) out.push({ type: "hit", hit, group: i });
      if (!showingRecents && g.more > 0 && (g.kind === "hymns" || g.kind === "bible")) {
        out.push({ type: "showAll", group: i, groupKind: g.kind, more: g.more });
      }
    });
    return out;
  }, [groups, showingRecents]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-row="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const close = useCallback(() => onClose(), [onClose]);

  const activate = useCallback(
    (row: Row, openPage: boolean) => {
      if (row.type === "showAll") {
        const q = query.trim();
        onNavigate(row.groupKind);
        if (row.groupKind === "hymns") sendPageIntent({ page: "hymns", query: q });
        else sendPageIntent({ page: "bible", query: q });
        close();
        return;
      }

      const { hit } = row;
      const openBible = (chapter: number, verse: number, bookId: string, bookName: string) => {
        onNavigate("bible");
        sendPageIntent({ page: "bible", open: { bookId, bookName, chapter, verse } });
      };

      switch (hit.kind) {
        case "hymn":
          if (openPage) {
            onNavigate("hymns");
            sendPageIntent({ page: "hymns", query: hit.title });
          } else {
            actions.loadHymn(hit.book, hit.number);
          }
          break;
        case "reference":
          // A chapter alone has no verses picked yet: open it to choose.
          if (openPage || !hit.verseGiven) {
            openBible(hit.chapter, hit.startVerse, hit.bookId, hit.bookName);
          } else {
            actions.loadBibleVerses(hit.bookId, hit.bookName, hit.chapter, hit.startVerse, hit.endVerse);
          }
          break;
        case "verse":
          if (openPage) openBible(hit.chapter, hit.verse, hit.bookId, hit.bookName);
          else actions.loadBibleVerses(hit.bookId, hit.bookName, hit.chapter, hit.verse, hit.verse);
          break;
        // The library pages load media paused so it can be cued; picking it
        // here means "put it on now". Both transports keep order, so the play
        // always lands after the load.
        case "video":
          if (openPage) {
            onNavigate("video");
          } else {
            actions.loadVideo(hit.path, hit.id);
            actions.playVideo();
          }
          break;
        case "audio":
          if (openPage) {
            onNavigate("audio");
          } else {
            actions.loadAudio(hit.path, hit.name);
            actions.playAudio();
          }
          break;
        case "playlist":
          if (openPage) onNavigate("audio");
          else actions.playAudioPlaylist(hit.id);
          break;
        case "image":
          if (openPage) onNavigate("images");
          else actions.loadImage(hit.path, hit.id);
          break;
      }
      recents.add({ id: hitKey(hit), hit });
      close();
    },
    [actions, close, onNavigate, query, recents]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelected((i) => Math.min(i + 1, rows.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelected((i) => Math.max(i - 1, 0));
        break;
      case "Tab": {
        if (rows.length === 0) return;
        e.preventDefault();
        const current = rows[selected]?.group ?? 0;
        const target = e.shiftKey ? current - 1 : current + 1;
        const index = rows.findIndex((r) => r.group === target);
        if (index !== -1) setSelected(index);
        break;
      }
      case "Enter":
        e.preventDefault();
        if (rows[selected]) activate(rows[selected], e.shiftKey);
        break;
      case "Escape": {
        e.preventDefault();
        e.stopPropagation();
        const swallow = (ev: KeyboardEvent) => {
          if (ev.key !== "Escape") return;
          ev.preventDefault();
          ev.stopImmediatePropagation();
        };
        window.addEventListener("keydown", swallow, { capture: true });
        setTimeout(
          () => window.removeEventListener("keydown", swallow, { capture: true }),
          ESCAPE_GUARD_MS
        );
        close();
        break;
      }
    }
  };

  if (!open) return null;

  const groupTitle = (g: QuickSearchGroup) =>
    showingRecents
      ? t.quickSearch.recent
      : {
          hymns: t.quickSearch.groupHymns,
          reference: t.quickSearch.groupReference,
          bible: t.quickSearch.groupBible,
          media: t.quickSearch.groupMedia,
        }[g.kind];

  let rowIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 md:pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label={t.quickSearch.button}
      onClick={close}
    >
      <div
        className="h-full md:h-auto md:max-h-[70vh] md:max-w-xl md:mx-auto md:rounded-xl md:border md:border-gray-700 bg-gray-900 md:bg-gray-800 shadow-2xl flex flex-col safe-area-pt"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 border-b border-gray-700 flex-shrink-0">
          <SearchIcon className="w-5 h-5 text-gray-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.quickSearch.placeholder}
            className="flex-1 min-w-0 bg-transparent py-3.5 text-base focus:outline-none placeholder:text-gray-500"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
          />
          <button
            onClick={close}
            className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-gray-400 hover:text-white md:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={t.stage.close}
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 space-y-3">
          {groups.map((g, gi) => (
            <div key={`${g.kind}-${gi}`}>
              <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                {groupTitle(g)}
              </div>
              <ul>
                {g.hits.map((hit) => {
                  rowIndex++;
                  const index = rowIndex;
                  return (
                    <ResultRow
                      key={hitKey(hit)}
                      index={index}
                      selected={index === selected}
                      onHover={() => setSelected(index)}
                      onActivate={(openPage) => activate({ type: "hit", hit, group: gi }, openPage)}
                      openLabel={
                        hit.kind === "reference" && !hit.verseGiven
                          ? t.quickSearch.openChapter
                          : t.quickSearch.openPage
                      }
                    >
                      <HitContent hit={hit} t={t} />
                    </ResultRow>
                  );
                })}
                {(() => {
                  const showAll = rows.find((r) => r.type === "showAll" && r.group === gi);
                  if (!showAll || showAll.type !== "showAll") return null;
                  rowIndex++;
                  const index = rowIndex;
                  return (
                    <li>
                      <button
                        data-row={index}
                        onMouseEnter={() => setSelected(index)}
                        onClick={() => activate(showAll, false)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm text-blue-400 ${
                          index === selected ? "bg-blue-950/40" : ""
                        }`}
                      >
                        {t.quickSearch.showAll.replace("{n}", String(showAll.more))}
                      </button>
                    </li>
                  );
                })()}
              </ul>
            </div>
          ))}

          {!showingRecents && response && groups.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-gray-500">{t.quickSearch.noResults}</p>
          )}
        </div>

        <div className="hidden md:flex items-center gap-4 px-3 py-2 border-t border-gray-700 text-xs text-gray-500 flex-shrink-0">
          <Hint keys="Enter" label={t.quickSearch.hintShow} />
          <Hint keys="Shift+Enter" label={t.quickSearch.hintOpen} />
          <Hint keys="Tab" label={t.quickSearch.hintGroups} />
          <Hint keys="Esc" label={t.quickSearch.hintClose} />
        </div>
      </div>
    </div>
  );
}

function ResultRow({
  index,
  selected,
  onHover,
  onActivate,
  openLabel,
  children,
}: {
  index: number;
  selected: boolean;
  onHover: () => void;
  onActivate: (openPage: boolean) => void;
  openLabel: string;
  children: ReactNode;
}) {
  return (
    <li
      data-row={index}
      onMouseEnter={onHover}
      className={`flex items-stretch rounded-lg ${selected ? "bg-blue-950/40 ring-1 ring-blue-500/40" : ""}`}
    >
      <button
        onClick={() => onActivate(false)}
        className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2 min-h-11 text-left rounded-lg focus:outline-none"
      >
        {children}
      </button>
      <button
        onClick={() => onActivate(true)}
        className="px-3 flex items-center text-gray-500 hover:text-gray-200 rounded-r-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
        aria-label={openLabel}
        title={openLabel}
      >
        <ArrowRightIcon className="w-4 h-4" />
      </button>
    </li>
  );
}

function HitContent({ hit, t }: { hit: QuickSearchHit; t: Translations }) {
  const icon = "w-5 h-5 flex-shrink-0 text-gray-400";
  switch (hit.kind) {
    case "hymn":
      return (
        <>
          <HymnsIcon className={icon} />
          <span className="flex-1 min-w-0">
            <span className="block text-sm truncate">
              <span className="tabular-nums text-gray-400 mr-1.5">{hit.number}</span>
              {hit.title}
            </span>
            <span className="block text-xs text-gray-500 truncate">
              {hit.bookName}
              {hit.match === "lyrics" && ` · ${t.quickSearch.inLyrics}`}
            </span>
          </span>
          {hit.hasSyncedLyrics ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-600/20 text-purple-300 border border-purple-600/40">
              {t.quickSearch.karaoke}
            </span>
          ) : hit.hasMP3 ? (
            <MusicNoteIcon className="w-4 h-4 text-gray-500" />
          ) : null}
        </>
      );
    case "reference":
      return (
        <>
          <BibleIcon className={icon} />
          <span className="flex-1 min-w-0 text-sm truncate">
            {hit.bookName} {hit.chapter}
            {hit.verseGiven &&
              `:${hit.startVerse}${hit.endVerse > hit.startVerse ? `-${hit.endVerse}` : ""}`}
          </span>
        </>
      );
    case "verse":
      return (
        <>
          <BibleIcon className={icon} />
          <span className="flex-1 min-w-0">
            <span className="block text-sm">
              {hit.bookName} {hit.chapter}:{hit.verse}
            </span>
            <span className="block text-xs text-gray-400 line-clamp-2">{hit.text}</span>
          </span>
        </>
      );
    default: {
      const Icon = { video: VideoIcon, audio: AudioIcon, image: ImageIcon, playlist: QueueListIcon }[
        hit.kind
      ];
      const kindLabel = {
        video: t.stage.layerVideo,
        audio: t.stage.layerAudio,
        image: t.stage.layerImage,
        playlist: t.quickSearch.playlist,
      }[hit.kind];
      return (
        <>
          <Icon className={icon} />
          <span className="flex-1 min-w-0">
            <span className="block text-sm truncate">{hit.name}</span>
            <span className="block text-xs text-gray-500">{kindLabel}</span>
          </span>
        </>
      );
    }
  }
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 font-sans">{keys}</kbd>
      {label}
    </span>
  );
}
