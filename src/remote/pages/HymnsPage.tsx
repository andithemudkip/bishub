import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useFocusSearch } from "../hooks/useFocusSearch";
import type {
  Hymn,
  HymnSearchResult,
  TextState,
  AudioState,
  AppSettings,
  MP3DownloadProgress,
  MP3CacheStats,
  HymnPlaybackMode,
} from "../../shared/types";
import { getTranslations } from "../../shared/i18n";
import { normalizeForSearch, formatDuration, summarizeHymn } from "../../shared/utils";
import {
  CloseIcon,
  PlayIcon,
  PauseIcon,
  MusicNoteIcon,
  CloudDownloadIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "../components/icons/ui";
import { StatusBanner } from "../components/ui/Card";
import {
  HYMNALS,
  getHymnalBySlug,
  getHymnalsForLanguage,
} from "../../shared/hymnals";

const HYMNAL_COUNT = HYMNALS.length;

interface Props {
  textState: TextState;
  isTextMode: boolean;
  hymns: Hymn[];
  hymnsSlug: string;
  onLoadHymn: (
    slug: string,
    hymnNumber: string,
    playbackMode?: HymnPlaybackMode,
  ) => void;
  onSelectHymnal: (slug: string) => void;
  onSearchAllHymns: (query: string) => Promise<HymnSearchResult[]>;
  settings: AppSettings;
  audioState: AudioState;
  onPlayAudio: () => void;
  onPauseAudio: () => void;
  onSeekAudio: (time: number) => void;
  mp3Downloads: MP3DownloadProgress[];
  mp3CacheStats: MP3CacheStats;
  onDownloadHymnMP3: (hymnNumber: string) => void;
  onDismissKaraokeBanner: () => void;
  onOpenKaraokeSettings: () => void;
}

export default function HymnsPage({
  textState,
  isTextMode,
  hymns,
  hymnsSlug,
  onLoadHymn,
  onSelectHymnal,
  onSearchAllHymns,
  settings,
  audioState,
  onPlayAudio,
  onPauseAudio,
  onSeekAudio,
  mp3Downloads,
  mp3CacheStats,
  onDownloadHymnMP3,
  onDismissKaraokeBanner,
  onOpenKaraokeSettings,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredHymns, setFilteredHymns] = useState<Hymn[]>([]);
  const [searchAllBooks, setSearchAllBooks] = useState(false);
  const [allBookResults, setAllBookResults] = useState<HymnSearchResult[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const t = getTranslations(settings.language);

  // Pills cover the books sharing a language with the selected one, so the row
  // stays short (Romanian has six, the others one). Switching to another
  // language's hymnal happens in Settings, which lists all of them.
  const hymnals = useMemo(() => {
    const current = getHymnalBySlug(settings.hymnal);
    return getHymnalsForLanguage(current?.language ?? settings.language);
  }, [settings.hymnal, settings.language]);

  // F5 focus event
  useFocusSearch(searchInputRef);

  // Pre-compute normalized titles for faster searching
  const hymnsWithNormalizedTitles = useMemo(() => {
    return hymns.map((h) => ({
      hymn: h,
      normalizedTitle: normalizeForSearch(h.title),
    }));
  }, [hymns]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredHymns(hymns.slice(0, 30));
      return;
    }

    const normalizedQuery = normalizeForSearch(searchQuery);

    // Split query into words for multi-word matching
    const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);

    const filtered = hymnsWithNormalizedTitles
      .filter(({ hymn, normalizedTitle }) => {
        // Check if it's a number search
        if (hymn.number.includes(searchQuery.trim())) {
          return true;
        }

        // Check if all query words appear in the title
        return queryWords.every((word) => normalizedTitle.includes(word));
      })
      .map(({ hymn }) => hymn)
      .slice(0, 30);

    setFilteredHymns(filtered);
  }, [searchQuery, hymns, hymnsWithNormalizedTitles]);

  // Cross-book search has to round-trip to the main process (the renderer only
  // holds one book), so debounce it rather than firing per keystroke.
  useEffect(() => {
    if (!searchAllBooks || !searchQuery.trim()) {
      setAllBookResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      onSearchAllHymns(searchQuery).then((results) => {
        if (!cancelled) setAllBookResults(results);
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, searchAllBooks, onSearchAllHymns]);

  const showingAllBooks = searchAllBooks && !!searchQuery.trim();

  // The book strip scrolls sideways rather than wrapping — six Romanian books
  // wrap to three ragged rows on a phone. Edge fades stand in for the hidden
  // scrollbar so it's obvious there's more to swipe to.
  const pillsRef = useRef<HTMLDivElement>(null);
  const [pillFade, setPillFade] = useState({ left: false, right: false });

  const updatePillFade = useCallback(() => {
    const el = pillsRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setPillFade({ left: el.scrollLeft > 1, right: el.scrollLeft < max - 1 });
  }, []);

  useEffect(() => {
    const el = pillsRef.current;
    if (!el) return;
    updatePillFade();
    const observer = new ResizeObserver(updatePillFade);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updatePillFade, hymnals.length]);

  const scrollPills = useCallback((direction: -1 | 1) => {
    const el = pillsRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }, []);

  // Keep the selected book on screen when it changes from elsewhere (Settings,
  // or another remote switching books).
  useEffect(() => {
    pillsRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [hymnsSlug]);

  // Rows carry their own book so the same markup renders both scopes.
  const rows: { book: string; hymn: Hymn }[] = showingAllBooks
    ? allBookResults.map((r) => ({ book: r.book, hymn: r.hymn }))
    : filteredHymns.map((hymn) => ({ book: hymnsSlug, hymn }));

  const handleSelectHymn = (book: string, hymn: Hymn) => {
    onLoadHymn(book, hymn.number);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      e.key === "Enter" &&
      (showingAllBooks ? allBookResults.length > 0 : filteredHymns.length > 0)
    ) {
      if (showingAllBooks) {
        const first = allBookResults[0];
        if (first) onLoadHymn(first.book, first.hymn.number);
      } else {
        onLoadHymn(settings.hymnal, filteredHymns[0].number);
      }
      e.currentTarget.blur();
    }
  };

  // Hymn numbers repeat across books, so identity is (book, number) taken from
  // state — matching on the rendered title would light up #1 in every hymnal.
  const isCurrentHymn = (book: string, hymn: Hymn) =>
    textState.hymnRef?.book === book &&
    textState.hymnRef?.number === hymn.number;

  const isSynced = !!textState.syncedLyrics;
  // Karaoke and instrumental both hang a track off the hymn; only karaoke ties
  // the slides to it, so the transport bar is shared but the slide counter and
  // the seek-on-next behaviour are not.
  const hasHymnAudio = audioState.role === "hymn" && !!audioState.src;

  // Only meaningful when the hymn on screen belongs to the book being browsed;
  // otherwise this would match a same-numbered hymn in a different hymnal.
  const currentHymn =
    textState.hymnRef?.book === hymnsSlug
      ? hymns.find((h) => h.number === textState.hymnRef?.number)
      : undefined;
  // The one-off override offered on a silent hymn. Keyed off the assets alone —
  // it stays available with the settings switched off, which is the whole point
  // of an override — and names the mode explicitly so the button can't promise
  // karaoke and deliver an instrumental.
  const audioOverride: HymnPlaybackMode | null =
    currentHymn?.audioAvailability !== "cached"
      ? null
      : currentHymn.hasSyncedLyrics
        ? "synced"
        : "instrumental";

  // Karaoke assets exist for one book only, so don't advertise them elsewhere.
  const bookHasKaraoke = !!getHymnalBySlug(hymnsSlug)?.karaoke;
  const showKaraokeBanner =
    bookHasKaraoke &&
    !settings.karaokeBannerDismissed &&
    mp3CacheStats.availableCount > 0 &&
    mp3CacheStats.count === 0;

  const downloadsByHymn = useMemo(() => {
    const map = new Map<string, MP3DownloadProgress>();
    for (const d of mp3Downloads) map.set(d.id, d);
    return map;
  }, [mp3Downloads]);
  const progress =
    audioState.duration > 0
      ? (audioState.currentTime / audioState.duration) * 100
      : 0;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    onSeekAudio(percent * audioState.duration);
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto w-full">
      {/* Search + book selector */}
      <div className="sticky -top-4 bg-gray-900 pb-4 pt-4 -mx-4 px-4 z-10 space-y-3">
        {hymnals.length > 1 && (
          <div className="relative">
            <div
              ref={pillsRef}
              onScroll={updatePillFade}
              className="flex flex-nowrap gap-1 bg-gray-900/50 border border-gray-700/50 rounded-lg p-1 overflow-x-auto no-scrollbar"
              role="group"
              aria-label={t.hymns.hymnal}
            >
              {hymnals.map((hymnal) => {
                const active = hymnal.slug === hymnsSlug;
                return (
                  <button
                    key={hymnal.slug}
                    type="button"
                    onClick={() => onSelectHymnal(hymnal.slug)}
                    aria-pressed={active}
                    data-active={active}
                    title={hymnal.name}
                    className={`flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none ${
                      active
                        ? "bg-blue-600/20 text-blue-400 border border-blue-600/40"
                        : "text-gray-400 hover:text-white hover:bg-gray-700/50 border border-transparent"
                    }`}
                  >
                    {hymnal.shortName}
                  </button>
                );
              })}
            </div>
            {/* A bare gradient isn't enough: when the last visible pill ends
                flush with the edge the fade covers empty background and reads
                as a plain border. The chevron says "there's more" at any width,
                and scrolls a page when clicked. */}
            {pillFade.left && (
              <button
                type="button"
                onClick={() => scrollPills(-1)}
                aria-label={t.hymns.scrollBooksLeft}
                className="absolute inset-y-px left-px flex items-center pl-1 pr-4 rounded-l-lg bg-gradient-to-r from-gray-900 via-gray-900/90 to-transparent text-gray-400 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
            )}
            {pillFade.right && (
              <button
                type="button"
                onClick={() => scrollPills(1)}
                aria-label={t.hymns.scrollBooksRight}
                className="absolute inset-y-px right-px flex items-center pr-1 pl-4 rounded-r-lg bg-gradient-to-l from-gray-900 via-gray-900/90 to-transparent text-gray-400 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.hymns.searchPlaceholder}
            className="w-full px-4 py-3 pr-10 bg-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <CloseIcon />
            </button>
          )}
        </div>

        {HYMNAL_COUNT > 1 && searchQuery.trim() && (
          <div className="flex items-center gap-1 bg-gray-900/50 border border-gray-700/50 rounded-lg overflow-hidden p-1 w-fit">
            {[false, true].map((all) => (
              <button
                key={String(all)}
                type="button"
                onClick={() => setSearchAllBooks(all)}
                aria-pressed={searchAllBooks === all}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none ${
                  searchAllBooks === all
                    ? "bg-blue-600/20 text-blue-400 border border-blue-600/40"
                    : "text-gray-400 hover:text-white hover:bg-gray-700/50 border border-transparent"
                }`}
              >
                {all
                  ? t.hymns.allHymnals
                  : (getHymnalBySlug(hymnsSlug)?.shortName ?? t.hymns.hymnal)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Current hymn indicator */}
      {isTextMode && textState.slides.length > 0 && !hasHymnAudio && (
        <StatusBanner>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-blue-400 mb-1">
                {t.hymns.nowDisplaying}
              </div>
              <div className="font-semibold">{textState.title}</div>
              <div className="text-sm text-gray-400 mt-1">
                {t.hymns.slide} {textState.currentSlide + 1} {t.hymns.of}{" "}
                {textState.slides.length}
              </div>
            </div>
            {audioOverride && (
              <button
                onClick={() =>
                  textState.hymnRef &&
                  onLoadHymn(
                    textState.hymnRef.book,
                    textState.hymnRef.number,
                    audioOverride,
                  )
                }
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-600/40"
              >
                {audioOverride === "synced"
                  ? t.hymns.switchToSynced
                  : t.hymns.playInstrumental}
              </button>
            )}
          </div>
        </StatusBanner>
      )}

      {/* Hymn audio playback controls — karaoke and instrumental alike */}
      {isTextMode && hasHymnAudio && (
        <StatusBanner color="green">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-green-400 mb-1">
                {t.hymns.nowPlaying}
              </div>
              <div className="font-semibold">{textState.title}</div>
              {/* Karaoke drives the slides itself; an instrumental leaves them
                  to the operator, so they still need the counter. */}
              {!isSynced && textState.slides.length > 0 && (
                <div className="text-sm text-gray-400 mt-1">
                  {t.hymns.slide} {textState.currentSlide + 1} {t.hymns.of}{" "}
                  {textState.slides.length}
                </div>
              )}
            </div>
            <button
              onClick={() =>
                textState.hymnRef &&
                onLoadHymn(
                  textState.hymnRef.book,
                  textState.hymnRef.number,
                  "static",
                )
              }
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-600/20 text-gray-400 hover:bg-gray-600/30 border border-gray-600/40"
            >
              {t.hymns.switchToStatic}
            </button>
          </div>

          {/* Progress bar */}
          <div
            className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden cursor-pointer"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-green-400/80 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Time + controls */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">
              {formatDuration(audioState.currentTime)}
            </span>

            <button
              onClick={audioState.playing ? onPauseAudio : onPlayAudio}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-600/40"
            >
              {audioState.playing ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
            </button>

            <span className="text-xs text-gray-400">
              {formatDuration(audioState.duration)}
            </span>
          </div>
        </StatusBanner>
      )}

      {showKaraokeBanner && (
        <StatusBanner color="blue">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">{t.karaoke.bannerText}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenKaraokeSettings}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40"
              >
                {t.karaoke.bannerOpenSettings}
              </button>
              <button
                onClick={onDismissKaraokeBanner}
                className="text-xs text-blue-300/80 hover:text-blue-200 underline whitespace-nowrap"
              >
                {t.karaoke.bannerDismiss}
              </button>
            </div>
          </div>
        </StatusBanner>
      )}

      <div className="grid gap-2">
        {rows.map(({ book, hymn }) => {
          const padded = hymn.number.padStart(3, "0");
          const { verseCount, hasChorus } = summarizeHymn(hymn);
          const download = downloadsByHymn.get(padded);
          const isDownloading =
            download?.status === "downloading" || download?.status === "queued";
          const downloadPct =
            download && download.bytesTotal > 0
              ? Math.min(
                  100,
                  (download.bytesDownloaded / download.bytesTotal) * 100,
                )
              : 0;

          return (
            <div
              key={`${book}:${hymn.number}`}
              className={`relative rounded-xl border transition-colors ${
                isCurrentHymn(book, hymn)
                  ? "border-blue-500/50 bg-blue-950/30"
                  : "border-gray-700/50 bg-gray-800/50 hover:border-gray-600/50 hover:bg-gray-700/50"
              }`}
            >
              <button
                type="button"
                onClick={() => handleSelectHymn(book, hymn)}
                className="w-full text-left px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-sm font-bold ${
                      isCurrentHymn(book, hymn) ? "text-blue-300" : "text-blue-400"
                    }`}
                  >
                    {hymn.number}
                  </span>
                  <span className="text-gray-600">·</span>
                  <span className="font-medium truncate min-w-0 flex-1">
                    {hymn.title}
                  </span>
                  {showingAllBooks && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-700/60 text-gray-300">
                      {getHymnalBySlug(book)?.shortName ?? book}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-2 flex-shrink-0">
                    <span className="hidden sm:inline text-xs text-gray-500">
                      {verseCount}
                      {verseCount === 1
                        ? ` ${t.hymns.verse}`
                        : ` ${t.hymns.verses}`}
                      {hasChorus && ` + ${t.hymns.chorus}`}
                    </span>
                    {hymn.audioAvailability === "cached" && (
                      <>
                        <span className="text-gray-600">·</span>
                        {/* Green marks the ones that will sing along by
                            themselves; gray is instrumental-only. */}
                        <MusicNoteIcon
                          className={`w-3.5 h-3.5 ${
                            hymn.hasSyncedLyrics
                              ? "text-green-500/70"
                              : "text-gray-500"
                          }`}
                        />
                      </>
                    )}
                    {hymn.audioAvailability === "downloadable" && (
                      // Spacer reserves room for the absolute-positioned
                      // download button — it sits outside this <button> to
                      // avoid invalid nested interactive content.
                      <span className="w-6" aria-hidden />
                    )}
                  </span>
                </div>
                {isDownloading && (
                  <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400/80 transition-all"
                      style={{ width: `${downloadPct}%` }}
                    />
                  </div>
                )}
                {download?.status === "error" && (
                  <div className="mt-1 text-xs text-red-400">
                    {download.error || t.karaoke.errorDownload}
                  </div>
                )}
              </button>
              {hymn.audioAvailability === "downloadable" && (
                <button
                  type="button"
                  onClick={() => onDownloadHymnMP3(hymn.number)}
                  title={t.karaoke.downloadButton}
                  className={`absolute right-3 top-3 p-1 rounded transition-colors ${
                    isDownloading
                      ? "text-blue-400"
                      : "text-gray-500 hover:text-blue-400"
                  }`}
                >
                  <CloudDownloadIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}

        {rows.length === 0 && searchQuery && (
          <div className="text-center py-8 text-gray-400">
            {t.hymns.noHymnsFound} "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}
