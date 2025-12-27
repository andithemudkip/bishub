const { contextBridge, ipcRenderer } = require("electron");

const electronAPI = {
  getState: (): Promise<any> => ipcRenderer.invoke("get-state"),
  getSettings: (): Promise<any> => ipcRenderer.invoke("get-settings"),
  getMonitors: (): Promise<any[]> => ipcRenderer.invoke("get-monitors"),
  getLocalIP: (): Promise<string> => ipcRenderer.invoke("get-local-ip"),
  getSecurityKey: (): Promise<string> => ipcRenderer.invoke("get-security-key"),

  // Updates
  getAppVersion: (): Promise<string> => ipcRenderer.invoke("get-app-version"),
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke("check-for-updates"),
  installUpdate: (): Promise<void> => ipcRenderer.invoke("install-update"),
  onUpdateStatus: (callback: (status: any) => void) => {
    ipcRenderer.on("update-status", (_event: any, status: any) =>
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
  getHymns: (): Promise<any[]> => ipcRenderer.invoke("get-hymns"),
  searchHymns: (query: string): Promise<any[]> =>
    ipcRenderer.invoke("search-hymns", query),
  loadHymn: (hymnNumber: string): Promise<void> =>
    ipcRenderer.invoke("load-hymn", hymnNumber),

  // Bible
  getBibleBooks: (): Promise<any[]> => ipcRenderer.invoke("get-bible-books"),
  getBibleChapter: (bookId: string, chapter: number): Promise<any[]> =>
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
  getVideoLibrary: (): Promise<any[]> =>
    ipcRenderer.invoke("get-video-library"),
  addLocalVideo: (): Promise<any> => ipcRenderer.invoke("add-local-video"),
  deleteVideo: (videoId: string): Promise<boolean> =>
    ipcRenderer.invoke("delete-video", videoId),
  renameVideo: (videoId: string, newName: string): Promise<any> =>
    ipcRenderer.invoke("rename-video", videoId, newName),
  downloadYouTubeVideo: (url: string): Promise<any> =>
    ipcRenderer.invoke("download-youtube-video", url),
  cancelYouTubeDownload: (downloadId: string): Promise<boolean> =>
    ipcRenderer.invoke("cancel-youtube-download", downloadId),
  getActiveDownloads: (): Promise<any[]> =>
    ipcRenderer.invoke("get-active-downloads"),
  getVideoThumbnail: (videoId: string): Promise<string | null> =>
    ipcRenderer.invoke("get-video-thumbnail", videoId),

  onVideoLibraryUpdate: (callback: (videos: any[]) => void) => {
    ipcRenderer.on("video-library-update", (_event: any, videos: any[]) =>
      callback(videos)
    );
    return () => ipcRenderer.removeAllListeners("video-library-update");
  },

  onDownloadProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on("download-progress", (_event: any, progress: any) =>
      callback(progress)
    );
    return () => ipcRenderer.removeAllListeners("download-progress");
  },

  onUploadProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on("upload-progress", (_event: any, progress: any) =>
      callback(progress)
    );
    return () => ipcRenderer.removeAllListeners("upload-progress");
  },

  // Audio Library
  getAudioLibrary: (): Promise<any[]> =>
    ipcRenderer.invoke("get-audio-library"),
  addLocalAudio: (): Promise<any> => ipcRenderer.invoke("add-local-audio"),
  addLocalAudioDirectory: (): Promise<{
    completed: any[];
    errors: { file: string; error: string }[];
  }> => ipcRenderer.invoke("add-local-audio-directory"),
  deleteAudio: (audioId: string): Promise<boolean> =>
    ipcRenderer.invoke("delete-audio", audioId),
  renameAudio: (audioId: string, newName: string): Promise<any> =>
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

  onAudioLibraryUpdate: (callback: (audios: any[]) => void) => {
    ipcRenderer.on("audio-library-update", (_event: any, audios: any[]) =>
      callback(audios)
    );
    return () => ipcRenderer.removeAllListeners("audio-library-update");
  },

  onAudioUploadProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on("audio-upload-progress", (_event: any, progress: any) =>
      callback(progress)
    );
    return () => ipcRenderer.removeAllListeners("audio-upload-progress");
  },

  onAudioDirectoryImportProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on(
      "audio-directory-import-progress",
      (_event: any, progress: any) => callback(progress)
    );
    return () =>
      ipcRenderer.removeAllListeners("audio-directory-import-progress");
  },

  // Audio Scheduling
  getAudioSchedules: (): Promise<any[]> =>
    ipcRenderer.invoke("get-audio-schedules"),
  getAudioPresets: (): Promise<any[]> =>
    ipcRenderer.invoke("get-audio-presets"),
  createAudioSchedule: (params: {
    audioId: string;
    audioName: string;
    audioPath: string;
    timeType: "absolute" | "relative";
    absoluteTime?: string;
    relativeMinutes?: number;
  }): Promise<any> => ipcRenderer.invoke("create-audio-schedule", params),
  cancelAudioSchedule: (scheduleId: string): Promise<boolean> =>
    ipcRenderer.invoke("cancel-audio-schedule", scheduleId),
  createAudioPreset: (params: {
    name: string;
    audioId: string;
    audioName: string;
    timeType: "absolute" | "relative";
    hour?: number;
    minute?: number;
    relativeMinutes?: number;
  }): Promise<any> => ipcRenderer.invoke("create-audio-preset", params),
  activateAudioPreset: (
    presetId: string,
    audioPath: string
  ): Promise<any> =>
    ipcRenderer.invoke("activate-audio-preset", presetId, audioPath),
  deleteAudioPreset: (presetId: string): Promise<boolean> =>
    ipcRenderer.invoke("delete-audio-preset", presetId),

  onAudioSchedulesUpdate: (callback: (schedules: any[]) => void) => {
    ipcRenderer.on("audio-schedules-update", (_event: any, schedules: any[]) =>
      callback(schedules)
    );
    return () => ipcRenderer.removeAllListeners("audio-schedules-update");
  },
  onAudioPresetsUpdate: (callback: (presets: any[]) => void) => {
    ipcRenderer.on("audio-presets-update", (_event: any, presets: any[]) =>
      callback(presets)
    );
    return () => ipcRenderer.removeAllListeners("audio-presets-update");
  },
  onAudioScheduleEvent: (callback: (event: any) => void) => {
    ipcRenderer.on("audio-schedule-event", (_event: any, event: any) =>
      callback(event)
    );
    return () => ipcRenderer.removeAllListeners("audio-schedule-event");
  },

  onStateUpdate: (callback: (state: any) => void) => {
    ipcRenderer.on("state-update", (_event: any, state: any) =>
      callback(state)
    );
    return () => ipcRenderer.removeAllListeners("state-update");
  },

  onSettingsUpdate: (callback: (settings: any) => void) => {
    ipcRenderer.on("settings-update", (_event: any, settings: any) =>
      callback(settings)
    );
    return () => ipcRenderer.removeAllListeners("settings-update");
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
