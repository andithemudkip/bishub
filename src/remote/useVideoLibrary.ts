import { useEffect, useState, useRef, useCallback } from "react";
import { getSocket, listen, onConnected, type SocketType } from "./socket";
import type {
  VideoItem,
  DownloadProgress,
  UploadProgress,
} from "../shared/videoLibrary.types";
import { getApiUrl, updateProgressList } from "../shared/utils";


interface VideoLibraryAPI {
  videos: VideoItem[];
  downloads: DownloadProgress[];
  uploads: UploadProgress[];
  isElectron: boolean;
  // Actions
  addLocalVideo: () => Promise<VideoItem[]>;
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
      const socket = getSocket();
      if (!socket) return;
      socketRef.current = socket;

      const off = listen(socket, {
        videoLibrary: setVideos,
        downloadProgress: (progress) => {
          setDownloads((prev) => updateProgressList(prev, progress, setDownloads));
        },
        uploadProgress: (progress) => {
          setUploads((prev) => updateProgressList(prev, progress, setUploads));
        },
      });
      const offConnected = onConnected(socket, () => {
        socket.emit("getVideoLibrary");
        socket.emit("getInFlight");
      });

      return () => {
        off();
        offConnected();
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
      return []; // Not available in web mode
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
