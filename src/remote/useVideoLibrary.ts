import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type {
  VideoItem,
  DownloadProgress,
  UploadProgress,
} from "../shared/videoLibrary.types";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "../shared/types";

type SocketType = Socket<ServerToClientEvents, ClientToServerEvents>;

interface VideoLibraryAPI {
  videos: VideoItem[];
  downloads: DownloadProgress[];
  uploads: UploadProgress[];
  isElectron: boolean;
  // Actions
  addLocalVideo: () => Promise<VideoItem | null>;
  deleteVideo: (videoId: string) => Promise<boolean>;
  renameVideo: (videoId: string, newName: string) => void;
  downloadYouTubeVideo: (url: string) => void;
  cancelDownload: (downloadId: string) => void;
  uploadVideo: (file: File) => Promise<void>;
  loadVideoToDisplay: (video: VideoItem) => void;
}

export function useVideoLibrary(
  loadVideo: (src: string) => void
): VideoLibraryAPI {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [downloads, setDownloads] = useState<DownloadProgress[]>([]);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);

  const socketRef = useRef<SocketType | null>(null);
  const isElectron = !!window.electronAPI;

  useEffect(() => {
    if (isElectron) {
      // Use Electron IPC
      window.electronAPI!.getVideoLibrary().then(setVideos);
      window.electronAPI!.getActiveDownloads().then(setDownloads);

      const unsubLibrary = window.electronAPI!.onVideoLibraryUpdate(setVideos);
      const unsubDownload = window.electronAPI!.onDownloadProgress(
        (progress: DownloadProgress) => {
          setDownloads((prev) => {
            const index = prev.findIndex((d) => d.id === progress.id);
            if (progress.status === "complete" || progress.status === "error") {
              // Remove completed/errored downloads after a delay
              setTimeout(() => {
                setDownloads((p) => p.filter((d) => d.id !== progress.id));
              }, 3000);
            }
            if (index === -1) return [...prev, progress];
            const updated = [...prev];
            updated[index] = progress;
            return updated;
          });
        }
      );
      const unsubUpload = window.electronAPI!.onUploadProgress(
        (progress: UploadProgress) => {
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

      return () => {
        unsubLibrary();
        unsubDownload();
        unsubUpload();
      };
    } else {
      // Use Socket.io
      const socket: SocketType = io();
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("getVideoLibrary");
      });

      socket.on("videoLibrary", setVideos);
      socket.on("downloadProgress", (progress) => {
        setDownloads((prev) => {
          const index = prev.findIndex((d) => d.id === progress.id);
          if (progress.status === "complete" || progress.status === "error") {
            setTimeout(() => {
              setDownloads((p) => p.filter((d) => d.id !== progress.id));
            }, 3000);
          }
          if (index === -1) return [...prev, progress];
          const updated = [...prev];
          updated[index] = progress;
          return updated;
        });
      });
      socket.on("uploadProgress", (progress) => {
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

  const api: VideoLibraryAPI = {
    videos,
    downloads,
    uploads,
    isElectron,

    addLocalVideo: useCallback(async () => {
      if (isElectron) {
        return window.electronAPI!.addLocalVideo();
      }
      return null; // Not available in web mode
    }, [isElectron]),

    deleteVideo: useCallback(
      async (videoId) => {
        if (isElectron) {
          return window.electronAPI!.deleteVideo(videoId);
        }
        socketRef.current?.emit("deleteVideo", videoId);
        return true;
      },
      [isElectron]
    ),

    renameVideo: useCallback(
      (videoId, newName) => {
        if (isElectron) {
          window.electronAPI!.renameVideo(videoId, newName);
        } else {
          socketRef.current?.emit("renameVideo", videoId, newName);
        }
      },
      [isElectron]
    ),

    downloadYouTubeVideo: useCallback(
      (url) => {
        if (isElectron) {
          window.electronAPI!.downloadYouTubeVideo(url);
        } else {
          socketRef.current?.emit("downloadYouTubeVideo", url);
        }
      },
      [isElectron]
    ),

    cancelDownload: useCallback(
      (downloadId) => {
        if (isElectron) {
          window.electronAPI!.cancelYouTubeDownload(downloadId);
        } else {
          socketRef.current?.emit("cancelDownload", downloadId);
        }
      },
      [isElectron]
    ),

    uploadVideo: useCallback(async (file: File) => {
      const formData = new FormData();
      formData.append("video", file);
      formData.append("name", file.name.replace(/\.[^.]+$/, ""));

      await fetch("/api/videos/upload", {
        method: "POST",
        body: formData,
      });
    }, []),

    loadVideoToDisplay: useCallback(
      (video: VideoItem) => {
        loadVideo(video.path);
      },
      [loadVideo]
    ),
  };

  return api;
}
