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
import { getSecurityKeyFromURL, getApiUrl, updateProgressList } from "../shared/utils";

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
  loadVideo: (src: string, videoId?: string) => void
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
          setDownloads((prev) => updateProgressList(prev, progress, setDownloads));
        }
      );
      const unsubUpload = window.electronAPI!.onUploadProgress(
        (progress: UploadProgress) => {
          setUploads((prev) => updateProgressList(prev, progress, setUploads));
        }
      );

      return () => {
        unsubLibrary();
        unsubDownload();
        unsubUpload();
      };
    } else {
      // Use Socket.io with security key authentication
      const securityKey = getSecurityKeyFromURL();
      const socket: SocketType = io({
        auth: { key: securityKey },
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("getVideoLibrary");
      });

      socket.on("videoLibrary", setVideos);
      socket.on("downloadProgress", (progress) => {
        setDownloads((prev) => updateProgressList(prev, progress, setDownloads));
      });
      socket.on("uploadProgress", (progress) => {
        setUploads((prev) => updateProgressList(prev, progress, setUploads));
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

      await fetch(getApiUrl("/api/videos/upload"), {
        method: "POST",
        body: formData,
      });
    }, []),

    loadVideoToDisplay: useCallback(
      (video: VideoItem) => {
        loadVideo(video.path, video.id);
      },
      [loadVideo]
    ),
  };

  return api;
}
