import { useEffect, useState, useRef, useCallback } from "react";
import { getSocket, listen, onConnected, type SocketType } from "./socket";
import type {
  TransferItem,
  TransferLibrary,
  TransferUploadProgress,
} from "../shared/transfer.types";
import { getApiUrl, updateProgressList } from "../shared/utils";


interface TransferAPI {
  transfers: TransferItem[];
  uploads: TransferUploadProgress[];
  isElectron: boolean;
  uploadFile: (file: File) => Promise<void>;
  deleteTransfer: (id: string) => Promise<boolean>;
  /** Resolves false if the move failed (the transfer is left where it was). */
  moveToLibrary: (id: string, library: TransferLibrary) => Promise<boolean>;
}

export function useTransfers(): TransferAPI {
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [uploads, setUploads] = useState<TransferUploadProgress[]>([]);

  const socketRef = useRef<SocketType | null>(null);
  const isElectron = !!window.electronAPI;

  useEffect(() => {
    if (isElectron) {
      window.electronAPI!.getTransfers().then(setTransfers);
      const unsubTransfers = window.electronAPI!.onTransfersUpdate(setTransfers);
      const unsubUpload = window.electronAPI!.onTransferUploadProgress((progress) => {
        setUploads((prev) => updateProgressList(prev, progress, setUploads));
      });
      return () => {
        unsubTransfers();
        unsubUpload();
      };
    } else {
      const socket = getSocket();
      if (!socket) return;
      socketRef.current = socket;

      const off = listen(socket, {
        transfers: setTransfers,
        transferUploadProgress: (progress) => {
          setUploads((prev) => updateProgressList(prev, progress, setUploads));
        },
      });
      const offConnected = onConnected(socket, () => {
        socket.emit("getTransfers");
        socket.emit("getInFlight");
      });

      return () => {
        off();
        offConnected();
      };
    }
  }, [isElectron]);

  return {
    transfers,
    uploads,
    isElectron,

    uploadFile: useCallback(async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(getApiUrl("/api/transfers/upload"), {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }
    }, []),

    deleteTransfer: useCallback(async (id: string) => {
      if (window.electronAPI) {
        return window.electronAPI.deleteTransfer(id);
      }
      const res = await fetch(getApiUrl("/api/transfers/delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      return res.ok;
    }, []),

    moveToLibrary: useCallback(async (id: string, library: TransferLibrary) => {
      if (window.electronAPI) {
        const result = await window.electronAPI.moveTransferToLibrary(id, library);
        return !!result;
      }
      const res = await fetch(getApiUrl("/api/transfers/move-to-library"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, library }),
      });
      return res.ok;
    }, []),
  };
}
