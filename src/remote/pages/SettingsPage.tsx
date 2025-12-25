import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { MonitorInfo, AppSettings } from "../../shared/types";
import {
  getTranslations,
  LANGUAGE_NAMES,
  AVAILABLE_LANGUAGES,
  type Language,
} from "../../shared/i18n";

interface Props {
  monitors: MonitorInfo[];
  settings: AppSettings;
  onSetLanguage: (language: Language) => void;
}

export default function SettingsPage({
  monitors,
  settings,
  onSetLanguage,
}: Props) {
  const [localIP, setLocalIP] = useState<string>("...");
  const t = getTranslations(settings.language);

  useEffect(() => {
    window.electronAPI?.getLocalIP().then(setLocalIP);
  }, []);

  const handleMonitorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const monitorId = Number(e.target.value);
    window.electronAPI?.setDisplayMonitor(monitorId);
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSetLanguage(e.target.value as Language);
  };

  const remoteURL = `http://${localIP}:${settings.serverPort}/remote`;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Language settings */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">{t.settings.language}</h2>

        <div>
          <select
            value={settings.language}
            onChange={handleLanguageChange}
            className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {AVAILABLE_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_NAMES[lang]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Display settings */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">{t.settings.display}</h2>

        <div>
          <label className="text-sm text-gray-400 block mb-2">
            {t.settings.displayMonitor}
          </label>
          <select
            value={settings.displayMonitor}
            onChange={handleMonitorChange}
            className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={-1}>{t.settings.autoSecondary}</option>
            {monitors.map((monitor) => (
              <option key={monitor.id} value={monitor.id}>
                {monitor.name} ({monitor.bounds.width}x{monitor.bounds.height})
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-500 mt-2">
            {t.settings.selectMonitorHint}
          </p>
        </div>
      </div>

      {/* Connection info */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">{t.settings.mobileRemote}</h2>

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
            <div className="font-mono text-lg text-blue-400">{remoteURL}</div>
          </div>

          <p className="text-sm text-gray-500 text-center">
            {t.settings.sameWifi}
          </p>
        </div>
      </div>

      {/* About */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">{t.settings.about}</h2>

        <div className="space-y-2 text-gray-400">
          <p>
            <span className="text-gray-300">BisHub</span> -{" "}
            {t.settings.churchDisplayApp}
          </p>
          <p>Version 0.1.0</p>
        </div>
      </div>

      {/* Keyboard shortcuts */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">
          {t.settings.keyboardShortcuts}
        </h2>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-700">
            <span className="text-gray-400">{t.settings.nextSlide}</span>
            <div className="flex gap-1">
              <kbd className="px-2 py-1 bg-gray-700 rounded text-gray-300">→</kbd>
              <kbd className="px-2 py-1 bg-gray-700 rounded text-gray-300">PgDn</kbd>
            </div>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-700">
            <span className="text-gray-400">{t.settings.previousSlide}</span>
            <div className="flex gap-1">
              <kbd className="px-2 py-1 bg-gray-700 rounded text-gray-300">←</kbd>
              <kbd className="px-2 py-1 bg-gray-700 rounded text-gray-300">PgUp</kbd>
            </div>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-700">
            <span className="text-gray-400">{t.settings.goToIdle}</span>
            <kbd className="px-2 py-1 bg-gray-700 rounded text-gray-300">
              Esc
            </kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
