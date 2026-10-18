import { useState } from "react";
import { CheckIcon } from "../../components/icons/ui";
import { formatFileSize } from "../../../shared/utils";
import type { Translations } from "../../../shared/i18n";
import type { MP3CacheStats } from "../../../shared/types";
import { useStorageStats } from "../../hooks/useStorageStats";
import { SettingRow, SettingsGroup } from "./SettingRow";
import type { SectionProps } from "./types";

/** Rough size of one instrumental, for the "Download all" confirmation. */
const ESTIMATED_MP3_BYTES = 4 * 1024 * 1024;

const buttonBase =
  "px-4 py-2 rounded-lg text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

export function StorageSection(props: SectionProps) {
  return (
    <>
      <SpaceUsedGroup mp3CacheStats={props.mp3CacheStats} t={props.t} />
      <InstrumentalsGroup {...props} />
    </>
  );
}

/**
 * What each kind of media takes up, and — on installs that predate moving
 * transfers into libraries — a one-tap clean-up of the copies that left.
 */
function SpaceUsedGroup({ mp3CacheStats, t }: { mp3CacheStats: MP3CacheStats; t: Translations }) {
  const { stats, deleteSpareTransfers } = useStorageStats();
  const [confirming, setConfirming] = useState(false);

  const rows = stats
    ? [
        { label: t.settings.storageVideos, bytes: stats.videos.bytes },
        { label: t.settings.storageAudio, bytes: stats.audio.bytes },
        { label: t.settings.storageImages, bytes: stats.images.bytes },
        { label: t.settings.storageTransfers, bytes: stats.transfers.bytes },
        { label: t.settings.instrumentalsTitle, bytes: mp3CacheStats.sizeBytes },
      ]
    : [];
  const total = rows.reduce((sum, row) => sum + row.bytes, 0);
  const largest = Math.max(1, ...rows.map((row) => row.bytes));
  const spares = stats?.spareTransfers;

  return (
    <SettingsGroup>
      <SettingRow id="storageUsage" label={t.settings.storageUsageTitle} hint={t.settings.storageUsageHint}>
        {!stats ? (
          <p className="text-sm text-gray-500">{t.settings.storageLoading}</p>
        ) : (
          <dl className="space-y-2 text-sm">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <dt className="w-32 sm:w-40 flex-shrink-0 truncate text-gray-300">{row.label}</dt>
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400/70 rounded-full"
                    style={{ width: `${(row.bytes / largest) * 100}%` }}
                  />
                </div>
                <dd className="w-20 flex-shrink-0 text-right tabular-nums text-gray-400">
                  {formatFileSize(row.bytes)}
                </dd>
              </div>
            ))}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-700/50">
              <dt className="flex-1 font-medium text-gray-200">{t.settings.storageTotal}</dt>
              <dd className="w-20 flex-shrink-0 text-right tabular-nums font-medium text-gray-200">
                {formatFileSize(total)}
              </dd>
            </div>
          </dl>
        )}
      </SettingRow>

      {spares && spares.count > 0 && (
        <SettingRow id="spareCopies" label={t.settings.spareCopiesTitle} hint={t.settings.spareCopiesHint}>
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-gray-300">{t.settings.spareCopiesConfirm}</span>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  deleteSpareTransfers();
                }}
                className={`${buttonBase} bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/40`}
              >
                {t.settings.spareCopiesDelete}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className={`${buttonBase} bg-gray-600/20 text-gray-300 hover:bg-gray-600/30 border border-gray-600/40`}
              >
                {t.settings.spareCopiesCancel}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={`${buttonBase} bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40`}
            >
              {t.settings.spareCopiesFree.replace("{size}", formatFileSize(spares.bytes))}
            </button>
          )}
        </SettingRow>
      )}
    </SettingsGroup>
  );
}

function InstrumentalsGroup({
  mp3CacheStats,
  mp3Downloads,
  onDownloadAllHymnMP3s,
  onCancelAllHymnMP3Downloads,
  onClearHymnMP3Cache,
  t,
}: SectionProps) {
  // One inline confirmation at a time, never a browser dialog.
  const [confirming, setConfirming] = useState<"download" | "clear" | null>(null);

  const inFlight = mp3Downloads.some((d) => d.status === "downloading" || d.status === "queued");
  const missing = Math.max(0, mp3CacheStats.availableCount - mp3CacheStats.count);

  const confirmation =
    confirming === "download"
      ? {
          message: t.karaoke.downloadAllConfirm.replace(
            "{size}",
            formatFileSize(missing * ESTIMATED_MP3_BYTES),
          ),
          confirm: t.karaoke.downloadAll,
          tone: "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40",
          run: onDownloadAllHymnMP3s,
        }
      : confirming === "clear"
        ? {
            message: t.karaoke.clearCacheConfirm,
            confirm: t.karaoke.clearCache,
            tone: "bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/40",
            run: onClearHymnMP3Cache,
          }
        : null;

  return (
    <SettingsGroup>
      <SettingRow
        id="instrumentalDownloads"
        label={t.settings.instrumentalsTitle}
        hint={t.settings.instrumentalsHint}
      >
        {mp3CacheStats.availableCount === 0 ? (
          <p className="text-sm text-gray-500">{t.settings.noInstrumentals}</p>
        ) : (
          <>
            <div className="text-sm text-gray-300 mb-3">
              {t.karaoke.cacheStats
                .replace("{count}", String(mp3CacheStats.count))
                .replace("{total}", String(mp3CacheStats.availableCount))
                .replace("{size}", formatFileSize(mp3CacheStats.sizeBytes))}
            </div>

            {confirmation ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-gray-300">{confirmation.message}</span>
                <button
                  type="button"
                  onClick={() => {
                    confirmation.run();
                    setConfirming(null);
                  }}
                  className={`${buttonBase} ${confirmation.tone}`}
                >
                  {confirmation.confirm}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className={`${buttonBase} bg-gray-600/20 text-gray-300 hover:bg-gray-600/30 border border-gray-600/40`}
                >
                  {t.karaoke.cancelDownload}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {missing > 0 && !inFlight && (
                  <button
                    type="button"
                    onClick={() => setConfirming("download")}
                    className={`${buttonBase} bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40`}
                  >
                    {t.karaoke.downloadAll}
                  </button>
                )}
                {inFlight && (
                  <button
                    type="button"
                    onClick={onCancelAllHymnMP3Downloads}
                    className={`${buttonBase} bg-gray-600/20 text-gray-300 hover:bg-gray-600/30 border border-gray-600/40`}
                  >
                    {t.karaoke.cancelAll}
                  </button>
                )}
                {mp3CacheStats.count > 0 && !inFlight && (
                  <button
                    type="button"
                    onClick={() => setConfirming("clear")}
                    className={`${buttonBase} bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/40`}
                  >
                    {t.karaoke.clearCache}
                  </button>
                )}
              </div>
            )}

            {mp3Downloads.length > 0 && (
              <div className="mt-4 space-y-1 max-h-64 overflow-y-auto pr-2">
                {mp3Downloads
                  .slice()
                  .sort((a, b) => a.hymnNumber.localeCompare(b.hymnNumber))
                  .map((d) => {
                    const pct =
                      d.bytesTotal > 0 ? Math.min(100, (d.bytesDownloaded / d.bytesTotal) * 100) : 0;
                    const isDone = d.status === "complete";
                    const isError = d.status === "error";
                    const isCancelled = d.status === "cancelled";
                    return (
                      <div key={d.id} className="flex items-center gap-3 text-xs">
                        <span className="font-mono w-10 text-gray-400">{d.hymnNumber}</span>
                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              isError
                                ? "bg-red-400"
                                : isCancelled
                                  ? "bg-gray-500"
                                  : isDone
                                    ? "bg-green-400"
                                    : "bg-blue-400/80"
                            }`}
                            style={{ width: isDone || isError ? "100%" : `${pct}%` }}
                          />
                        </div>
                        <span className="w-20 text-right text-gray-500 flex items-center justify-end">
                          {d.status === "queued" && t.karaoke.statusQueued}
                          {isError && t.karaoke.errorDownload}
                          {isCancelled && t.karaoke.statusCancelled}
                          {isDone && <CheckIcon className="w-3.5 h-3.5 text-green-400" />}
                          {d.status === "downloading" && `${Math.round(pct)}%`}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </>
        )}
      </SettingRow>
    </SettingsGroup>
  );
}
