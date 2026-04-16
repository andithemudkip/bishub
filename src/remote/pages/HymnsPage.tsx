import { useState, useEffect, useMemo, useRef } from "react";
import { useFocusSearch } from "../hooks/useFocusSearch";
import type {
  Hymn,
  TextState,
  AudioState,
  AppSettings,
  MP3DownloadProgress,
  MP3CacheStats,
} from "../../shared/types";
import { getTranslations } from "../../shared/i18n";
import { normalizeForSearch, formatDuration } from "../../shared/utils";
import {
  CloseIcon,
  PlayIcon,
  PauseIcon,
  MusicNoteIcon,
  CloudDownloadIcon,
} from "../components/icons/ui";
import { StatusBanner } from "../components/ui/Card";

interface Props {
  textState: TextState;
  isTextMode: boolean;
  hymns: Hymn[];
  onLoadHymn: (hymnNumber: string, synced?: boolean) => void;
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
  onLoadHymn,
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  const t = getTranslations(settings.language);

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

  const handleSelectHymn = (hymn: Hymn) => {
    onLoadHymn(hymn.number);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && filteredHymns.length > 0) {
      onLoadHymn(filteredHymns[0].number);
      e.currentTarget.blur();
    }
  };

  const isCurrentHymn = (hymn: Hymn) => {
    return textState.title.startsWith(`${hymn.number}.`);
  };

  const isSynced = !!textState.syncedLyrics;
  // Extract hymn number from title (e.g., "1. Title" → "1")
  const currentHymnNumber = textState.title.split(".")[0]?.trim() ?? "";
  const currentHymnHasSynced =
    hymns.find((h) => h.number === currentHymnNumber)?.syncedAvailability ===
    "cached";

  const showKaraokeBanner =
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
      {/* Search */}
      <div className="sticky -top-4 bg-gray-900 pb-4 pt-4 -mx-4 px-4">
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
      </div>

      {/* Current hymn indicator */}
      {isTextMode && textState.slides.length > 0 && !isSynced && (
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
            {currentHymnHasSynced && (
              <button
                onClick={() => onLoadHymn(currentHymnNumber, true)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-600/40"
              >
                {t.hymns.switchToSynced}
              </button>
            )}
          </div>
        </StatusBanner>
      )}

      {/* Synced hymn playback controls */}
      {isTextMode && isSynced && (
        <StatusBanner color="green">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-green-400 mb-1">
                {t.hymns.nowPlaying}
              </div>
              <div className="font-semibold">{textState.title}</div>
            </div>
            <button
              onClick={() => onLoadHymn(currentHymnNumber, false)}
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
        {filteredHymns.map((hymn) => {
          const padded = hymn.number.padStart(3, "0");
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
              key={hymn.number}
              className={`relative rounded-xl border transition-colors ${
                isCurrentHymn(hymn)
                  ? "border-blue-500/50 bg-blue-950/30"
                  : "border-gray-700/50 bg-gray-800/50 hover:border-gray-600/50 hover:bg-gray-700/50"
              }`}
            >
              <button
                type="button"
                onClick={() => handleSelectHymn(hymn)}
                className="w-full text-left px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-sm font-bold ${
                      isCurrentHymn(hymn) ? "text-blue-300" : "text-blue-400"
                    }`}
                  >
                    {hymn.number}
                  </span>
                  <span className="text-gray-600">·</span>
                  <span className="font-medium truncate">{hymn.title}</span>
                  <span className="ml-auto flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-500">
                      {hymn.verses.length}
                      {hymn.verses.length === 1
                        ? ` ${t.hymns.verse}`
                        : ` ${t.hymns.verses}`}
                      {hymn.chorus && ` + ${t.hymns.chorus}`}
                    </span>
                    {hymn.syncedAvailability === "cached" && (
                      <>
                        <span className="text-gray-600">·</span>
                        <MusicNoteIcon className="w-3.5 h-3.5 text-gray-500" />
                      </>
                    )}
                    {hymn.syncedAvailability === "ttml-only" && (
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
              {hymn.syncedAvailability === "ttml-only" && (
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

        {filteredHymns.length === 0 && searchQuery && (
          <div className="text-center py-8 text-gray-400">
            {t.hymns.noHymnsFound} "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}
