import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card } from "../components/ui/Card";
import { Select } from "../components/ui/Select";
import { PositionPicker } from "../components/ui/PositionPicker";
import { renderTip } from "../components/ui/renderTip";
import type {
  MonitorInfo,
  AppSettings,
  IdleState,
  ClockPosition,
  AudioWidgetPosition,
  UpdateStatus,
} from "../../shared/types";
import {
  getTranslations,
  LANGUAGE_NAMES,
  AVAILABLE_LANGUAGES,
  type Language,
} from "../../shared/i18n";
import { SHORTCUTS } from "../../shared/shortcuts";

interface Props {
  monitors: MonitorInfo[];
  settings: AppSettings;
  idleState: IdleState;
  videoVolume: number;
  audioVolume: number;
  onSetLanguage: (language: Language) => void;
  onSetWallpaper: (selectNew?: boolean) => Promise<string | null>;
  onSetClockFontSize: (size: number) => void;
  onSetClockPosition: (position: ClockPosition) => void;
  onSetAudioWidgetPosition: (position: AudioWidgetPosition) => void;
  onSetVolume: (volume: number) => void;
  onSetAudioVolume: (volume: number) => void;
  appVersion: string;
  updateStatus: UpdateStatus;
  onCheckForUpdates: () => void;
}

export default function SettingsPage({
  monitors,
  settings,
  idleState,
  videoVolume,
  audioVolume,
  onSetLanguage,
  onSetWallpaper,
  onSetClockFontSize,
  onSetClockPosition,
  onSetAudioWidgetPosition,
  onSetVolume,
  onSetAudioVolume,
  appVersion,
  updateStatus,
  onCheckForUpdates,
}: Props) {
  const [localIP, setLocalIP] = useState<string>("...");
  const [securityKey, setSecurityKey] = useState<string>("...");
  const [openOnStartup, setOpenOnStartup] = useState<boolean>(false);
  const t = getTranslations(settings.language);
  const isElectron = !!window.electronAPI;

  useEffect(() => {
    if (isElectron) {
      window.electronAPI?.getLocalIP().then(setLocalIP);
      window.electronAPI?.getSecurityKey().then(setSecurityKey);
      window.electronAPI?.getOpenOnStartup().then(setOpenOnStartup);
    } else {
      const url = new URL(window.location.href);
      const securityKey = url.searchParams.get("key") || "unknown";
      setSecurityKey(securityKey);
      setLocalIP(url.hostname);
    }
  }, [isElectron]);

  const handleMonitorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const monitorId = Number(e.target.value);
    window.electronAPI?.setDisplayMonitor(monitorId);
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSetLanguage(e.target.value as Language);
  };

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

  const remoteURL = `http://${localIP}:${settings.serverPort}/remote?key=${securityKey}`;

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

      {/* Display settings */}
      <Card tip={renderTip(t.settings.displayTip)}>
        <h2 className="text-lg font-semibold mb-4">{t.settings.display}</h2>

        <div>
          <label className="text-sm text-gray-400 block mb-2">
            {t.settings.displayMonitor}
          </label>
          <Select
            value={settings.displayMonitor}
            onChange={handleMonitorChange}
          >
            <option value={-1}>{t.settings.autoSecondary}</option>
            {monitors.map((monitor) => (
              <option key={monitor.id} value={monitor.id}>
                {monitor.name} ({monitor.bounds.width}x{monitor.bounds.height})
              </option>
            ))}
          </Select>
          <p className="text-sm text-gray-500 mt-2">
            {t.settings.selectMonitorHint}
          </p>
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

      {/* Connection info */}
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
          {isElectron && (
            <div className="text-center">
              <div className="text-sm text-gray-400 mb-1">
                {t.settings.scanOrVisit}
              </div>
              <div className="font-mono text-lg text-blue-400">{remoteURL}</div>
            </div>
          )}

          <p className="text-sm text-gray-500 text-center">
            {t.settings.sameWifi}
          </p>

          {/* Security Key Display - Electron only */}
          {isElectron && (
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
          )}
        </div>
      </Card>

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
