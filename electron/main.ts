import { app, BrowserWindow, ipcMain, screen, dialog, net } from "electron";
import os from "os";
import path from "path";
import { createServer } from "./server";
import { WindowManager } from "./windowManager";
import { StateManager } from "./state";
import {
  loadHymns,
  searchHymns,
  getHymnByNumber,
  formatHymnForDisplay,
  getBibleBooks,
  getBibleChapter,
  getBibleVerses,
  formatBibleVersesForDisplay,
  loadBible,
} from "./dataLoader";
import { getVideoLibrary } from "./videoLibrary";
import { startDownload, cancelDownload, getActiveDownloads } from "./ytdlp";
import type { DisplayMode, ClockPosition } from "../src/shared/types";
import type { Language } from "../src/shared/i18n";

const isDev = process.env.NODE_ENV !== "production" || !app.isPackaged;

function getLocalIPAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

let windowManager: WindowManager;
let stateManager: StateManager;

async function createWindows() {
  stateManager = new StateManager();
  windowManager = new WindowManager(stateManager);

  // Set up IPC handlers BEFORE creating windows
  setupIPC();

  // Start the Socket.io server
  const server = createServer(stateManager, windowManager);
  const port = stateManager.getSettings().serverPort;
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
    console.log(`Local IP: http://${getLocalIPAddress()}:${port}`);
  });

  // Create remote window on primary monitor
  await windowManager.createRemoteWindow();

  // Create display window on secondary monitor (or primary if only one)
  await windowManager.createDisplayWindow();
}

function setupIPC() {
  ipcMain.handle("get-state", () => {
    return stateManager.getState();
  });

  ipcMain.handle("get-settings", () => {
    return stateManager.getSettings();
  });

  ipcMain.handle("get-monitors", () => {
    return windowManager.getMonitors();
  });

  ipcMain.handle("get-local-ip", () => {
    return getLocalIPAddress();
  });

  ipcMain.handle("set-mode", (_event, mode: DisplayMode) => {
    stateManager.setMode(mode);
  });

  ipcMain.handle("load-text", (_event, title: string, content: string) => {
    stateManager.loadText(title, content);
  });

  ipcMain.handle("next-slide", () => {
    stateManager.nextSlide();
  });

  ipcMain.handle("prev-slide", () => {
    stateManager.prevSlide();
  });

  ipcMain.handle("go-to-slide", (_event, index: number) => {
    stateManager.goToSlide(index);
  });

  ipcMain.handle("load-video", (_event, src: string) => {
    stateManager.loadVideo(src);
  });

  ipcMain.handle("play-video", () => {
    stateManager.playVideo();
  });

  ipcMain.handle("pause-video", () => {
    stateManager.pauseVideo();
  });

  ipcMain.handle("stop-video", () => {
    stateManager.stopVideo();
  });

  ipcMain.handle("seek-video", (_event, time: number) => {
    stateManager.seekVideo(time);
  });

  ipcMain.handle("set-volume", (_event, volume: number) => {
    stateManager.setVolume(volume);
  });

  ipcMain.handle("set-display-monitor", (_event, monitorId: number) => {
    windowManager.moveDisplayToMonitor(monitorId);
  });

  ipcMain.handle("set-language", (_event, language: Language) => {
    stateManager.setLanguage(language);
  });

  ipcMain.handle("go-idle", () => {
    stateManager.goIdle();
  });

  // Idle screen settings
  ipcMain.handle(
    "set-idle-wallpaper",
    async (_event, selectNew: boolean = true) => {
      if (!selectNew) {
        stateManager.setIdleWallpaper(null);
        return null;
      }
      const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [
          { name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp"] },
        ],
      });
      if (result.filePaths[0]) {
        stateManager.setIdleWallpaper(result.filePaths[0]);
        return result.filePaths[0];
      }
      return null;
    }
  );

  ipcMain.handle("set-clock-font-size", (_event, size: number) => {
    stateManager.setClockFontSize(size);
  });

  ipcMain.handle("set-clock-position", (_event, position: ClockPosition) => {
    stateManager.setClockPosition(position);
  });

  ipcMain.handle(
    "open-file-dialog",
    async (_event, filters: Electron.FileFilter[]) => {
      const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters,
      });
      return result.filePaths[0] || null;
    }
  );

  ipcMain.handle(
    "video-time-update",
    (_event, time: number, duration: number) => {
      stateManager.updateVideoTime(time, duration);
    }
  );

  // Hymn handlers
  ipcMain.handle("get-hymns", () => {
    return loadHymns();
  });

  ipcMain.handle("search-hymns", (_event, query: string) => {
    return searchHymns(query);
  });

  ipcMain.handle("load-hymn", (_event, hymnNumber: string) => {
    const hymn = getHymnByNumber(hymnNumber);
    if (hymn) {
      const { title, slides } = formatHymnForDisplay(hymn);
      stateManager.loadText(title, slides.join("\n\n"));
    }
  });

  // Bible handlers
  ipcMain.handle("get-bible-books", () => {
    return getBibleBooks();
  });

  ipcMain.handle(
    "get-bible-chapter",
    (_event, bookId: string, chapter: number) => {
      return getBibleChapter(bookId, chapter);
    }
  );

  ipcMain.handle(
    "load-bible-verses",
    (
      _event,
      bookId: string,
      bookName: string,
      chapter: number,
      startVerse: number,
      endVerse?: number
    ) => {
      const verses = getBibleVerses(bookId, chapter, startVerse, endVerse);
      if (verses.length > 0) {
        const { title, slides } = formatBibleVersesForDisplay(
          bookName,
          chapter,
          verses
        );
        stateManager.loadText(title, slides.join("\n\n"));
      }
    }
  );

  // Video Library handlers
  const videoLibrary = getVideoLibrary();

  // Validate library on startup
  videoLibrary.validateLibrary();

  // Notify renderers of library changes
  videoLibrary.onLibraryChange((videos) => {
    windowManager.broadcastToAll("video-library-update", videos);
  });

  videoLibrary.onDownloadProgress((progress) => {
    windowManager.broadcastToAll("download-progress", progress);
  });

  videoLibrary.onUploadProgress((progress) => {
    windowManager.broadcastToAll("upload-progress", progress);
  });

  ipcMain.handle("get-video-library", () => {
    return videoLibrary.getAll();
  });

  ipcMain.handle("add-local-video", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        {
          name: "Videos",
          extensions: ["mp4", "webm", "mov", "avi", "mkv"],
        },
      ],
    });

    if (result.filePaths[0]) {
      const video = await videoLibrary.addVideo(result.filePaths[0], "local");
      return video;
    }
    return null;
  });

  ipcMain.handle("delete-video", async (_event, videoId: string) => {
    return videoLibrary.deleteVideo(videoId);
  });

  ipcMain.handle(
    "rename-video",
    (_event, videoId: string, newName: string) => {
      return videoLibrary.renameVideo(videoId, newName);
    }
  );

  ipcMain.handle("download-youtube-video", (_event, url: string) => {
    return startDownload(url);
  });

  ipcMain.handle("cancel-youtube-download", (_event, downloadId: string) => {
    return cancelDownload(downloadId);
  });

  ipcMain.handle("get-active-downloads", () => {
    return getActiveDownloads();
  });

  ipcMain.handle("get-video-thumbnail", (_event, videoId: string) => {
    const video = videoLibrary.getById(videoId);
    return video?.thumbnailPath || null;
  });
}

app.whenReady().then(createWindows);

app.on("window-all-closed", () => {
  // Always quit, even on macOS
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindows();
  }
});
