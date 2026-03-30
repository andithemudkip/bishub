import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { TransferItem, TransferUploadProgress } from "../shared/transfer.types";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "../shared/types";
import { getSecurityKeyFromURL, getApiUrl, updateProgressList } from "../shared/utils";

type SocketType = Socket<ServerToClientEvents, ClientToServerEvents>;

interface TransferAPI {
  transfers: TransferItem[];
  uploads: TransferUploadProgress[];
  isElectron: boolean;
  uploadFile: (file: File) => Promise<void>;
  deleteTransfer: (id: string) => Promise<boolean>;
  addToVideoLibrary: (id: string) => Promise<boolean>;
  addToAudioLibrary: (id: string) => Promise<boolean>;
  addToImageLibrary: (id: string) => Promise<boolean>;
}

export function useTransfers(): TransferAPI {
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [uploads, setUploads] = useState<TransferUploadProgress[]>([]);

  const socketRef = useRef<SocketType | null>(null);
  const isElectron = !!window.electronAPI;

  useEffect(() => {
    if (isElectron) {
      window.electronAPI!.getTransfers().then(setTransfers);
      const unsub = window.electronAPI!.onTransfersUpdate(setTransfers);
      return unsub;
    } else {
      const securityKey = getSecurityKeyFromURL();
      const socket: SocketType = io({
        auth: { key: securityKey },
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("getTransfers");
      });

      socket.on("transfers", setTransfers);
      socket.on("transferUploadProgress", (progress) => {
        setUploads((prev) => updateProgressList(prev, progress, setUploads));
      });

      return () => {
        socket.disconnect();
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

    addToVideoLibrary: useCallback(async (id: string) => {
      if (window.electronAPI) {
        const result = await window.electronAPI.addTransferToVideo(id);
        return !!result;
      }
      const res = await fetch(getApiUrl("/api/transfers/add-to-video"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      return res.ok;
    }, []),

    addToAudioLibrary: useCallback(async (id: string) => {
      if (window.electronAPI) {
        const result = await window.electronAPI.addTransferToAudio(id);
        return !!result;
      }
      const res = await fetch(getApiUrl("/api/transfers/add-to-audio"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      return res.ok;
    }, []),

    addToImageLibrary: useCallback(async (id: string) => {
      if (window.electronAPI) {
        const result = await window.electronAPI.addTransferToImage(id);
        return !!result;
      }
      const res = await fetch(getApiUrl("/api/transfers/add-to-image"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      return res.ok;
    }, []),
  };
}
