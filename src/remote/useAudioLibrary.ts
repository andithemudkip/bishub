import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type {
  AudioItem,
  AudioUploadProgress,
  DirectoryImportProgress,
} from "../shared/audioLibrary.types";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "../shared/types";

type SocketType = Socket<ServerToClientEvents, ClientToServerEvents>;

// Extract security key from URL query parameter for web remote authentication
function getSecurityKeyFromURL(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("key");
}

interface AudioLibraryAPI {
  audios: AudioItem[];
  uploads: AudioUploadProgress[];
  directoryImport: DirectoryImportProgress | null;
  isElectron: boolean;
  // Actions
  addLocalAudio: () => Promise<AudioItem | null>;
  addLocalAudioDirectory: () => Promise<void>;
  deleteAudio: (audioId: string) => Promise<boolean>;
  renameAudio: (audioId: string, newName: string) => void;
  uploadAudio: (file: File) => Promise<void>;
  loadAudioToDisplay: (audio: AudioItem) => void;
}

export function useAudioLibrary(
  loadAudio: (src: string, name: string) => void
): AudioLibraryAPI {
  const [audios, setAudios] = useState<AudioItem[]>([]);
  const [uploads, setUploads] = useState<AudioUploadProgress[]>([]);
  const [directoryImport, setDirectoryImport] =
    useState<DirectoryImportProgress | null>(null);

  const socketRef = useRef<SocketType | null>(null);
  const isElectron = !!window.electronAPI;

  useEffect(() => {
    if (isElectron) {
      // Use Electron IPC
      window.electronAPI!.getAudioLibrary().then(setAudios);

      const unsubLibrary = window.electronAPI!.onAudioLibraryUpdate(setAudios);
      const unsubUpload = window.electronAPI!.onAudioUploadProgress(
        (progress: AudioUploadProgress) => {
          setUploads((prev) => {
            const index = prev.findIndex((u) => u.id === progress.id);
            if (progress.status === "complete" || progress.status === "error") {
              setTimeout(() => {
                setUploads((p) => p.filter((u) => u.id !== progress.id));
              }, 3000);
            }
            if (index === -1) return [...prev, progress];
            const updated = [...prev];
            updated[index] = progress;
            return updated;
          });
        }
      );
      const unsubDirImport = window.electronAPI!.onAudioDirectoryImportProgress(
        (progress: DirectoryImportProgress) => {
          if (progress.status === "complete" || progress.status === "error") {
            // Keep showing for 3 seconds after completion
            setTimeout(() => {
              setDirectoryImport(null);
            }, 3000);
          }
          setDirectoryImport(progress);
        }
      );

      return () => {
        unsubLibrary();
        unsubUpload();
        unsubDirImport();
      };
    } else {
      // Use Socket.io with security key authentication
      const securityKey = getSecurityKeyFromURL();
      const socket: SocketType = io({
        auth: { key: securityKey },
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("getAudioLibrary");
      });

      socket.on("audioLibrary", setAudios);
      socket.on("audioUploadProgress", (progress) => {
        setUploads((prev) => {
          const index = prev.findIndex((u) => u.id === progress.id);
          if (progress.status === "complete" || progress.status === "error") {
            setTimeout(() => {
              setUploads((p) => p.filter((u) => u.id !== progress.id));
            }, 3000);
          }
          if (index === -1) return [...prev, progress];
          const updated = [...prev];
          updated[index] = progress;
          return updated;
        });
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [isElectron]);

  const api: AudioLibraryAPI = {
    audios,
    uploads,
    directoryImport,
    isElectron,

    addLocalAudio: useCallback(async () => {
      if (isElectron) {
        return window.electronAPI!.addLocalAudio();
      }
      return null; // Not available in web mode
    }, [isElectron]),

    addLocalAudioDirectory: useCallback(async () => {
      if (isElectron) {
        await window.electronAPI!.addLocalAudioDirectory();
      }
      // Not available in web mode
    }, [isElectron]),

    deleteAudio: useCallback(
      async (audioId) => {
        if (isElectron) {
          return window.electronAPI!.deleteAudio(audioId);
        }
        socketRef.current?.emit("deleteAudio", audioId);
        return true;
      },
      [isElectron]
    ),

    renameAudio: useCallback(
      (audioId, newName) => {
        if (isElectron) {
          window.electronAPI!.renameAudio(audioId, newName);
        } else {
          socketRef.current?.emit("renameAudio", audioId, newName);
        }
      },
      [isElectron]
    ),

    uploadAudio: useCallback(async (file: File) => {
      const formData = new FormData();
      formData.append("audio", file);
      formData.append("name", file.name.replace(/\.[^.]+$/, ""));

      await fetch("/api/audio/upload", {
        method: "POST",
        body: formData,
      });
    }, []),

    loadAudioToDisplay: useCallback(
      (audio: AudioItem) => {
        loadAudio(audio.path, audio.name);
      },
      [loadAudio]
    ),
  };

  return api;
}
