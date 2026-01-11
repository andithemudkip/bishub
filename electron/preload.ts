const { contextBridge, ipcRenderer } = require("electron");
import type {
  DisplayState,
  AppSettings,
  MonitorInfo,
  Hymn,
  BibleVerse,
  UpdateStatus,
} from "../src/shared/types";
import type {
  VideoItem,
  DownloadProgress,
  UploadProgress,
} from "../src/shared/videoLibrary.types";
import type {
  AudioItem,
  AudioUploadProgress,
  DirectoryImportProgress,
} from "../src/shared/audioLibrary.types";
import type {
  AudioSchedule,
  AudioSchedulePreset,
  ScheduleEvent,
  CreateScheduleParams,
  CreatePresetParams,
} from "../src/shared/audioSchedule.types";

const electronAPI = {
  getState: (): Promise<DisplayState> => ipcRenderer.invoke("get-state"),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke("get-settings"),
  getMonitors: (): Promise<MonitorInfo[]> => ipcRenderer.invoke("get-monitors"),
  getLocalIP: (): Promise<string> => ipcRenderer.invoke("get-local-ip"),
  getSecurityKey: (): Promise<string> => ipcRenderer.invoke("get-security-key"),

  // Updates
  getAppVersion: (): Promise<string> => ipcRenderer.invoke("get-app-version"),
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke("check-for-updates"),
  installUpdate: (): Promise<void> => ipcRenderer.invoke("install-update"),
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    ipcRenderer.on("update-status", (_event: any, status: UpdateStatus) =>
      callback(status)
    );
    return () => ipcRenderer.removeAllListeners("update-status");
  },

  setMode: (mode: string): Promise<void> =>
    ipcRenderer.invoke("set-mode", mode),
  loadText: (title: string, content: string): Promise<void> =>
    ipcRenderer.invoke("load-text", title, content),
  nextSlide: (): Promise<void> => ipcRenderer.invoke("next-slide"),
  prevSlide: (): Promise<void> => ipcRenderer.invoke("prev-slide"),
  goToSlide: (index: number): Promise<void> =>
    ipcRenderer.invoke("go-to-slide", index),

  loadVideo: (src: string): Promise<void> =>
    ipcRenderer.invoke("load-video", src),
  playVideo: (): Promise<void> => ipcRenderer.invoke("play-video"),
  pauseVideo: (): Promise<void> => ipcRenderer.invoke("pause-video"),
  stopVideo: (): Promise<void> => ipcRenderer.invoke("stop-video"),
  seekVideo: (time: number): Promise<void> =>
    ipcRenderer.invoke("seek-video", time),
  setVolume: (volume: number): Promise<void> =>
    ipcRenderer.invoke("set-volume", volume),

  setDisplayMonitor: (monitorId: number): Promise<void> =>
    ipcRenderer.invoke("set-display-monitor", monitorId),
  setLanguage: (language: string): Promise<void> =>
    ipcRenderer.invoke("set-language", language),
  setOpenOnStartup: (openOnStartup: boolean): Promise<void> =>
    ipcRenderer.invoke("set-open-on-startup", openOnStartup),
  getOpenOnStartup: (): Promise<boolean> =>
    ipcRenderer.invoke("get-open-on-startup"),
  goIdle: (): Promise<void> => ipcRenderer.invoke("go-idle"),

  // Idle screen settings
  setIdleWallpaper: (selectNew: boolean = true): Promise<string | null> =>
    ipcRenderer.invoke("set-idle-wallpaper", selectNew),
  setClockFontSize: (size: number): Promise<void> =>
    ipcRenderer.invoke("set-clock-font-size", size),
  setClockPosition: (position: string): Promise<void> =>
    ipcRenderer.invoke("set-clock-position", position),

  openFileDialog: (filters: any[]): Promise<string | null> =>
    ipcRenderer.invoke("open-file-dialog", filters),

  videoTimeUpdate: (time: number, duration: number): Promise<void> =>
    ipcRenderer.invoke("video-time-update", time, duration),

  // Hymns
  getHymns: (): Promise<Hymn[]> => ipcRenderer.invoke("get-hymns"),
  searchHymns: (query: string): Promise<Hymn[]> =>
    ipcRenderer.invoke("search-hymns", query),
  loadHymn: (hymnNumber: string): Promise<void> =>
    ipcRenderer.invoke("load-hymn", hymnNumber),

  // Bible
  getBibleBooks: (): Promise<
    { id: string; name: string; chapterCount: number }[]
  > => ipcRenderer.invoke("get-bible-books"),
  getBibleChapter: (bookId: string, chapter: number): Promise<BibleVerse[]> =>
    ipcRenderer.invoke("get-bible-chapter", bookId, chapter),
  loadBibleVerses: (
    bookId: string,
    bookName: string,
    chapter: number,
    startVerse: number,
    endVerse?: number
  ): Promise<void> =>
    ipcRenderer.invoke(
      "load-bible-verses",
      bookId,
      bookName,
      chapter,
      startVerse,
      endVerse
    ),

  // Video Library
  getVideoLibrary: (): Promise<VideoItem[]> =>
    ipcRenderer.invoke("get-video-library"),
  addLocalVideo: (): Promise<VideoItem> => ipcRenderer.invoke("add-local-video"),
  deleteVideo: (videoId: string): Promise<boolean> =>
    ipcRenderer.invoke("delete-video", videoId),
  renameVideo: (videoId: string, newName: string): Promise<VideoItem> =>
    ipcRenderer.invoke("rename-video", videoId, newName),
  downloadYouTubeVideo: (url: string): Promise<VideoItem> =>
    ipcRenderer.invoke("download-youtube-video", url),
  cancelYouTubeDownload: (downloadId: string): Promise<boolean> =>
    ipcRenderer.invoke("cancel-youtube-download", downloadId),
  getActiveDownloads: (): Promise<DownloadProgress[]> =>
    ipcRenderer.invoke("get-active-downloads"),
  getVideoThumbnail: (videoId: string): Promise<string | null> =>
    ipcRenderer.invoke("get-video-thumbnail", videoId),

  onVideoLibraryUpdate: (callback: (videos: VideoItem[]) => void) => {
    ipcRenderer.on("video-library-update", (_event: any, videos: VideoItem[]) =>
      callback(videos)
    );
    return () => ipcRenderer.removeAllListeners("video-library-update");
  },

  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
    ipcRenderer.on("download-progress", (_event: any, progress: DownloadProgress) =>
      callback(progress)
    );
    return () => ipcRenderer.removeAllListeners("download-progress");
  },

  onUploadProgress: (callback: (progress: UploadProgress) => void) => {
    ipcRenderer.on("upload-progress", (_event: any, progress: UploadProgress) =>
      callback(progress)
    );
    return () => ipcRenderer.removeAllListeners("upload-progress");
  },

  // Audio Library
  getAudioLibrary: (): Promise<AudioItem[]> =>
    ipcRenderer.invoke("get-audio-library"),
  addLocalAudio: (): Promise<AudioItem> => ipcRenderer.invoke("add-local-audio"),
  addLocalAudioDirectory: (): Promise<{
    completed: AudioItem[];
    errors: { file: string; error: string }[];
  }> => ipcRenderer.invoke("add-local-audio-directory"),
  deleteAudio: (audioId: string): Promise<boolean> =>
    ipcRenderer.invoke("delete-audio", audioId),
  renameAudio: (audioId: string, newName: string): Promise<AudioItem> =>
    ipcRenderer.invoke("rename-audio", audioId, newName),

  // Audio playback
  loadAudio: (src: string, name: string): Promise<void> =>
    ipcRenderer.invoke("load-audio", src, name),
  playAudio: (): Promise<void> => ipcRenderer.invoke("play-audio"),
  pauseAudio: (): Promise<void> => ipcRenderer.invoke("pause-audio"),
  stopAudio: (): Promise<void> => ipcRenderer.invoke("stop-audio"),
  seekAudio: (time: number): Promise<void> =>
    ipcRenderer.invoke("seek-audio", time),
  setAudioVolume: (volume: number): Promise<void> =>
    ipcRenderer.invoke("set-audio-volume", volume),
  audioTimeUpdate: (time: number, duration: number): Promise<void> =>
    ipcRenderer.invoke("audio-time-update", time, duration),
  setAudioWidgetPosition: (position: string): Promise<void> =>
    ipcRenderer.invoke("set-audio-widget-position", position),

  onAudioLibraryUpdate: (callback: (audios: AudioItem[]) => void) => {
    ipcRenderer.on("audio-library-update", (_event: any, audios: AudioItem[]) =>
      callback(audios)
    );
    return () => ipcRenderer.removeAllListeners("audio-library-update");
  },

  onAudioUploadProgress: (callback: (progress: AudioUploadProgress) => void) => {
    ipcRenderer.on("audio-upload-progress", (_event: any, progress: AudioUploadProgress) =>
      callback(progress)
    );
    return () => ipcRenderer.removeAllListeners("audio-upload-progress");
  },

  onAudioDirectoryImportProgress: (callback: (progress: DirectoryImportProgress) => void) => {
    ipcRenderer.on(
      "audio-directory-import-progress",
      (_event: any, progress: DirectoryImportProgress) => callback(progress)
    );
    return () =>
      ipcRenderer.removeAllListeners("audio-directory-import-progress");
  },

  // Audio Scheduling
  getAudioSchedules: (): Promise<AudioSchedule[]> =>
    ipcRenderer.invoke("get-audio-schedules"),
  getAudioPresets: (): Promise<AudioSchedulePreset[]> =>
    ipcRenderer.invoke("get-audio-presets"),
  createAudioSchedule: (params: CreateScheduleParams): Promise<AudioSchedule> =>
    ipcRenderer.invoke("create-audio-schedule", params),
  cancelAudioSchedule: (scheduleId: string): Promise<boolean> =>
    ipcRenderer.invoke("cancel-audio-schedule", scheduleId),
  createAudioPreset: (params: CreatePresetParams): Promise<AudioSchedulePreset> =>
    ipcRenderer.invoke("create-audio-preset", params),
  activateAudioPreset: (
    presetId: string,
    audioPath: string
  ): Promise<AudioSchedule> =>
    ipcRenderer.invoke("activate-audio-preset", presetId, audioPath),
  deleteAudioPreset: (presetId: string): Promise<boolean> =>
    ipcRenderer.invoke("delete-audio-preset", presetId),

  onAudioSchedulesUpdate: (callback: (schedules: AudioSchedule[]) => void) => {
    ipcRenderer.on("audio-schedules-update", (_event: any, schedules: AudioSchedule[]) =>
      callback(schedules)
    );
    return () => ipcRenderer.removeAllListeners("audio-schedules-update");
  },
  onAudioPresetsUpdate: (callback: (presets: AudioSchedulePreset[]) => void) => {
    ipcRenderer.on("audio-presets-update", (_event: any, presets: AudioSchedulePreset[]) =>
      callback(presets)
    );
    return () => ipcRenderer.removeAllListeners("audio-presets-update");
  },
  onAudioScheduleEvent: (callback: (event: ScheduleEvent) => void) => {
    ipcRenderer.on("audio-schedule-event", (_event: any, event: ScheduleEvent) =>
      callback(event)
    );
    return () => ipcRenderer.removeAllListeners("audio-schedule-event");
  },

  onStateUpdate: (callback: (state: DisplayState) => void) => {
    ipcRenderer.on("state-update", (_event: any, state: DisplayState) =>
      callback(state)
    );
    return () => ipcRenderer.removeAllListeners("state-update");
  },

  onSettingsUpdate: (callback: (settings: AppSettings) => void) => {
    ipcRenderer.on("settings-update", (_event: any, settings: AppSettings) =>
      callback(settings)
    );
    return () => ipcRenderer.removeAllListeners("settings-update");
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

export type ElectronAPI = typeof electronAPI;
