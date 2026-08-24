import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card } from "../components/ui/Card";
import { Select } from "../components/ui/Select";
import { PositionPicker } from "../components/ui/PositionPicker";
import { MonitorPicker } from "../components/ui/MonitorPicker";
import { renderTip } from "../components/ui/renderTip";
import type {
  MonitorInfo,
  AppSettings,
  IdleState,
  ClockPosition,
  AudioWidgetPosition,
  UpdateStatus,
  MP3CacheStats,
  MP3DownloadProgress,
  BinaryInfo,
  DeviceInfo,
} from "../../shared/types";
import { formatFileSize, formatTimeAgo } from "../../shared/utils";
import { CheckIcon } from "../components/icons/ui";
import {
  getTranslations,
  LANGUAGE_NAMES,
  AVAILABLE_LANGUAGES,
  type Language,
} from "../../shared/i18n";
import { SHORTCUTS } from "../../shared/shortcuts";
import { getTranslationsByLanguage } from "../../shared/bibleTranslations";
import { BibleTranslationPicker } from "../components/ui/BibleTranslationPicker";
import { HYMNALS } from "../../shared/hymnals";

interface BibleDownloadStatus {
  translationId: string;
  status: "downloading" | "ready" | "error";
  progress?: number;
  error?: string;
}

function DeviceRow({
  device,
  online,
  onRename,
  onRevoke,
  t,
}: {
  device: DeviceInfo;
  online: boolean;
  onRename: (name: string) => void;
  onRevoke: () => void;
  t: ReturnType<typeof getTranslations>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(device.name);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  useEffect(() => {
    setDraft(device.name);
  }, [device.name]);

  const commitRename = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== device.name) {
      onRename(trimmed);
    } else {
      setDraft(device.name);
    }
  };

  return (
    <div className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3 flex items-center gap-3">
      <span
        className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
          online ? "bg-green-400" : "bg-gray-500"
        }`}
        aria-label={online ? t.devices.online : t.devices.offline}
        title={online ? t.devices.online : t.devices.offline}
      />
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            type="text"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraft(device.name);
                setEditing(false);
              }
            }}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-left w-full truncate text-white hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            title={t.devices.renameHint}
          >
            {device.name}
          </button>
        )}
        <div className="text-xs text-gray-500 mt-0.5">
          {t.devices.lastSeen}{" "}
          {formatTimeAgo(device.lastSeenAt, t.common)}
        </div>
      </div>
      {confirmRevoke ? (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-300 hidden sm:inline">
            {t.devices.revokeConfirm}
          </span>
          <button
            type="button"
            onClick={() => {
              setConfirmRevoke(false);
              onRevoke();
            }}
            className="px-2 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/40"
          >
            {t.devices.revoke}
          </button>
          <button
            type="button"
            onClick={() => setConfirmRevoke(false)}
            className="px-2 py-1 rounded bg-gray-600/20 text-gray-300 hover:bg-gray-600/30 border border-gray-600/40"
          >
            {t.devices.revokeCancel}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmRevoke(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/40 flex-shrink-0"
        >
          {t.devices.revoke}
        </button>
      )}
    </div>
  );
}

interface Props {
  monitors: MonitorInfo[];
  settings: AppSettings;
  idleState: IdleState;
  videoVolume: number;
  audioVolume: number;
  onSetLanguage: (language: Language) => void;
  onSetBibleTranslation: (translationId: string) => void;
  onSetHymnal: (slug: string) => void;
  bibleDownloadStatus: BibleDownloadStatus | null;
  downloadedTranslations: string[];
  onSetWallpaper: (selectNew?: boolean) => Promise<string | null>;
  onSetClockFontSize: (size: number) => void;
  onSetClockPosition: (position: ClockPosition) => void;
  onSetAudioWidgetPosition: (position: AudioWidgetPosition) => void;
  onSetVolume: (volume: number) => void;
  onSetAudioVolume: (volume: number) => void;
  onSetSyncedLyrics: (enabled: boolean) => void;
  onSetInstrumentals: (enabled: boolean) => void;
  onSetKaraokeTuning: (enabled: boolean) => void;
  onSetDisplayMonitor: (monitorId: number) => void;
  appVersion: string;
  updateStatus: UpdateStatus;
  onCheckForUpdates: () => void;
  mp3CacheStats: MP3CacheStats;
  mp3Downloads: MP3DownloadProgress[];
  onDownloadAllHymnMP3s: () => void;
  onCancelAllHymnMP3Downloads: () => void;
  onClearHymnMP3Cache: () => void;
  devices: DeviceInfo[];
  connectedDeviceIds: string[];
  onRenameDevice: (deviceId: string, name: string) => void;
  onRevokeDevice: (deviceId: string) => void;
}

export default function SettingsPage({
  monitors,
  settings,
  idleState,
  videoVolume,
  audioVolume,
  onSetLanguage,
  onSetBibleTranslation,
  onSetHymnal,
  bibleDownloadStatus,
  downloadedTranslations,
  onSetWallpaper,
  onSetClockFontSize,
  onSetClockPosition,
  onSetAudioWidgetPosition,
  onSetVolume,
  onSetAudioVolume,
  onSetSyncedLyrics,
  onSetInstrumentals,
  onSetKaraokeTuning,
  onSetDisplayMonitor,
  appVersion,
  updateStatus,
  onCheckForUpdates,
  mp3CacheStats,
  mp3Downloads,
  onDownloadAllHymnMP3s,
  onCancelAllHymnMP3Downloads,
  onClearHymnMP3Cache,
  devices,
  connectedDeviceIds,
  onRenameDevice,
  onRevokeDevice,
}: Props) {
  const [localIP, setLocalIP] = useState<string>("...");
  const [securityKey, setSecurityKey] = useState<string>("...");
  const [openOnStartup, setOpenOnStartup] = useState<boolean>(false);
  const [confirmClearCache, setConfirmClearCache] = useState(false);
  const [binaryInfo, setBinaryInfo] = useState<BinaryInfo[] | null>(null);
  const t = getTranslations(settings.language);

  const isMP3DownloadInFlight = mp3Downloads.some(
    (d) => d.status === "downloading" || d.status === "queued",
  );
  const missingMP3Count = Math.max(
    0,
    mp3CacheStats.availableCount - mp3CacheStats.count,
  );
  const estimatedDownloadBytes = missingMP3Count * 4 * 1024 * 1024;
  const isElectron = !!window.electronAPI;

  useEffect(() => {
    if (isElectron) {
      window.electronAPI?.getLocalIP().then(setLocalIP);
      window.electronAPI?.getSecurityKey().then(setSecurityKey);
      window.electronAPI?.getOpenOnStartup().then(setOpenOnStartup);
      window.electronAPI?.getBinaryInfo?.().then(setBinaryInfo);
    }
  }, [isElectron]);

  const resolvedAutoMonitor =
    monitors.find((m) => !m.isPrimary) ?? monitors[0] ?? null;
  const selectedMonitor = monitors.find((m) => m.id === settings.displayMonitor);
  const monitorCaption =
    settings.displayMonitor === -1
      ? resolvedAutoMonitor
        ? `${t.settings.autoResolvedTo}${resolvedAutoMonitor.label || resolvedAutoMonitor.name}`
        : t.settings.selectMonitorHint
      : selectedMonitor
        ? selectedMonitor.label || selectedMonitor.name
        : t.settings.selectMonitorHint;

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSetLanguage(e.target.value as Language);
  };

  const translationGroups = getTranslationsByLanguage();

  const handleSelectWallpaper = async () => {
    await onSetWallpaper(true);
  };

  const handleClearWallpaper = async () => {
    await onSetWallpaper(false);
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSetClockFontSize(Number(e.target.value));
  };

  const handlePositionChange = (position: ClockPosition) => {
    onSetClockPosition(position);
  };

  const handleAudioWidgetPositionChange = (position: AudioWidgetPosition) => {
    onSetAudioWidgetPosition(position);
  };

  const handleVideoVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSetVolume(Number(e.target.value));
  };

  const handleAudioVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSetAudioVolume(Number(e.target.value));
  };

  const handleOpenOnStartupChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newValue = e.target.checked;
    setOpenOnStartup(newValue);
    await window.electronAPI?.setOpenOnStartup(newValue);
  };

  const getWallpaperFilename = (path: string | null): string => {
    if (!path) return t.settings.noWallpaper;
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || t.settings.noWallpaper;
  };

  const port = isElectron ? settings.serverPort : window.location.port;
  const remoteURL = `http://${localIP}:${port}/remote?key=${securityKey}`;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl mx-auto px-2 sm:px-0">
      {/* Language settings */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">{t.settings.language}</h2>

        <div>
          <Select
            value={settings.language}
            onChange={handleLanguageChange}
          >
            {AVAILABLE_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_NAMES[lang]}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Bible Translation */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">
          {t.settings.bibleTranslation}
        </h2>
        <BibleTranslationPicker
          value={settings.bibleTranslation}
          downloadedIds={downloadedTranslations}
          downloadStatus={bibleDownloadStatus}
          onChange={onSetBibleTranslation}
          translations={translationGroups}
        />
        {bibleDownloadStatus &&
          bibleDownloadStatus.status === "error" && (
            <div className="mt-2 text-sm text-red-400">
              {t.settings.bibleDownloadError}
            </div>
          )}
      </Card>

      {/* Hymnal — every book is bundled, so this is a plain grouped select */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">{t.hymns.hymnal}</h2>
        <Select
          value={settings.hymnal}
          onChange={(e) => onSetHymnal(e.target.value)}
        >
          {Array.from(new Set(HYMNALS.map((h) => h.languageName))).map(
            (languageName) => (
              <optgroup key={languageName} label={languageName}>
                {HYMNALS.filter((h) => h.languageName === languageName).map(
                  (hymnal) => (
                    <option key={hymnal.slug} value={hymnal.slug}>
                      {hymnal.name} ({hymnal.songCount})
                    </option>
                  ),
                )}
              </optgroup>
            ),
          )}
        </Select>
      </Card>

      {/* Open on startup - Electron only */}
      {isElectron && (
        <Card>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-lg font-semibold">
              {t.settings.openOnStartup}
            </span>
            <div className="relative">
              <input
                type="checkbox"
                checked={openOnStartup}
                onChange={handleOpenOnStartupChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </div>
          </label>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-semibold mb-4">
          {t.karaoke.sectionTitle}
        </h2>

        <label className="flex items-start justify-between cursor-pointer gap-4">
          <div className="flex-1 min-w-0">
            <div className="font-medium">{t.karaoke.defaultToggleLabel}</div>
            <p className="text-sm text-gray-400 mt-1">
              {t.karaoke.defaultToggleHint}
            </p>
          </div>
          <div className="relative flex-shrink-0 mt-1">
            <input
              type="checkbox"
              checked={settings.syncedLyrics}
              onChange={(e) => onSetSyncedLyrics(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </div>
        </label>

        <label className="flex items-start justify-between cursor-pointer gap-4 mt-5">
          <div className="flex-1 min-w-0">
            <div className="font-medium">
              {t.karaoke.instrumentalsToggleLabel}
            </div>
            <p className="text-sm text-gray-400 mt-1">
              {t.karaoke.instrumentalsToggleHint}
            </p>
          </div>
          <div className="relative flex-shrink-0 mt-1">
            <input
              type="checkbox"
              checked={settings.instrumentals}
              onChange={(e) => onSetInstrumentals(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </div>
        </label>

        <label className="flex items-start justify-between cursor-pointer gap-4 mt-5">
          <div className="flex-1 min-w-0">
            <div className="font-medium">{t.karaoke.tuningToggleLabel}</div>
            <p className="text-sm text-gray-400 mt-1">
              {t.karaoke.tuningToggleHint}
            </p>
          </div>
          <div className="relative flex-shrink-0 mt-1">
            <input
              type="checkbox"
              checked={settings.karaokeTuning}
              onChange={(e) => onSetKaraokeTuning(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </div>
        </label>

        {mp3CacheStats.availableCount > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-700/50">
            <div className="text-sm text-gray-300 mb-3">
              {t.karaoke.cacheStats
                .replace("{count}", String(mp3CacheStats.count))
                .replace("{total}", String(mp3CacheStats.availableCount))
                .replace("{size}", formatFileSize(mp3CacheStats.sizeBytes))}
            </div>

            <div className="flex flex-wrap gap-2">
            {missingMP3Count > 0 && !isMP3DownloadInFlight && (
              <button
                onClick={() => {
                  const msg = t.karaoke.downloadAllConfirm.replace(
                    "{size}",
                    formatFileSize(estimatedDownloadBytes),
                  );
                  if (window.confirm(msg)) {
                    onDownloadAllHymnMP3s();
                  }
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40"
              >
                {t.karaoke.downloadAll}
              </button>
            )}
            {isMP3DownloadInFlight && (
              <button
                onClick={onCancelAllHymnMP3Downloads}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-600/20 text-gray-300 hover:bg-gray-600/30 border border-gray-600/40"
              >
                {t.karaoke.cancelAll}
              </button>
            )}
            {mp3CacheStats.count > 0 && !isMP3DownloadInFlight && (
              <>
                {!confirmClearCache ? (
                  <button
                    onClick={() => setConfirmClearCache(true)}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/40"
                  >
                    {t.karaoke.clearCache}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-300">
                      {t.karaoke.clearCacheConfirm}
                    </span>
                    <button
                      onClick={() => {
                        onClearHymnMP3Cache();
                        setConfirmClearCache(false);
                      }}
                      className="px-3 py-1 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/40"
                    >
                      {t.karaoke.clearCache}
                    </button>
                    <button
                      onClick={() => setConfirmClearCache(false)}
                      className="px-3 py-1 rounded-lg bg-gray-600/20 text-gray-300 hover:bg-gray-600/30 border border-gray-600/40"
                    >
                      {t.karaoke.cancelDownload}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {mp3Downloads.length > 0 && (
            <div className="mt-4 space-y-1 max-h-64 overflow-y-auto pr-2">
              {mp3Downloads
                .slice()
                .sort((a, b) => a.hymnNumber.localeCompare(b.hymnNumber))
                .map((d) => {
                  const pct =
                    d.bytesTotal > 0
                      ? Math.min(
                          100,
                          (d.bytesDownloaded / d.bytesTotal) * 100,
                        )
                      : 0;
                  const isDone = d.status === "complete";
                  const isError = d.status === "error";
                  const isCancelled = d.status === "cancelled";
                  return (
                    <div
                      key={d.id}
                      className="flex items-center gap-3 text-xs"
                    >
                      <span className="font-mono w-10 text-gray-400">
                        {d.hymnNumber}
                      </span>
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
                          style={{
                            width: isDone || isError ? "100%" : `${pct}%`,
                          }}
                        />
                      </div>
                      <span className="w-20 text-right text-gray-500 flex items-center justify-end">
                        {d.status === "queued" && t.karaoke.statusQueued}
                        {isError && t.karaoke.errorDownload}
                        {isCancelled && t.karaoke.statusCancelled}
                        {isDone && (
                          <CheckIcon className="w-3.5 h-3.5 text-green-400" />
                        )}
                        {d.status === "downloading" && `${Math.round(pct)}%`}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
          </div>
        )}
      </Card>

      {/* Display settings */}
      <Card tip={renderTip(t.settings.displayTip)}>
        <h2 className="text-lg font-semibold mb-4">{t.settings.display}</h2>

        <div>
          <label className="text-sm text-gray-400 block mb-3">
            {t.settings.displayMonitor}
          </label>
          <MonitorPicker
            monitors={monitors}
            value={settings.displayMonitor}
            resolvedAutoId={resolvedAutoMonitor?.id ?? null}
            onChange={onSetDisplayMonitor}
            language={settings.language}
          />
          <div className="mt-3 flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-500">{monitorCaption}</span>
            {settings.displayMonitor !== -1 && (
              <button
                type="button"
                onClick={() => onSetDisplayMonitor(-1)}
                className="text-blue-400 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1"
              >
                {t.settings.resetToAuto}
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Idle screen settings - Electron only */}
      {/* {isElectron && ( */}
      <Card tip={renderTip(t.settings.idleScreenTip)}>
        <h2 className="text-lg font-semibold mb-4">{t.settings.idleScreen}</h2>
        <div className="space-y-4 sm:space-y-6">
          {/* Wallpaper */}
          {isElectron && (
            <div>
              <label className="text-sm text-gray-400 block mb-2">
                {t.settings.wallpaper}
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 px-4 py-3 bg-gray-700 rounded-lg text-gray-300 truncate">
                  {getWallpaperFilename(idleState.wallpaper)}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectWallpaper}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-medium transition-colors bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40"
                  >
                    {t.settings.selectWallpaper}
                  </button>
                  {idleState.wallpaper && (
                    <button
                      onClick={handleClearWallpaper}
                      className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm transition-colors bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
                    >
                      {t.settings.clearWallpaper}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Clock font size */}
          <div>
            <label className="text-sm text-gray-400 block mb-2">
              {t.settings.clockFontSize}: {idleState.clockFontSize}%
            </label>
            <input
              type="range"
              min="50"
              max="150"
              step="10"
              value={idleState.clockFontSize}
              onChange={handleFontSizeChange}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>50%</span>
              <span>100%</span>
              <span>150%</span>
            </div>
          </div>

          {/* Clock and audio widget positions */}
          <div className="flex flex-wrap items-end gap-4 sm:gap-8">
            <PositionPicker
              value={idleState.clockPosition}
              onChange={handlePositionChange}
              label={t.settings.clockPosition}
            />
            <PositionPicker
              value={idleState.audioWidgetPosition}
              onChange={handleAudioWidgetPositionChange}
              label={t.settings.audioWidgetPosition}
            />
          </div>
        </div>
      </Card>

      {/* Volume controls */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">
          {t.settings.volume || "Volume"}
        </h2>
        <div className="space-y-4 sm:space-y-6">
          {/* Video volume */}
          <div>
            <div className="text-sm text-gray-400 mb-2">
              {t.videoLibrary?.volume || "Video Volume"}
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={videoVolume}
                onChange={handleVideoVolumeChange}
                className="flex-1"
              />
              <span className="w-10 sm:w-12 text-right text-gray-400 text-xs sm:text-sm">
                {Math.round(videoVolume * 100)}%
              </span>
            </div>
          </div>

          {/* Audio volume */}
          <div>
            <div className="text-sm text-gray-400 mb-2">
              {t.audioLibrary?.volume || "Audio Volume"}
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={audioVolume}
                onChange={handleAudioVolumeChange}
                className="flex-1"
              />
              <span className="w-10 sm:w-12 text-right text-gray-400 text-xs sm:text-sm">
                {Math.round(audioVolume * 100)}%
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Connection info — Electron only */}
      {isElectron && (
        <Card tip={renderTip(t.settings.mobileRemoteTip)}>
          <h2 className="text-lg font-semibold mb-4">
            {t.settings.mobileRemote}
          </h2>

          <div className="flex flex-col items-center gap-4">
            {/* QR Code */}
            <div className="bg-white p-4 rounded-lg">
              <QRCodeSVG value={remoteURL} size={180} />
            </div>

            {/* URL */}
            <div className="text-center">
              <div className="text-sm text-gray-400 mb-1">
                {t.settings.scanOrVisit}
              </div>
              <div className="font-mono text-sm sm:text-lg text-blue-400 break-all">{remoteURL}</div>
            </div>

            <p className="text-sm text-gray-500 text-center">
              {t.settings.sameWifi}
            </p>

            {/* Security Key Display */}
            <div className="text-center mt-4 pt-4 border-t border-gray-700 w-full">
              <div className="text-sm text-gray-400 mb-1">
                {t.settings.securityKey}
              </div>
              <div className="font-mono text-2xl font-bold text-green-400 tracking-widest">
                {securityKey}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t.settings.securityKeyHint}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Connected Devices — Electron only */}
      {isElectron && (
        <Card>
          <h2 className="text-lg font-semibold mb-4">
            {t.devices.sectionTitle}
          </h2>
          {devices.length === 0 ? (
            <p className="text-sm text-gray-500">{t.devices.empty}</p>
          ) : (
            <div className="space-y-2">
              {devices.map((device) => (
                <DeviceRow
                  key={device.id}
                  device={device}
                  online={connectedDeviceIds.includes(device.id)}
                  onRename={(name) => onRenameDevice(device.id, name)}
                  onRevoke={() => onRevokeDevice(device.id)}
                  t={t}
                />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* About */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">{t.settings.about}</h2>

        <div className="space-y-4 text-gray-400">
          <p>
            <span className="text-gray-300">BisHub</span> -{" "}
            {t.settings.churchDisplayApp}
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p>
              {t.updates.currentVersion}:{" "}
              <span className="text-white font-mono">v{appVersion}</span>
            </p>
            {isElectron && (
              <button
                onClick={onCheckForUpdates}
                disabled={
                  updateStatus.state === "checking" ||
                  updateStatus.state === "downloading"
                }
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {updateStatus.state === "checking"
                  ? t.updates.checkingForUpdates
                  : updateStatus.state === "downloading"
                  ? `${t.updates.updateDownloading} ${
                      updateStatus.progress || 0
                    }%`
                  : t.updates.checkForUpdates}
              </button>
            )}
          </div>
          {updateStatus.state === "idle" && (
            <p className="text-sm text-green-400">{t.updates.upToDate}</p>
          )}
          {updateStatus.state === "available" && (
            <p className="text-sm text-yellow-400">
              {t.updates.newVersion}: v{updateStatus.version}
            </p>
          )}
          {updateStatus.state === "ready" && (
            <p className="text-sm text-green-400">
              {t.updates.updateReady}: v{updateStatus.version}
            </p>
          )}
          {updateStatus.state === "error" && (
            <p className="text-sm text-red-400">{updateStatus.error}</p>
          )}

          {isElectron && (
            <div className="pt-4 border-t border-gray-700/50">
              <div className="text-sm text-gray-300 mb-2">
                {t.diagnostics.bundledBinaries}
              </div>
              <div className="space-y-1.5">
                {binaryInfo === null
                  ? ["yt-dlp", "qjs", "ffmpeg", "ffprobe"].map((name) => (
                      <div
                        key={name}
                        className="flex items-center justify-between text-xs font-mono gap-2"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 bg-gray-600 animate-pulse"
                            aria-hidden
                          />
                          <span className="text-gray-300">{name}</span>
                        </span>
                        <span
                          className="inline-block h-3 w-28 rounded bg-gray-700/60 animate-pulse"
                          aria-hidden
                        />
                      </div>
                    ))
                  : binaryInfo.map((bin) => {
                      const sourceLabels = {
                        ota: t.diagnostics.sourceOta,
                        bundled: t.diagnostics.sourceBundled,
                        system: t.diagnostics.sourceSystem,
                      };
                      const sourceLabel = bin.source ? sourceLabels[bin.source] : null;
                      return (
                        <div
                          key={bin.name}
                          className="flex items-center justify-between text-xs font-mono gap-2"
                          title={bin.path ?? undefined}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                bin.available ? "bg-green-400" : "bg-red-400"
                              }`}
                              aria-hidden
                            />
                            <span className="text-gray-300">{bin.name}</span>
                          </span>
                          <span className="flex items-center gap-2 text-gray-500 min-w-0 truncate">
                            {bin.available ? (
                              <>
                                <span className="text-gray-400 truncate">
                                  {bin.version || t.diagnostics.unknownVersion}
                                </span>
                                {sourceLabel && (
                                  <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 text-[10px] uppercase tracking-wide flex-shrink-0">
                                    {sourceLabel}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-red-400">
                                {t.diagnostics.notFound}
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Keyboard shortcuts */}
      <Card tip={renderTip(t.settings.keyboardShortcutsTip)}>
        <h2 className="text-lg font-semibold mb-4">
          {t.settings.keyboardShortcuts}
        </h2>

        <div className="space-y-2 text-sm">
          {Object.values(SHORTCUTS).map((shortcut) => (
            <div
              key={shortcut.display.join(",")}
              className="flex justify-between py-2 border-b border-gray-700"
            >
              <span className="text-gray-400">{shortcut.label(t)}</span>
              <div className="flex items-center gap-1">
                {"shift" in shortcut && shortcut.shift && (
                  <>
                    <kbd className="px-2 py-1 bg-gray-700 rounded text-gray-300">
                      Shift
                    </kbd>
                    <span className="text-gray-500">+</span>
                  </>
                )}
                {"mod" in shortcut && shortcut.mod ? (
                  <>
                    <kbd className="px-2 py-1 bg-gray-700 rounded text-gray-300">
                      {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}
                    </kbd>
                    <span className="text-gray-500">+</span>
                    {shortcut.display.map((key) => (
                      <kbd
                        key={key}
                        className="px-2 py-1 bg-gray-700 rounded text-gray-300"
                      >
                        {key}
                      </kbd>
                    ))}
                  </>
                ) : (
                  shortcut.display.map((key, i) => (
                    <span key={key} className="flex items-center gap-1">
                      {i > 0 && (
                        <span className="text-gray-500">/</span>
                      )}
                      <kbd className="px-2 py-1 bg-gray-700 rounded text-gray-300">
                        {key}
                      </kbd>
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
