import type { MonitorInfo } from "../../shared/types";

interface Props {
  monitors: MonitorInfo[];
  currentMonitor: number;
}

export default function MonitorSelector({ monitors, currentMonitor }: Props) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const monitorId = Number(e.target.value);
    window.electronAPI?.setDisplayMonitor(monitorId);
  };

  if (monitors.length <= 1) {
    return null; // Don't show selector if only one monitor
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-3">Settings</h2>
      <div className="flex items-center gap-2">
        <label className="text-gray-400">Display Monitor:</label>
        <select
          value={currentMonitor}
          onChange={handleChange}
          className="flex-1 py-2 px-3 bg-gray-700 rounded-lg text-white"
        >
          <option value={-1}>Auto (Secondary)</option>
          {monitors.map((monitor) => (
            <option key={monitor.id} value={monitor.id}>
              {monitor.name} ({monitor.bounds.width}x{monitor.bounds.height})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
