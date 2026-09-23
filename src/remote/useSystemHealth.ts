import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  AppSettings,
  MonitorInfo,
} from "../shared/types";
import { getDeviceToken } from "../shared/utils";

type SocketType = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SystemHealthAPI {
  /** `null` until the first value arrives (Electron invoke resolves / web connects). */
  displayWindowOpen: boolean | null;
  /** `settings.displayMonitor` points at a monitor that isn't currently connected. */
  monitorMissing: boolean;
}

/**
 * Feature A5 (HealthBanner). Takes `settings` from `Layout` (which already
 * has them) but keeps its own `monitors` subscription, since `useRemoteAPI`
 * doesn't expose monitors to `Layout` — a duplicate listener, the same
 * tradeoff `useActivity` makes for the progress streams.
 *
 * IP/port and connected-device count belong here too per the plan, but
 * `useRemoteAPI` already fetches both cheaply — left for Phase 2 to wire
 * from there rather than duplicating a third subscription in this hook.
 */
export function useSystemHealth(settings: AppSettings): SystemHealthAPI {
  const [displayWindowOpen, setDisplayWindowOpen] = useState<boolean | null>(null);
  // null until the first list arrives — an empty list would read as "the
  // configured monitor is missing" and flash the warning on every load.
  const [monitors, setMonitors] = useState<MonitorInfo[] | null>(null);

  const socketRef = useRef<SocketType | null>(null);
  const isElectron = !!window.electronAPI;

  useEffect(() => {
    if (isElectron) {
      const api = window.electronAPI!;

      api.getDisplayWindowState().then(setDisplayWindowOpen);
      api.getMonitors().then(setMonitors);

      const unsubDisplay = api.onDisplayWindowState(setDisplayWindowOpen);
      const unsubMonitors = api.onMonitorsUpdate(setMonitors);

      return () => {
        unsubDisplay();
        unsubMonitors();
      };
    } else {
      const token = getDeviceToken();
      if (!token) return;
      const socket: SocketType = io({ auth: { token } });
      socketRef.current = socket;

      socket.on("displayWindowState", setDisplayWindowOpen);
      socket.on("monitors", setMonitors);

      return () => {
        socket.disconnect();
      };
    }
  }, [isElectron]);

  const monitorMissing = useMemo(
    () =>
      monitors !== null &&
      settings.displayMonitor !== -1 &&
      !monitors.some((m) => m.id === settings.displayMonitor),
    [settings.displayMonitor, monitors]
  );

  return { displayWindowOpen, monitorMissing };
}
