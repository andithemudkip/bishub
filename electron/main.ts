import { app, BrowserWindow, ipcMain, screen, dialog, net } from "electron";
import os from "os";
import path from "path";
import { createServer } from "./server";
import { WindowManager } from "./windowManager";
import { StateManager } from "./state";
import { initUpdater, checkForUpdates, quitAndInstall } from "./updater";
import {
  loadHymns,
  searchHymns,
  getHymnByNumber,
  formatHymnForDisplay,
  getBibleBooks,
  getBibleChapter,
  getBibleVerses,
  formatBibleVersesForDisplay,
  formatBibleChapterForDisplay,
  loadBible,
  searchBibleVerses,
} from "./dataLoader";
import { getVideoLibrary } from "./videoLibrary";
import { getAudioLibrary } from "./audioLibrary";
import { initAudioScheduler, getAudioScheduler } from "./audioScheduler";
import { startDownload, cancelDownload, getActiveDownloads } from "./ytdlp";
import type {
  DisplayMode,
  ClockPosition,
  AudioWidgetPosition,
} from "../src/shared/types";
import type { Language } from "../src/shared/i18n";

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

  // Sync login item settings with stored preference
  const settings = stateManager.getSettings();
  app.setLoginItemSettings({
    openAtLogin: settings.openOnStartup,
    openAsHidden: false,
  });

  // Initialize audio scheduler
  const audioScheduler = initAudioScheduler(stateManager);
  audioScheduler.onScheduleChange((schedules) => {
    windowManager.broadcastToAll("audio-schedules-update", schedules);
  });
  audioScheduler.onPresetChange((presets) => {
    windowManager.broadcastToAll("audio-presets-update", presets);
  });
  audioScheduler.onScheduleEvent((event) => {
    windowManager.broadcastToAll("audio-schedule-event", event);
  });

  // Set up IPC handlers BEFORE creating windows
  setupIPC();

  // Start the Socket.io server
  const server = createServer(stateManager, windowManager);
  const port = stateManager.getSettings().serverPort;
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
    console.log(`Local IP: http://${getLocalIPAddress()}:${port}`);
  });

  // Initialize auto-updater
  initUpdater((channel, data) => windowManager.broadcastToAll(channel, data));

  // Check for updates 1 minute after launch
  setTimeout(() => {
    checkForUpdates();
  }, 60000);

  // Create remote window on primary monitor
  await windowManager.createRemoteWindow();

  // Create display window on secondary monitor (or primary if only one)
  await windowManager.createDisplayWindow();
}

function setupIPC() {
  // Update handlers
  ipcMain.handle("get-app-version", () => {
    return app.getVersion();
  });

  ipcMain.handle("check-for-updates", () => {
    checkForUpdates();
  });

  ipcMain.handle("install-update", () => {
    quitAndInstall();
  });

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

  ipcMain.handle("get-security-key", () => {
    return stateManager.getSecurityKey();
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

  ipcMain.handle("set-open-on-startup", (_event, openOnStartup: boolean) => {
    stateManager.setOpenOnStartup(openOnStartup);

    // Update the system's login item settings
    app.setLoginItemSettings({
      openAtLogin: openOnStartup,
      openAsHidden: false,
    });
  });

  ipcMain.handle("get-open-on-startup", () => {
    const loginSettings = app.getLoginItemSettings();
    return loginSettings.openAtLogin;
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
      stateManager.loadText(title, slides.join("\n\n"), "hymn");
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
      _endVerse?: number
    ) => {
      // Load entire chapter, starting at the requested verse
      const allVerses = getBibleChapter(bookId, chapter);
      if (allVerses.length > 0) {
        const { title, slides, startIndex, bibleContext } =
          formatBibleChapterForDisplay(
            bookId,
            bookName,
            chapter,
            allVerses,
            startVerse
          );
        stateManager.loadBibleChapter(title, slides, startIndex, bibleContext);
      }
    }
  );

  ipcMain.handle("search-bible-verses", (_event, query: string) => {
    return searchBibleVerses(query);
  });

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

  ipcMain.handle("rename-video", (_event, videoId: string, newName: string) => {
    return videoLibrary.renameVideo(videoId, newName);
  });

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

  // Audio Library handlers
  const audioLibrary = getAudioLibrary();

  // Validate library on startup
  audioLibrary.validateLibrary();

  // Notify renderers of library changes
  audioLibrary.onLibraryChange((audios) => {
    windowManager.broadcastToAll("audio-library-update", audios);
  });

  audioLibrary.onUploadProgress((progress) => {
    windowManager.broadcastToAll("audio-upload-progress", progress);
  });

  audioLibrary.onDirectoryImportProgress((progress) => {
    windowManager.broadcastToAll("audio-directory-import-progress", progress);
  });

  ipcMain.handle("get-audio-library", () => {
    return audioLibrary.getAll();
  });

  ipcMain.handle("add-local-audio", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        {
          name: "Audio",
          extensions: ["mp3", "wav", "ogg", "m4a", "flac"],
        },
      ],
    });

    if (result.filePaths[0]) {
      const audio = await audioLibrary.addAudio(result.filePaths[0], "local");
      return audio;
    }
    return null;
  });

  ipcMain.handle("add-local-audio-directory", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });

    if (result.filePaths[0]) {
      return audioLibrary.addAudiosFromDirectory(result.filePaths[0]);
    }
    return { completed: [], errors: [] };
  });

  ipcMain.handle("delete-audio", async (_event, audioId: string) => {
    return audioLibrary.deleteAudio(audioId);
  });

  ipcMain.handle("rename-audio", (_event, audioId: string, newName: string) => {
    return audioLibrary.renameAudio(audioId, newName);
  });

  // Audio playback
  ipcMain.handle("load-audio", (_event, src: string, name: string) => {
    stateManager.loadAudio(src, name);
  });

  ipcMain.handle("play-audio", () => {
    stateManager.playAudio();
  });

  ipcMain.handle("pause-audio", () => {
    stateManager.pauseAudio();
  });

  ipcMain.handle("stop-audio", () => {
    stateManager.stopAudio();
  });

  ipcMain.handle("seek-audio", (_event, time: number) => {
    stateManager.seekAudio(time);
  });

  ipcMain.handle("set-audio-volume", (_event, volume: number) => {
    stateManager.setAudioVolume(volume);
  });

  ipcMain.handle(
    "audio-time-update",
    (_event, time: number, duration: number) => {
      stateManager.updateAudioTime(time, duration);
    }
  );

  ipcMain.handle(
    "set-audio-widget-position",
    (_event, position: AudioWidgetPosition) => {
      stateManager.setAudioWidgetPosition(position);
    }
  );

  // Audio Scheduling
  ipcMain.handle("get-audio-schedules", () => {
    return getAudioScheduler()?.getSchedules() || [];
  });

  ipcMain.handle("get-audio-presets", () => {
    return getAudioScheduler()?.getPresets() || [];
  });

  ipcMain.handle(
    "create-audio-schedule",
    (
      _event,
      params: {
        audioId: string;
        audioName: string;
        audioPath: string;
        timeType: "absolute" | "relative";
        absoluteTime?: string;
        relativeMinutes?: number;
      }
    ) => {
      return getAudioScheduler()?.createSchedule({
        ...params,
        absoluteTime: params.absoluteTime
          ? new Date(params.absoluteTime)
          : undefined,
      });
    }
  );

  ipcMain.handle("cancel-audio-schedule", (_event, scheduleId: string) => {
    return getAudioScheduler()?.cancelSchedule(scheduleId);
  });

  ipcMain.handle(
    "create-audio-preset",
    (
      _event,
      params: {
        name: string;
        audioId: string;
        audioName: string;
        timeType: "absolute" | "relative";
        hour?: number;
        minute?: number;
        relativeMinutes?: number;
      }
    ) => {
      return getAudioScheduler()?.createPreset(params);
    }
  );

  ipcMain.handle(
    "activate-audio-preset",
    (_event, presetId: string, audioPath: string) => {
      return getAudioScheduler()?.activatePreset(presetId, audioPath);
    }
  );

  ipcMain.handle("delete-audio-preset", (_event, presetId: string) => {
    return getAudioScheduler()?.deletePreset(presetId);
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
