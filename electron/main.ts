import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import os from "os";
import { createServer, closeServer } from "./server";
import { WindowManager } from "./windowManager";
import { StateManager } from "./state";
import { initUpdater, checkForUpdates, quitAndInstall } from "./updater";
import {
  loadHymns,
  searchHymns,
  searchAllHymns,
  getBibleBooks,
  getBibleChapter,
  formatBibleChapterForDisplay,
  searchBibleVerses,
} from "./dataLoader";
import { presentHymn, resolveHymnalSlug } from "./hymnPresenter";
import { isValidHymnalSlug } from "../src/shared/hymnals";
import {
  downloadMP3,
  downloadAllMissingMP3s,
  cancelMP3Download,
  cancelAllMP3Downloads,
  clearMP3Cache,
  getMP3CacheStats,
  onMP3DownloadProgress,
  onHymnAssetsUpdated,
  checkForHymnAssetUpdates,
} from "./hymnAssets";
import {
  isTranslationDownloaded,
  downloadTranslation,
  getDownloadedTranslationIds,
} from "./bibleManager";
import { getTranslationById } from "../src/shared/bibleTranslations";
import { getVideoLibrary } from "./videoLibrary";
import { getAudioLibrary } from "./audioLibrary";
import { getAudioPlaylists } from "./audioPlaylists";
import { getImageLibrary } from "./imageLibrary";
import { IMAGE_EXTENSIONS_NO_DOT } from "../src/shared/imageLibrary.types";
import type { VideoItem } from "../src/shared/videoLibrary.types";
import type { AudioItem } from "../src/shared/audioLibrary.types";
import { getTransferManager } from "./transferManager";
import { initAudioScheduler, getAudioScheduler } from "./audioScheduler";
import { startDownload, startAudioDownload, cancelDownload, getActiveDownloads, getActiveAudioDownloads, killAllDownloads, checkForBinaryUpdates, getBinaryInfo } from "./ytdlp";
import { getDeviceRegistry } from "./deviceRegistry";
import type {
  DisplayMode,
  ClockPosition,
  AudioWidgetPosition,
  HymnPlaybackMode,
  ChromeSizeKey,
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

  ipcMain.handle("get-binary-info", () => {
    return getBinaryInfo();
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

  ipcMain.handle("get-devices", () => {
    return getDeviceRegistry().getAll();
  });

  ipcMain.handle("rename-device", (_event, deviceId: string, name: string) => {
    return getDeviceRegistry().rename(deviceId, name);
  });

  ipcMain.handle("revoke-device", (_event, deviceId: string) => {
    return getDeviceRegistry().revoke(deviceId);
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

  ipcMain.handle("load-video", (_event, src: string, videoId?: string) => {
    stateManager.loadVideo(src, videoId);
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

  ipcMain.handle("set-synced-lyrics", (_event, enabled: boolean) => {
    stateManager.setSyncedLyrics(enabled);
  });

  ipcMain.handle("set-instrumentals", (_event, enabled: boolean) => {
    stateManager.setInstrumentals(enabled);
  });

  ipcMain.handle("set-chrome-size", (_event, key: ChromeSizeKey, size: number) => {
    stateManager.setChromeSize(key, size);
  });

  ipcMain.handle("set-slide-background", (_event, from: string, to: string) => {
    stateManager.setSlideBackground(from, to);
  });

  ipcMain.handle(
    "set-bible-background",
    (_event, enabled: boolean, from: string, to: string) => {
      stateManager.setBibleBackground(enabled, from, to);
    },
  );

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
  ipcMain.handle("get-hymns", (_event, slug?: string) => {
    return loadHymns(resolveHymnalSlug(stateManager, slug));
  });

  ipcMain.handle("search-hymns", (_event, query: string, slug?: string) => {
    return searchHymns(query, resolveHymnalSlug(stateManager, slug));
  });

  ipcMain.handle(
    "load-hymn",
    (
      _event,
      slug: string,
      hymnNumber: string,
      playbackMode?: HymnPlaybackMode,
    ) => {
      presentHymn(
        stateManager,
        resolveHymnalSlug(stateManager, slug),
        hymnNumber,
        playbackMode,
      );
    },
  );

  ipcMain.handle("search-all-hymns", (_event, query: string) => {
    return searchAllHymns(query);
  });

  ipcMain.handle("set-hymnal", (_event, slug: string) => {
    if (isValidHymnalSlug(slug)) stateManager.setHymnal(slug);
  });

  onMP3DownloadProgress((progress) => {
    windowManager.broadcastToAll("hymn-mp3-download-progress", progress);
  });

  onHymnAssetsUpdated(() => {
    const slug = resolveHymnalSlug(stateManager);
    windowManager.broadcastToAll("hymns-update", slug, loadHymns(slug));
    windowManager.broadcastToAll(
      "hymn-mp3-cache-stats",
      getMP3CacheStats(),
    );
  });

  ipcMain.handle("download-hymn-mp3", (_event, hymnNumber: string) => {
    return downloadMP3(hymnNumber);
  });
  ipcMain.handle("download-all-hymn-mp3s", () => {
    return downloadAllMissingMP3s();
  });
  ipcMain.handle("cancel-hymn-mp3-download", (_event, hymnNumber: string) => {
    cancelMP3Download(hymnNumber);
  });
  ipcMain.handle("cancel-all-hymn-mp3-downloads", () => {
    cancelAllMP3Downloads();
  });
  ipcMain.handle("clear-hymn-mp3-cache", () => {
    clearMP3Cache();
  });
  ipcMain.handle("get-hymn-mp3-cache-stats", () => {
    return getMP3CacheStats();
  });
  ipcMain.handle("set-karaoke-banner-dismissed", (_event, dismissed: boolean) => {
    stateManager.setKaraokeBannerDismissed(dismissed);
  });

  // Bible handlers
  ipcMain.handle("get-bible-books", () => {
    const translationId = stateManager.getSettings().bibleTranslation;
    return getBibleBooks(translationId);
  });

  ipcMain.handle(
    "get-bible-chapter",
    (_event, bookId: string, chapter: number) => {
      const translationId = stateManager.getSettings().bibleTranslation;
      return getBibleChapter(bookId, chapter, translationId);
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
      const translationId = stateManager.getSettings().bibleTranslation;
      const allVerses = getBibleChapter(bookId, chapter, translationId);
      if (allVerses.length > 0) {
        const { title, slides, startIndex, bibleContext } =
          formatBibleChapterForDisplay(
            bookId,
            bookName,
            chapter,
            allVerses,
            startVerse,
            translationId
          );
        stateManager.loadBibleChapter(title, slides, startIndex, bibleContext);
      }
    }
  );

  ipcMain.handle("search-bible-verses", (_event, query: string) => {
    const translationId = stateManager.getSettings().bibleTranslation;
    return searchBibleVerses(query, translationId);
  });

  ipcMain.handle(
    "set-bible-translation",
    async (_event, translationId: string) => {
      const info = getTranslationById(translationId);
      if (!info) return { status: "error", error: "Unknown translation" };

      if (!isTranslationDownloaded(translationId)) {
        try {
          await downloadTranslation(translationId);
        } catch (err) {
          return { status: "error", error: String(err) };
        }
      }

      stateManager.setBibleTranslation(translationId);
      return { status: "ready" };
    }
  );

  ipcMain.handle("get-downloaded-translations", () => {
    return getDownloadedTranslationIds();
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
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Videos",
          extensions: ["mp4", "webm", "mov", "avi", "mkv"],
        },
      ],
    });

    const videos: VideoItem[] = [];
    for (const filePath of result.filePaths) {
      try {
        const video = await videoLibrary.addVideo(filePath, "local");
        videos.push(video);
      } catch (error) {
        console.error(`Failed to add video ${filePath}:`, error);
      }
    }
    return videos;
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

  ipcMain.handle("show-item-in-folder", (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
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

  audioLibrary.onDownloadProgress((progress) => {
    windowManager.broadcastToAll("audio-download-progress", progress);
  });

  audioLibrary.onDirectoryImportProgress((progress) => {
    windowManager.broadcastToAll("audio-directory-import-progress", progress);
  });

  ipcMain.handle("get-audio-library", () => {
    return audioLibrary.getAll();
  });

  ipcMain.handle("add-local-audio", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Audio",
          extensions: ["mp3", "wav", "ogg", "m4a", "flac"],
        },
      ],
    });

    const audios: AudioItem[] = [];
    for (const filePath of result.filePaths) {
      try {
        const audio = await audioLibrary.addAudio(filePath, "local");
        audios.push(audio);
      } catch (error) {
        console.error(`Failed to add audio ${filePath}:`, error);
      }
    }
    return audios;
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

  ipcMain.handle("download-youtube-audio", (_event, url: string) => {
    return startAudioDownload(url);
  });

  ipcMain.handle("cancel-youtube-audio-download", (_event, downloadId: string) => {
    return cancelDownload(downloadId);
  });

  ipcMain.handle("get-active-audio-downloads", () => {
    return getActiveAudioDownloads();
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

  // Audio Playlists + Up Next queue
  const audioPlaylists = getAudioPlaylists();

  audioPlaylists.onPlaylistsChange((playlists) => {
    windowManager.broadcastToAll("audio-playlists-update", playlists);
    const queue = stateManager.getState().audio.queue;
    if (queue.source === "playlist" && queue.playlistId) {
      const playlist = playlists.find((p) => p.id === queue.playlistId);
      if (playlist) {
        stateManager.syncQueueFromSource(
          stateManager.resolveQueueTracks(playlist.audioIds)
        );
      }
    }
  });

  audioPlaylists.onQueueChange((audioIds) => {
    windowManager.broadcastToAll("audio-queue-update", audioIds);
    const queue = stateManager.getState().audio.queue;
    if (queue.source === "ephemeral") {
      stateManager.syncQueueFromSource(
        stateManager.resolveQueueTracks(audioIds)
      );
    }
  });

  ipcMain.handle("get-audio-playlists", () => {
    return audioPlaylists.getAll();
  });

  ipcMain.handle(
    "create-audio-playlist",
    (_event, name: string, audioIds: string[]) => {
      return audioPlaylists.create(name, audioIds);
    }
  );

  ipcMain.handle(
    "rename-audio-playlist",
    (_event, playlistId: string, name: string) => {
      return audioPlaylists.rename(playlistId, name);
    }
  );

  ipcMain.handle("delete-audio-playlist", (_event, playlistId: string) => {
    return audioPlaylists.delete(playlistId);
  });

  ipcMain.handle(
    "set-audio-playlist-loop",
    (_event, playlistId: string, loop: boolean) => {
      const queue = stateManager.getState().audio.queue;
      if (queue.source === "playlist" && queue.playlistId === playlistId) {
        stateManager.setQueueLoop(loop);
        return audioPlaylists.getById(playlistId);
      }
      return audioPlaylists.setLoop(playlistId, loop);
    }
  );

  ipcMain.handle(
    "add-tracks-to-playlist",
    (_event, playlistId: string, audioIds: string[]) => {
      return audioPlaylists.addTracks(playlistId, audioIds);
    }
  );

  ipcMain.handle(
    "remove-track-from-playlist",
    (_event, playlistId: string, audioId: string) => {
      return audioPlaylists.removeTrack(playlistId, audioId);
    }
  );

  ipcMain.handle(
    "reorder-playlist",
    (_event, playlistId: string, orderedAudioIds: string[]) => {
      return audioPlaylists.reorder(playlistId, orderedAudioIds);
    }
  );

  ipcMain.handle("get-audio-queue", () => {
    return audioPlaylists.getQueue();
  });

  ipcMain.handle("add-to-queue", (_event, audioIds: string[]) => {
    audioPlaylists.addToQueue(audioIds);
  });

  ipcMain.handle("play-next-in-queue", (_event, audioIds: string[]) => {
    const queue = stateManager.getState().audio.queue;
    const afterIndex = queue.source === "ephemeral" ? queue.index : -1;
    audioPlaylists.playNext(audioIds, afterIndex);
  });

  ipcMain.handle("remove-from-queue", (_event, audioId: string) => {
    audioPlaylists.removeFromQueue(audioId);
  });

  ipcMain.handle("reorder-queue", (_event, orderedAudioIds: string[]) => {
    audioPlaylists.reorderQueue(orderedAudioIds);
  });

  ipcMain.handle("clear-queue", () => {
    audioPlaylists.clearQueue();
  });

  // Queue transport
  ipcMain.handle(
    "play-audio-playlist",
    (_event, playlistId: string, startIndex?: number) => {
      stateManager.playPlaylist(playlistId, startIndex);
    }
  );

  ipcMain.handle("play-audio-queue", (_event, startIndex?: number) => {
    stateManager.playQueue(startIndex);
  });

  ipcMain.handle("next-track", () => {
    stateManager.nextTrack();
  });

  ipcMain.handle("previous-track", () => {
    stateManager.previousTrack();
  });

  ipcMain.handle("set-queue-loop", (_event, loop: boolean) => {
    stateManager.setQueueLoop(loop);
  });

  ipcMain.handle("audio-ended", () => {
    stateManager.handleAudioEnded();
  });

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

  // Image Library handlers
  const imageLibrary = getImageLibrary();

  imageLibrary.validateLibrary();

  imageLibrary.onLibraryChange((images) => {
    windowManager.broadcastToAll("image-library-update", images);
  });

  imageLibrary.onSlideshowsChange((slideshows) => {
    windowManager.broadcastToAll("slideshows-update", slideshows);
  });

  imageLibrary.onUploadProgress((progress) => {
    windowManager.broadcastToAll("image-upload-progress", progress);
  });

  ipcMain.handle("get-image-library", () => {
    return imageLibrary.getAll();
  });

  ipcMain.handle("get-slideshows", () => {
    return imageLibrary.getAllSlideshows();
  });

  ipcMain.handle("add-local-images", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Images",
          extensions: IMAGE_EXTENSIONS_NO_DOT,
        },
      ],
    });

    const images = [];
    for (const filePath of result.filePaths) {
      try {
        const image = await imageLibrary.addImage(filePath, "local");
        images.push(image);
      } catch (error) {
        console.error(`Failed to add image ${filePath}:`, error);
      }
    }
    return images;
  });

  ipcMain.handle("delete-image", async (_event, imageId: string) => {
    return imageLibrary.deleteImage(imageId);
  });

  ipcMain.handle("rename-image", (_event, imageId: string, newName: string) => {
    return imageLibrary.renameImage(imageId, newName);
  });

  ipcMain.handle(
    "create-slideshow",
    (_event, name: string, imageIds: string[]) => {
      return imageLibrary.createSlideshow(name, imageIds);
    }
  );

  ipcMain.handle(
    "update-slideshow",
    (_event, slideshowId: string, updates: Record<string, unknown>) => {
      return imageLibrary.updateSlideshow(slideshowId, updates);
    }
  );

  ipcMain.handle("delete-slideshow", (_event, slideshowId: string) => {
    return imageLibrary.deleteSlideshow(slideshowId);
  });

  ipcMain.handle(
    "add-images-to-slideshow",
    (_event, slideshowId: string, imageIds: string[]) => {
      imageLibrary.addImagesToSlideshow(slideshowId, imageIds);
    }
  );

  ipcMain.handle("remove-image-from-slideshow", (_event, imageId: string) => {
    imageLibrary.removeImageFromSlideshow(imageId);
  });

  ipcMain.handle(
    "reorder-slideshow-images",
    (_event, slideshowId: string, orderedImageIds: string[]) => {
      imageLibrary.reorderSlideshowImages(slideshowId, orderedImageIds);
    }
  );

  // Image presentation
  ipcMain.handle("load-image", (_event, src: string, imageId: string) => {
    stateManager.loadImage(src, imageId);
  });

  ipcMain.handle("load-slideshow", (_event, slideshowId: string) => {
    const data = imageLibrary.getSlideshowPresentationData(slideshowId);
    if (data) stateManager.loadSlideshow(data.images, data.slideshowId, data.settings);
  });

  ipcMain.handle("next-image", () => {
    stateManager.nextImage();
  });

  ipcMain.handle("prev-image", () => {
    stateManager.prevImage();
  });

  ipcMain.handle("go-to-image", (_event, index: number) => {
    stateManager.goToImage(index);
  });

  ipcMain.handle("set-image-auto-advance", (_event, enabled: boolean) => {
    stateManager.setImageAutoAdvance(enabled);
  });

  ipcMain.handle("set-image-fit", (_event, fit: "fill" | "fit") => {
    stateManager.setImageFit(fit);
  });

  ipcMain.handle("set-image-loop", (_event, loop: boolean) => {
    stateManager.setImageLoop(loop);
  });

  ipcMain.handle("set-image-auto-advance-interval", (_event, intervalMs: number) => {
    stateManager.setImageAutoAdvanceInterval(intervalMs);
  });

  // File Transfers
  const transferManager = getTransferManager();

  transferManager.onTransfersChange((transfers) => {
    windowManager.broadcastToAll("transfers-update", transfers);
  });

  ipcMain.handle("get-transfers", () => {
    return transferManager.getAll();
  });

  ipcMain.handle("delete-transfer", (_event, id: string) => {
    return transferManager.deleteTransfer(id);
  });

  ipcMain.handle("add-transfer-to-video", async (_event, id: string) => {
    const transfer = transferManager.getById(id);
    if (!transfer) return null;
    const videoLibrary = getVideoLibrary();
    const video = await videoLibrary.addVideo(transfer.path, "upload", {
      name: transfer.name,
      copyToLibrary: true,
    });
    transferManager.markAddedToLibrary(id, "video");
    return video;
  });

  ipcMain.handle("add-transfer-to-audio", async (_event, id: string) => {
    const transfer = transferManager.getById(id);
    if (!transfer) return null;
    const audioLibrary = getAudioLibrary();
    const audio = await audioLibrary.addAudio(transfer.path, "upload", {
      name: transfer.name,
      copyToLibrary: true,
    });
    transferManager.markAddedToLibrary(id, "audio");
    return audio;
  });

  ipcMain.handle("add-transfer-to-image", async (_event, id: string) => {
    const transfer = transferManager.getById(id);
    if (!transfer) return null;
    const imageLibrary = getImageLibrary();
    const image = await imageLibrary.addImage(transfer.path, "upload", {
      name: transfer.name,
      copyToLibrary: true,
    });
    transferManager.markAddedToLibrary(id, "image");
    return image;
  });
}

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    // Focus existing window if user tries to open another instance
    const remoteWindow = windowManager?.getRemoteWindow();
    if (remoteWindow) {
      if (remoteWindow.isMinimized()) {
        remoteWindow.restore();
      }
      remoteWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindows();
    checkForBinaryUpdates();
    checkForHymnAssetUpdates();
  });
}

// Track whether we're in the process of quitting
let isQuitting = false;

app.on("before-quit", (event) => {
  if (!isQuitting) {
    isQuitting = true;
    event.preventDefault();

    console.log("Cleaning up before quit...");

    // Kill all active yt-dlp/ffmpeg downloads
    killAllDownloads();

    // Clear audio scheduler timers
    const scheduler = getAudioScheduler();
    if (scheduler) {
      scheduler.clearAllTimers();
    }

    // Close the Express/Socket.io server, then force exit
    // Hard timeout ensures we always exit even if server.close() hangs
    const forceExit = setTimeout(() => app.exit(0), 2000);
    closeServer()
      .then(() => {
        clearTimeout(forceExit);
        app.exit(0);
      })
      .catch(() => {
        clearTimeout(forceExit);
        app.exit(0);
      });
  }
});

app.on("window-all-closed", () => {
  // Always quit, even on macOS
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindows();
  }
});
