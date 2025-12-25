import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { MonitorInfo, AppSettings } from "../../shared/types";

interface Props {
  monitors: MonitorInfo[];
  settings: AppSettings;
}

export default function SettingsPage({ monitors, settings }: Props) {
  const [localIP, setLocalIP] = useState<string>("...");

  useEffect(() => {
    window.electronAPI?.getLocalIP().then(setLocalIP);
  }, []);

  const handleMonitorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const monitorId = Number(e.target.value);
    window.electronAPI?.setDisplayMonitor(monitorId);
  };

  const remoteURL = `http://${localIP}:${settings.serverPort}/remote`;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Display settings */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Display</h2>

        <div>
          <label className="text-sm text-gray-400 block mb-2">
            Display Monitor
          </label>
          <select
            value={settings.displayMonitor}
            onChange={handleMonitorChange}
            className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={-1}>Auto (Secondary Monitor)</option>
            {monitors.map((monitor) => (
              <option key={monitor.id} value={monitor.id}>
                {monitor.name} ({monitor.bounds.width}x{monitor.bounds.height})
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-500 mt-2">
            Select which monitor to use for the display output
          </p>
        </div>
      </div>

      {/* Connection info */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Mobile Remote</h2>

        <div className="flex flex-col items-center gap-4">
          {/* QR Code */}
          <div className="bg-white p-4 rounded-lg">
            <QRCodeSVG value={remoteURL} size={180} />
          </div>

          {/* URL */}
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-1">Scan or visit:</div>
            <div className="font-mono text-lg text-blue-400">{remoteURL}</div>
          </div>

          <p className="text-sm text-gray-500 text-center">
            Make sure your phone is connected to the same WiFi network
          </p>
        </div>
      </div>

      {/* About */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">About</h2>

        <div className="space-y-2 text-gray-400">
          <p>
            <span className="text-gray-300">BisHub</span> - Church Display
            Application
          </p>
          <p>Version 0.1.0</p>
        </div>
      </div>

      {/* Keyboard shortcuts */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h2>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-700">
            <span className="text-gray-400">Next slide</span>
            <kbd className="px-2 py-1 bg-gray-700 rounded text-gray-300">→</kbd>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-700">
            <span className="text-gray-400">Previous slide</span>
            <kbd className="px-2 py-1 bg-gray-700 rounded text-gray-300">←</kbd>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-700">
            <span className="text-gray-400">Go to idle</span>
            <kbd className="px-2 py-1 bg-gray-700 rounded text-gray-300">
              Esc
            </kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
