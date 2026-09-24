import { useEffect, useMemo, useRef, useState } from "react";
import { getSocket, listen, onConnected, type SocketType } from "./socket";
import type { AppSettings, MonitorInfo } from "../shared/types";


interface SystemHealthAPI {
  /** `null` until the first value arrives (Electron invoke resolves / web connects). */
  displayWindowOpen: boolean | null;
  /** `settings.displayMonitor` points at a monitor that isn't currently connected. */
  monitorMissing: boolean;
}

/**
 * Feature A5 (HealthBanner). `settings` and `monitors` come from
 * `useRemoteAPI`, which already tracks both; only the display window's
 * open/closed state needs a subscription of its own.
 */
export function useSystemHealth(
  settings: AppSettings,
  monitors: MonitorInfo[] | null
): SystemHealthAPI {
  const [displayWindowOpen, setDisplayWindowOpen] = useState<boolean | null>(null);

  const socketRef = useRef<SocketType | null>(null);
  const isElectron = !!window.electronAPI;

  useEffect(() => {
    if (isElectron) {
      const api = window.electronAPI!;
      api.getDisplayWindowState().then(setDisplayWindowOpen);
      return api.onDisplayWindowState(setDisplayWindowOpen);
    } else {
      const socket = getSocket();
      if (!socket) return;
      socketRef.current = socket;

      const off = listen(socket, { displayWindowState: setDisplayWindowOpen });
      const offConnected = onConnected(socket, () => {
        socket.emit("getDisplayWindowState");
      });

      return () => {
        off();
        offConnected();
      };
    }
  }, [isElectron]);

  // `monitors` is null until the first list arrives — an empty list would
  // read as "the configured monitor is missing" and flash the warning.
  const monitorMissing = useMemo(
    () =>
      monitors !== null &&
      settings.displayMonitor !== -1 &&
      !monitors.some((m) => m.id === settings.displayMonitor),
    [settings.displayMonitor, monitors]
  );

  return { displayWindowOpen, monitorMissing };
}
