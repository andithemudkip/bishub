import {
  contextBridge,
  ipcRenderer,
  type IpcRendererEvent,
  type FileFilter,
} from "electron";
import type {
  DisplayState,
  AppSettings,
  MonitorInfo,
  Hymn,
  HymnSearchResult,
  BibleVerse,
  BibleSearchResult,
  UpdateStatus,
  MP3DownloadProgress,
  MP3CacheStats,
  BinaryInfo,
  DeviceInfo,
  HymnPlaybackMode,
  ChromeSizeKey,
  PptxImportResult,
  HymnCommitResult,
  BibleTranslationStatus,
} from "../src/shared/types";
import type {
  VideoItem,
  DownloadProgress,
  UploadProgress,
} from "../src/shared/videoLibrary.types";
import type {
  AudioItem,
  AudioUploadProgress,
  AudioDownloadProgress,
  DirectoryImportProgress,
} from "../src/shared/audioLibrary.types";
import type { AudioPlaylist } from "../src/shared/audioPlaylist.types";
import type {
  AudioSchedule,
  ScheduleEvent,
  CreateScheduleParams,
  UpdateScheduleParams,
} from "../src/shared/audioSchedule.types";
import type { TransferItem, TransferUploadProgress } from "../src/shared/transfer.types";
import type { HymnalInfo } from "../src/shared/hymnals";
import type {
  ImageItem,
  Slideshow,
  ImageUploadProgress,
} from "../src/shared/imageLibrary.types";

const electronAPI = {
  getState: (): Promise<DisplayState> => ipcRenderer.invoke("get-state"),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke("get-settings"),
  getMonitors: (): Promise<MonitorInfo[]> => ipcRenderer.invoke("get-monitors"),
  getDisplayWindowState: (): Promise<boolean> =>
    ipcRenderer.invoke("get-display-window-state"),
  getHymnals: (): Promise<HymnalInfo[]> => ipcRenderer.invoke("get-hymnals"),
  getLocalIP: (): Promise<string> => ipcRenderer.invoke("get-local-ip"),
  getSecurityKey: (): Promise<string> => ipcRenderer.invoke("get-security-key"),

  // Devices
  getDevices: (): Promise<DeviceInfo[]> => ipcRenderer.invoke("get-devices"),
  renameDevice: (deviceId: string, name: string): Promise<boolean> =>
    ipcRenderer.invoke("rename-device", deviceId, name),
  revokeDevice: (deviceId: string): Promise<boolean> =>
    ipcRenderer.invoke("revoke-device", deviceId),
  onDevicesUpdate: (callback: (devices: DeviceInfo[]) => void) => {
    const handler = (_event: IpcRendererEvent, devices: DeviceInfo[]) => callback(devices);
    ipcRenderer.on("devices-update", handler);
    return () => { ipcRenderer.removeListener("devices-update", handler); };
  },
  onConnectedDevicesUpdate: (callback: (ids: string[]) => void) => {
    const handler = (_event: IpcRendererEvent, ids: string[]) => callback(ids);
    ipcRenderer.on("connected-devices-update", handler);
    return () => { ipcRenderer.removeListener("connected-devices-update", handler); };
  },

  // Updates
  getAppVersion: (): Promise<string> => ipcRenderer.invoke("get-app-version"),
  getBinaryInfo: (): Promise<BinaryInfo[]> => ipcRenderer.invoke("get-binary-info"),
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke("check-for-updates"),
  installUpdate: (): Promise<void> => ipcRenderer.invoke("install-update"),
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    const handler = (_event: IpcRendererEvent, status: UpdateStatus) =>
      callback(status);
    ipcRenderer.on("update-status", handler);
    return () => { ipcRenderer.removeListener("update-status", handler); };
  },

  setMode: (mode: string): Promise<void> =>
    ipcRenderer.invoke("set-mode", mode),
  loadText: (title: string, content: string): Promise<void> =>
    ipcRenderer.invoke("load-text", title, content),
  nextSlide: (): Promise<void> => ipcRenderer.invoke("next-slide"),
  prevSlide: (): Promise<void> => ipcRenderer.invoke("prev-slide"),
  goToSlide: (index: number): Promise<void> =>
    ipcRenderer.invoke("go-to-slide", index),

  loadVideo: (src: string, videoId?: string): Promise<void> =>
    ipcRenderer.invoke("load-video", src, videoId),
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
  setSyncedLyrics: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke("set-synced-lyrics", enabled),
  setInstrumentals: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke("set-instrumentals", enabled),
  setChromeSize: (key: ChromeSizeKey, size: number): Promise<void> =>
    ipcRenderer.invoke("set-chrome-size", key, size),
  setSlideBackground: (from: string, to: string): Promise<void> =>
    ipcRenderer.invoke("set-slide-background", from, to),
  setBibleBackground: (
    enabled: boolean,
    from: string,
    to: string,
  ): Promise<void> =>
    ipcRenderer.invoke("set-bible-background", enabled, from, to),
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

  openFileDialog: (filters: FileFilter[]): Promise<string | null> =>
    ipcRenderer.invoke("open-file-dialog", filters),

  videoTimeUpdate: (time: number, duration: number): Promise<void> =>
    ipcRenderer.invoke("video-time-update", time, duration),

  // Hymns
  getHymns: (slug?: string): Promise<Hymn[]> =>
    ipcRenderer.invoke("get-hymns", slug),
  searchHymns: (query: string, slug?: string): Promise<Hymn[]> =>
    ipcRenderer.invoke("search-hymns", query, slug),
  loadHymn: (
    slug: string,
    hymnNumber: string,
    playbackMode?: HymnPlaybackMode,
  ): Promise<void> =>
    ipcRenderer.invoke("load-hymn", slug, hymnNumber, playbackMode),
  searchAllHymns: (query: string): Promise<HymnSearchResult[]> =>
    ipcRenderer.invoke("search-all-hymns", query),
  setHymnal: (slug: string): Promise<void> =>
    ipcRenderer.invoke("set-hymnal", slug),

  // Hymn import. Opens the native picker and returns one result per chosen
  // file; the web remote uploads to /api/hymns/import for the same shape.
  importPptx: (): Promise<PptxImportResult[]> =>
    ipcRenderer.invoke("import-pptx"),
  commitHymnImport: (
    hymn: Hymn,
    fileName?: string,
  ): Promise<HymnCommitResult> =>
    ipcRenderer.invoke("commit-hymn-import", hymn, fileName),
  deleteCustomHymn: (slug: string, hymnNumber: string): Promise<boolean> =>
    ipcRenderer.invoke("delete-custom-hymn", slug, hymnNumber),

  // Hymn karaoke MP3 cache
  downloadHymnMP3: (hymnNumber: string): Promise<void> =>
    ipcRenderer.invoke("download-hymn-mp3", hymnNumber),
  downloadAllHymnMP3s: (): Promise<void> =>
    ipcRenderer.invoke("download-all-hymn-mp3s"),
  cancelHymnMP3Download: (hymnNumber: string): Promise<void> =>
    ipcRenderer.invoke("cancel-hymn-mp3-download", hymnNumber),
  cancelAllHymnMP3Downloads: (): Promise<void> =>
    ipcRenderer.invoke("cancel-all-hymn-mp3-downloads"),
  clearHymnMP3Cache: (): Promise<void> =>
    ipcRenderer.invoke("clear-hymn-mp3-cache"),
  getHymnMP3CacheStats: (): Promise<MP3CacheStats> =>
    ipcRenderer.invoke("get-hymn-mp3-cache-stats"),
  setKaraokeBannerDismissed: (dismissed: boolean): Promise<void> =>
    ipcRenderer.invoke("set-karaoke-banner-dismissed", dismissed),

  onHymnMP3DownloadProgress: (
    callback: (progress: MP3DownloadProgress) => void,
  ) => {
    const handler = (_event: IpcRendererEvent, progress: MP3DownloadProgress) => callback(progress);
    ipcRenderer.on("hymn-mp3-download-progress", handler);
    return () => { ipcRenderer.removeListener("hymn-mp3-download-progress", handler); };
  },
  onHymnMP3CacheStats: (callback: (stats: MP3CacheStats) => void) => {
    const handler = (_event: IpcRendererEvent, stats: MP3CacheStats) => callback(stats);
    ipcRenderer.on("hymn-mp3-cache-stats", handler);
    return () => { ipcRenderer.removeListener("hymn-mp3-cache-stats", handler); };
  },
  onHymnsUpdate: (callback: (slug: string, hymns: Hymn[]) => void) => {
    const handler = (_event: IpcRendererEvent, slug: string, hymns: Hymn[]) =>
        callback(slug, hymns);
    ipcRenderer.on("hymns-update", handler);
    return () => { ipcRenderer.removeListener("hymns-update", handler); };
  },

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
  searchBibleVerses: (query: string): Promise<BibleSearchResult[]> =>
    ipcRenderer.invoke("search-bible-verses", query),
  setBibleTranslation: (
    translationId: string
  ): Promise<{ status: string; error?: string }> =>
    ipcRenderer.invoke("set-bible-translation", translationId),
  onBibleTranslationStatus: (callback: (status: BibleTranslationStatus) => void) => {
    const handler = (_event: IpcRendererEvent, status: BibleTranslationStatus) =>
      callback(status);
    ipcRenderer.on("bible-translation-status", handler);
    return () => { ipcRenderer.removeListener("bible-translation-status", handler); };
  },
  getDownloadedTranslations: (): Promise<string[]> =>
    ipcRenderer.invoke("get-downloaded-translations"),

  // Video Library
  getVideoLibrary: (): Promise<VideoItem[]> =>
    ipcRenderer.invoke("get-video-library"),
  addLocalVideo: (): Promise<VideoItem[]> =>
    ipcRenderer.invoke("add-local-video"),
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
    const handler = (_event: IpcRendererEvent, videos: VideoItem[]) =>
      callback(videos);
    ipcRenderer.on("video-library-update", handler);
    return () => { ipcRenderer.removeListener("video-library-update", handler); };
  },

  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
    const handler = (_event: IpcRendererEvent, progress: DownloadProgress) => callback(progress);
    ipcRenderer.on("download-progress", handler);
    return () => { ipcRenderer.removeListener("download-progress", handler); };
  },

  onUploadProgress: (callback: (progress: UploadProgress) => void) => {
    const handler = (_event: IpcRendererEvent, progress: UploadProgress) =>
      callback(progress);
    ipcRenderer.on("upload-progress", handler);
    return () => { ipcRenderer.removeListener("upload-progress", handler); };
  },

  showItemInFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke("show-item-in-folder", filePath),

  // Audio Library
  getAudioLibrary: (): Promise<AudioItem[]> =>
    ipcRenderer.invoke("get-audio-library"),
  addLocalAudio: (): Promise<AudioItem[]> =>
    ipcRenderer.invoke("add-local-audio"),
  addLocalAudioDirectory: (): Promise<{
    completed: AudioItem[];
    errors: { file: string; error: string }[];
  }> => ipcRenderer.invoke("add-local-audio-directory"),
  deleteAudio: (audioId: string): Promise<boolean> =>
    ipcRenderer.invoke("delete-audio", audioId),
  renameAudio: (audioId: string, newName: string): Promise<AudioItem> =>
    ipcRenderer.invoke("rename-audio", audioId, newName),
  downloadYouTubeAudio: (url: string): Promise<AudioDownloadProgress> =>
    ipcRenderer.invoke("download-youtube-audio", url),
  cancelYouTubeAudioDownload: (downloadId: string): Promise<boolean> =>
    ipcRenderer.invoke("cancel-youtube-audio-download", downloadId),
  getActiveAudioDownloads: (): Promise<AudioDownloadProgress[]> =>
    ipcRenderer.invoke("get-active-audio-downloads"),

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

  // Audio Playlists
  getAudioPlaylists: (): Promise<AudioPlaylist[]> =>
    ipcRenderer.invoke("get-audio-playlists"),
  createAudioPlaylist: (
    name: string,
    audioIds: string[]
  ): Promise<AudioPlaylist> =>
    ipcRenderer.invoke("create-audio-playlist", name, audioIds),
  renameAudioPlaylist: (
    playlistId: string,
    name: string
  ): Promise<AudioPlaylist | null> =>
    ipcRenderer.invoke("rename-audio-playlist", playlistId, name),
  deleteAudioPlaylist: (playlistId: string): Promise<boolean> =>
    ipcRenderer.invoke("delete-audio-playlist", playlistId),
  setAudioPlaylistLoop: (
    playlistId: string,
    loop: boolean
  ): Promise<AudioPlaylist | null> =>
    ipcRenderer.invoke("set-audio-playlist-loop", playlistId, loop),
  addTracksToPlaylist: (
    playlistId: string,
    audioIds: string[]
  ): Promise<AudioPlaylist | null> =>
    ipcRenderer.invoke("add-tracks-to-playlist", playlistId, audioIds),
  removeTrackFromPlaylist: (
    playlistId: string,
    audioId: string
  ): Promise<AudioPlaylist | null> =>
    ipcRenderer.invoke("remove-track-from-playlist", playlistId, audioId),
  reorderPlaylist: (
    playlistId: string,
    orderedAudioIds: string[]
  ): Promise<AudioPlaylist | null> =>
    ipcRenderer.invoke("reorder-playlist", playlistId, orderedAudioIds),

  onAudioPlaylistsUpdate: (
    callback: (playlists: AudioPlaylist[]) => void
  ) => {
    const handler = (_event: IpcRendererEvent, playlists: AudioPlaylist[]) =>
        callback(playlists);
    ipcRenderer.on("audio-playlists-update", handler);
    return () => { ipcRenderer.removeListener("audio-playlists-update", handler); };
  },

  // Up Next (ephemeral queue)
  getAudioQueue: (): Promise<string[]> =>
    ipcRenderer.invoke("get-audio-queue"),
  addToQueue: (audioIds: string[]): Promise<void> =>
    ipcRenderer.invoke("add-to-queue", audioIds),
  playNextInQueue: (audioIds: string[]): Promise<void> =>
    ipcRenderer.invoke("play-next-in-queue", audioIds),
  removeFromQueue: (audioId: string): Promise<void> =>
    ipcRenderer.invoke("remove-from-queue", audioId),
  reorderQueue: (orderedAudioIds: string[]): Promise<void> =>
    ipcRenderer.invoke("reorder-queue", orderedAudioIds),
  clearQueue: (): Promise<void> => ipcRenderer.invoke("clear-queue"),

  onAudioQueueUpdate: (callback: (audioIds: string[]) => void) => {
    const handler = (_event: IpcRendererEvent, audioIds: string[]) => callback(audioIds);
    ipcRenderer.on("audio-queue-update", handler);
    return () => { ipcRenderer.removeListener("audio-queue-update", handler); };
  },

  // Queue transport
  playAudioPlaylist: (playlistId: string, startIndex?: number): Promise<void> =>
    ipcRenderer.invoke("play-audio-playlist", playlistId, startIndex),
  playAudioQueue: (startIndex?: number): Promise<void> =>
    ipcRenderer.invoke("play-audio-queue", startIndex),
  nextTrack: (): Promise<void> => ipcRenderer.invoke("next-track"),
  previousTrack: (): Promise<void> => ipcRenderer.invoke("previous-track"),
  setQueueLoop: (loop: boolean): Promise<void> =>
    ipcRenderer.invoke("set-queue-loop", loop),
  audioEnded: (): Promise<void> => ipcRenderer.invoke("audio-ended"),
  audioError: (): Promise<void> => ipcRenderer.invoke("audio-error"),

  onAudioLibraryUpdate: (callback: (audios: AudioItem[]) => void) => {
    const handler = (_event: IpcRendererEvent, audios: AudioItem[]) =>
      callback(audios);
    ipcRenderer.on("audio-library-update", handler);
    return () => { ipcRenderer.removeListener("audio-library-update", handler); };
  },

  onAudioUploadProgress: (
    callback: (progress: AudioUploadProgress) => void
  ) => {
    const handler = (_event: IpcRendererEvent, progress: AudioUploadProgress) => callback(progress);
    ipcRenderer.on("audio-upload-progress", handler);
    return () => { ipcRenderer.removeListener("audio-upload-progress", handler); };
  },

  onAudioDownloadProgress: (
    callback: (progress: AudioDownloadProgress) => void
  ) => {
    const handler = (_event: IpcRendererEvent, progress: AudioDownloadProgress) => callback(progress);
    ipcRenderer.on("audio-download-progress", handler);
    return () => { ipcRenderer.removeListener("audio-download-progress", handler); };
  },

  onAudioDirectoryImportProgress: (
    callback: (progress: DirectoryImportProgress) => void
  ) => {
    const handler = (_event: IpcRendererEvent, progress: DirectoryImportProgress) => callback(progress);
    ipcRenderer.on("audio-directory-import-progress", handler);
    return () => { ipcRenderer.removeListener("audio-directory-import-progress", handler); };
  },

  // Audio Scheduling
  getAudioSchedules: (): Promise<AudioSchedule[]> =>
    ipcRenderer.invoke("get-audio-schedules"),
  createAudioSchedule: (params: CreateScheduleParams): Promise<AudioSchedule> =>
    ipcRenderer.invoke("create-audio-schedule", params),
  updateAudioSchedule: (
    params: UpdateScheduleParams
  ): Promise<AudioSchedule | null> =>
    ipcRenderer.invoke("update-audio-schedule", params),
  deleteAudioSchedule: (scheduleId: string): Promise<boolean> =>
    ipcRenderer.invoke("delete-audio-schedule", scheduleId),

  onAudioSchedulesUpdate: (callback: (schedules: AudioSchedule[]) => void) => {
    const handler = (_event: IpcRendererEvent, schedules: AudioSchedule[]) => callback(schedules);
    ipcRenderer.on("audio-schedules-update", handler);
    return () => { ipcRenderer.removeListener("audio-schedules-update", handler); };
  },
  onAudioScheduleEvent: (callback: (event: ScheduleEvent) => void) => {
    const handler = (_event: IpcRendererEvent, event: ScheduleEvent) => callback(event);
    ipcRenderer.on("audio-schedule-event", handler);
    return () => { ipcRenderer.removeListener("audio-schedule-event", handler); };
  },

  // Image Library
  getImageLibrary: (): Promise<ImageItem[]> =>
    ipcRenderer.invoke("get-image-library"),
  getSlideshows: (): Promise<Slideshow[]> =>
    ipcRenderer.invoke("get-slideshows"),
  addLocalImages: (): Promise<ImageItem[]> =>
    ipcRenderer.invoke("add-local-images"),
  deleteImage: (imageId: string): Promise<boolean> =>
    ipcRenderer.invoke("delete-image", imageId),
  renameImage: (imageId: string, newName: string): Promise<ImageItem | null> =>
    ipcRenderer.invoke("rename-image", imageId, newName),
  createSlideshow: (
    name: string,
    imageIds: string[]
  ): Promise<Slideshow | null> =>
    ipcRenderer.invoke("create-slideshow", name, imageIds),
  updateSlideshow: (
    slideshowId: string,
    updates: Partial<Omit<Slideshow, "id" | "createdAt">>
  ): Promise<Slideshow | null> =>
    ipcRenderer.invoke("update-slideshow", slideshowId, updates),
  deleteSlideshow: (slideshowId: string): Promise<boolean> =>
    ipcRenderer.invoke("delete-slideshow", slideshowId),
  addImagesToSlideshow: (
    slideshowId: string,
    imageIds: string[]
  ): Promise<void> =>
    ipcRenderer.invoke("add-images-to-slideshow", slideshowId, imageIds),
  removeImageFromSlideshow: (imageId: string): Promise<void> =>
    ipcRenderer.invoke("remove-image-from-slideshow", imageId),
  reorderSlideshowImages: (
    slideshowId: string,
    orderedImageIds: string[]
  ): Promise<void> =>
    ipcRenderer.invoke("reorder-slideshow-images", slideshowId, orderedImageIds),
  loadImageToDisplay: (src: string, imageId: string): Promise<void> =>
    ipcRenderer.invoke("load-image", src, imageId),
  loadSlideshowToDisplay: (slideshowId: string): Promise<void> =>
    ipcRenderer.invoke("load-slideshow", slideshowId),
  nextImage: (): Promise<void> => ipcRenderer.invoke("next-image"),
  prevImage: (): Promise<void> => ipcRenderer.invoke("prev-image"),
  goToImage: (index: number): Promise<void> =>
    ipcRenderer.invoke("go-to-image", index),
  setImageAutoAdvance: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke("set-image-auto-advance", enabled),
  setImageFit: (fit: "fill" | "fit"): Promise<void> =>
    ipcRenderer.invoke("set-image-fit", fit),
  setImageLoop: (loop: boolean): Promise<void> =>
    ipcRenderer.invoke("set-image-loop", loop),
  setImageAutoAdvanceInterval: (intervalMs: number): Promise<void> =>
    ipcRenderer.invoke("set-image-auto-advance-interval", intervalMs),

  onImageLibraryUpdate: (callback: (images: ImageItem[]) => void) => {
    const handler = (_event: IpcRendererEvent, images: ImageItem[]) => callback(images);
    ipcRenderer.on("image-library-update", handler);
    return () => { ipcRenderer.removeListener("image-library-update", handler); };
  },

  onSlideshowsUpdate: (callback: (slideshows: Slideshow[]) => void) => {
    const handler = (_event: IpcRendererEvent, slideshows: Slideshow[]) => callback(slideshows);
    ipcRenderer.on("slideshows-update", handler);
    return () => { ipcRenderer.removeListener("slideshows-update", handler); };
  },

  onImageUploadProgress: (
    callback: (progress: ImageUploadProgress) => void
  ) => {
    const handler = (_event: IpcRendererEvent, progress: ImageUploadProgress) => callback(progress);
    ipcRenderer.on("image-upload-progress", handler);
    return () => { ipcRenderer.removeListener("image-upload-progress", handler); };
  },

  // File Transfers
  getTransfers: (): Promise<TransferItem[]> =>
    ipcRenderer.invoke("get-transfers"),
  deleteTransfer: (id: string): Promise<boolean> =>
    ipcRenderer.invoke("delete-transfer", id),
  addTransferToVideo: (id: string): Promise<VideoItem | null> =>
    ipcRenderer.invoke("add-transfer-to-video", id),
  addTransferToAudio: (id: string): Promise<AudioItem | null> =>
    ipcRenderer.invoke("add-transfer-to-audio", id),
  addTransferToImage: (id: string): Promise<ImageItem | null> =>
    ipcRenderer.invoke("add-transfer-to-image", id),
  onTransfersUpdate: (callback: (transfers: TransferItem[]) => void) => {
    const handler = (_event: IpcRendererEvent, transfers: TransferItem[]) => callback(transfers);
    ipcRenderer.on("transfers-update", handler);
    return () => { ipcRenderer.removeListener("transfers-update", handler); };
  },

  onTransferUploadProgress: (callback: (progress: TransferUploadProgress) => void) => {
    const handler = (_event: IpcRendererEvent, progress: TransferUploadProgress) =>
      callback(progress);
    ipcRenderer.on("transfer-upload-progress", handler);
    return () => { ipcRenderer.removeListener("transfer-upload-progress", handler); };
  },

  onStateUpdate: (callback: (state: DisplayState) => void) => {
    const handler = (_event: IpcRendererEvent, state: DisplayState) =>
      callback(state);
    ipcRenderer.on("state-update", handler);
    return () => { ipcRenderer.removeListener("state-update", handler); };
  },

  onSettingsUpdate: (callback: (settings: AppSettings) => void) => {
    const handler = (_event: IpcRendererEvent, settings: AppSettings) =>
      callback(settings);
    ipcRenderer.on("settings-update", handler);
    return () => { ipcRenderer.removeListener("settings-update", handler); };
  },

  onMonitorsUpdate: (callback: (monitors: MonitorInfo[]) => void) => {
    const handler = (_event: IpcRendererEvent, monitors: MonitorInfo[]) =>
      callback(monitors);
    ipcRenderer.on("monitors-update", handler);
    return () => { ipcRenderer.removeListener("monitors-update", handler); };
  },

  onDisplayWindowState: (callback: (open: boolean) => void) => {
    const handler = (_event: IpcRendererEvent, open: boolean) => callback(open);
    ipcRenderer.on("display-window-state", handler);
    return () => { ipcRenderer.removeListener("display-window-state", handler); };
  },

  onHymnalsUpdate: (callback: (hymnals: HymnalInfo[]) => void) => {
    const handler = (_event: IpcRendererEvent, hymnals: HymnalInfo[]) =>
      callback(hymnals);
    ipcRenderer.on("hymnals-update", handler);
    return () => { ipcRenderer.removeListener("hymnals-update", handler); };
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

export type ElectronAPI = typeof electronAPI;
