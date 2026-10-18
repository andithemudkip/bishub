import { useCallback, useEffect, useState } from "react";
import { getSocket, listen, onConnected } from "../socket";
import type { StorageStats } from "../../shared/storage.types";

/**
 * What BisHub's media takes up on the main computer, kept current as
 * transfers come and go (moving one into a library changes both sides).
 * `null` until the first answer arrives.
 */
export function useStorageStats() {
  const [stats, setStats] = useState<StorageStats | null>(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (api) {
      let active = true;
      const refresh = () =>
        api.getStorageStats().then((next) => {
          if (active) setStats(next);
        });
      refresh();
      const off = api.onTransfersUpdate(refresh);
      return () => {
        active = false;
        off();
      };
    }

    const socket = getSocket();
    if (!socket) return;
    const off = listen(socket, {
      storageStats: setStats,
      transfers: () => socket.emit("getStorageStats"),
    });
    const offConnected = onConnected(socket, () => socket.emit("getStorageStats"));
    return () => {
      off();
      offConnected();
    };
  }, []);

  const deleteSpareTransfers = useCallback(async () => {
    if (window.electronAPI) {
      setStats(await window.electronAPI.deleteSpareTransfers());
      return;
    }
    getSocket()?.emit("deleteSpareTransfers");
  }, []);

  return { stats, deleteSpareTransfers };
}
