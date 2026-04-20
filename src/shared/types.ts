import type { Language } from "./i18n";
import type {
  VideoItem,
  DownloadProgress,
  UploadProgress,
} from "./videoLibrary.types";
import type { AudioItem, AudioUploadProgress, AudioDownloadProgress } from "./audioLibrary.types";
import type {
  AudioSchedule,
  AudioSchedulePreset,
  ScheduleEvent,
  CreateScheduleParams,
  CreatePresetParams,
} from "./audioSchedule.types";
import type {
  TransferItem,
  TransferUploadProgress,
} from "./transfer.types";
import type {
  ImageItem,
  Slideshow,
  ImageUploadProgress,
} from "./imageLibrary.types";
import type { ParsedTTML } from "./ttmlParser";

export type DisplayMode = "idle" | "text" | "video" | "image";

export type ClockPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center";

export type AudioWidgetPosition = ClockPosition;

export interface IdleState {
  wallpaper: string | null;
  showClock: boolean;
  clockFontSize: number; // percentage: 50-150, 100 = default
  clockPosition: ClockPosition;
  audioWidgetPosition: AudioWidgetPosition;
}

export type TextContentType = "hymn" | "bible" | "custom";

export interface BibleContext {
  bookId: string;
  bookName: string;
  chapter: number;
  verses: BibleVerse[];
}

export interface TextState {
  title: string;
  slides: string[];
  currentSlide: number;
  contentType: TextContentType;
  bibleContext?: BibleContext;
  syncedLyrics?: ParsedTTML;
}

export interface VideoState {
  src: string | null;
  videoId: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

export interface AudioState {
  src: string | null;
  name: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

export interface ImageState {
  src: string | null;
  imageId: string | null;
  slideshowId: string | null;
  slideshowImages: { src: string; imageId: string }[];
  currentIndex: number;
  autoAdvance: boolean;
  autoAdvanceInterval: number; // ms
  loop: boolean;
  fit: "fill" | "fit";
}

export interface DisplayState {
  mode: DisplayMode;
  idle: IdleState;
  text: TextState;
  video: VideoState;
  audio: AudioState;
  image: ImageState;
}

export interface MonitorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MonitorInfo {
  id: number;
  name: string;
  label: string;
  bounds: MonitorBounds;
  workArea: MonitorBounds;
  scaleFactor: number;
  rotation: 0 | 90 | 180 | 270;
  internal: boolean;
  isPrimary: boolean;
}

export interface AppSettings {
  displayMonitor: number;
  serverPort: number;
  language: Language;
  bibleTranslation: string;
  volume: number;
  audioVolume: number;
  openOnStartup: boolean;
  syncedLyrics: boolean;
  karaokeBannerDismissed: boolean;
}

export type SyncedAvailability = "none" | "ttml-only" | "cached";

export type MP3DownloadStatus =
  | "queued"
  | "downloading"
  | "complete"
  | "error";

export interface MP3DownloadProgress {
  id: string; // hymn number, for updateProgressList compatibility
  hymnNumber: string;
  bytesDownloaded: number;
  bytesTotal: number;
  status: MP3DownloadStatus;
  error?: string;
}

export interface MP3CacheStats {
  count: number;
  sizeBytes: number;
  availableCount: number;
}

export interface DeviceInfo {
  id: string;
  name: string;
  userAgent: string;
  firstSeenAt: number;
  lastSeenAt: number;
}

// Socket.io event types
export type ServerToClientEvents = {
  stateUpdate: (state: DisplayState) => void;
  settingsUpdate: (settings: AppSettings) => void;
  monitors: (monitors: MonitorInfo[]) => void;
  devices: (devices: DeviceInfo[]) => void;
  connectedDeviceIds: (ids: string[]) => void;
  hymns: (hymns: Hymn[]) => void;
  bibleBooks: (
    books: { id: string; name: string; chapterCount: number }[]
  ) => void;
  bibleChapter: (verses: BibleVerse[]) => void;
  bibleSearchResults: (results: BibleSearchResult[]) => void;
  bibleTranslationStatus: (status: { translationId: string; status: "downloading" | "ready" | "error"; progress?: number; error?: string }) => void;
  downloadedTranslations: (ids: string[]) => void;
  // Video Library
  videoLibrary: (videos: VideoItem[]) => void;
  downloadProgress: (progress: DownloadProgress) => void;
  uploadProgress: (progress: UploadProgress) => void;
  // Audio Library
  audioLibrary: (audios: AudioItem[]) => void;
  audioUploadProgress: (progress: AudioUploadProgress) => void;
  audioDownloadProgress: (progress: AudioDownloadProgress) => void;
  // Audio Scheduling
  audioSchedules: (schedules: AudioSchedule[]) => void;
  audioPresets: (presets: AudioSchedulePreset[]) => void;
  audioScheduleEvent: (event: ScheduleEvent) => void;
  // Image Library
  imageLibrary: (images: ImageItem[]) => void;
  slideshows: (slideshows: Slideshow[]) => void;
  imageUploadProgress: (progress: ImageUploadProgress) => void;
  // File Transfers
  transfers: (transfers: TransferItem[]) => void;
  transferUploadProgress: (progress: TransferUploadProgress) => void;
  // Hymn karaoke MP3 downloads
  mp3DownloadProgress: (progress: MP3DownloadProgress) => void;
  mp3CacheStats: (stats: MP3CacheStats) => void;
};

export type ClientToServerEvents = {
  setMode: (mode: DisplayMode) => void;
  loadText: (title: string, content: string) => void;
  nextSlide: () => void;
  prevSlide: () => void;
  goToSlide: (index: number) => void;
  loadVideo: (src: string, videoId?: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekVideo: (time: number) => void;
  setVolume: (volume: number) => void;
  setDisplayMonitor: (monitorId: number) => void;
  setLanguage: (language: Language) => void;
  setSyncedLyrics: (enabled: boolean) => void;
  getMonitors: () => void;
  goIdle: () => void;
  // Devices
  getDevices: () => void;
  renameDevice: (deviceId: string, name: string) => void;
  revokeDevice: (deviceId: string) => void;
  // Hymns
  getHymns: () => void;
  loadHymn: (hymnNumber: string, synced?: boolean) => void;
  // Bible
  getBibleBooks: () => void;
  getBibleChapter: (bookId: string, chapter: number) => void;
  loadBibleVerses: (
    bookId: string,
    bookName: string,
    chapter: number,
    startVerse: number,
    endVerse?: number
  ) => void;
  searchBibleVerses: (query: string) => void;
  setBibleTranslation: (translationId: string) => void;
  getDownloadedTranslations: () => void;
  // Video Library
  getVideoLibrary: () => void;
  deleteVideo: (videoId: string) => void;
  renameVideo: (videoId: string, newName: string) => void;
  downloadYouTubeVideo: (url: string) => void;
  cancelDownload: (downloadId: string) => void;
  // Audio Library
  getAudioLibrary: () => void;
  deleteAudio: (audioId: string) => void;
  renameAudio: (audioId: string, newName: string) => void;
  downloadYouTubeAudio: (url: string) => void;
  cancelAudioDownload: (downloadId: string) => void;
  loadAudio: (src: string, name: string) => void;
  playAudio: () => void;
  pauseAudio: () => void;
  stopAudio: () => void;
  seekAudio: (time: number) => void;
  setAudioVolume: (volume: number) => void;
  // Audio Scheduling
  getAudioSchedules: () => void;
  getAudioPresets: () => void;
  createAudioSchedule: (params: CreateScheduleParams) => void;
  cancelAudioSchedule: (scheduleId: string) => void;
  createAudioPreset: (params: CreatePresetParams) => void;
  activateAudioPreset: (presetId: string, audioPath: string) => void;
  deleteAudioPreset: (presetId: string) => void;
  // Image Library
  getImageLibrary: () => void;
  getSlideshows: () => void;
  deleteImage: (imageId: string) => void;
  renameImage: (imageId: string, newName: string) => void;
  createSlideshow: (name: string, imageIds: string[]) => void;
  updateSlideshow: (
    slideshowId: string,
    updates: Partial<Omit<Slideshow, "id" | "createdAt">>
  ) => void;
  deleteSlideshow: (slideshowId: string) => void;
  addImagesToSlideshow: (slideshowId: string, imageIds: string[]) => void;
  removeImageFromSlideshow: (imageId: string) => void;
  reorderSlideshowImages: (
    slideshowId: string,
    orderedImageIds: string[]
  ) => void;
  loadImage: (src: string, imageId: string) => void;
  loadSlideshow: (slideshowId: string) => void;
  nextImage: () => void;
  prevImage: () => void;
  goToImage: (index: number) => void;
  setImageAutoAdvance: (enabled: boolean) => void;
  setImageFit: (fit: "fill" | "fit") => void;
  setImageLoop: (loop: boolean) => void;
  setImageAutoAdvanceInterval: (intervalMs: number) => void;
  // File Transfers
  getTransfers: () => void;
  // Idle
  setClockFontSize: (size: number) => void;
  setClockPosition: (position: ClockPosition) => void;
  setAudioWidgetPosition: (position: AudioWidgetPosition) => void;
  // Hymn karaoke MP3 cache
  downloadHymnMP3: (hymnNumber: string) => void;
  downloadAllHymnMP3s: () => void;
  cancelHymnMP3Download: (hymnNumber: string) => void;
  cancelAllHymnMP3Downloads: () => void;
  clearHymnMP3Cache: () => void;
  getHymnMP3CacheStats: () => void;
  setKaraokeBannerDismissed: (dismissed: boolean) => void;
};

export const DEFAULT_STATE: DisplayState = {
  mode: "idle",
  idle: {
    wallpaper: null,
    showClock: true,
    clockFontSize: 100,
    clockPosition: "center",
    audioWidgetPosition: "bottom-right",
  },
  text: {
    title: "",
    slides: [],
    currentSlide: 0,
    contentType: "custom",
    bibleContext: undefined,
  },
  video: {
    src: null,
    videoId: null,
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
  },
  audio: {
    src: null,
    name: null,
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
  },
  image: {
    src: null,
    imageId: null,
    slideshowId: null,
    slideshowImages: [],
    currentIndex: 0,
    autoAdvance: false,
    autoAdvanceInterval: 5000,
    loop: false,
    fit: "fill",
  },
};

export const DEFAULT_SETTINGS: AppSettings = {
  displayMonitor: -1, // -1 means auto-detect secondary
  serverPort: 3847,
  language: "ro",
  bibleTranslation: "ron-rccv",
  volume: 1,
  audioVolume: 1,
  openOnStartup: false,
  syncedLyrics: true,
  karaokeBannerDismissed: false,
};

// Hymn types
export interface Hymn {
  number: string;
  title: string;
  chorus: string;
  verses: string[];
  syncedAvailability?: SyncedAvailability;
}

// Bible types
export interface BibleVerse {
  chapter: number;
  verse: number;
  text: string;
}

export interface BibleChapter {
  number: number;
  verses: BibleVerse[];
}

export interface BibleBook {
  id: string;
  name: string;
  chapters: BibleChapter[];
}

export interface BibleData {
  books: BibleBook[];
}

export interface BibleSearchResult {
  bookId: string;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
  score: number;
}

// Update types
export interface UpdateStatus {
  state: "idle" | "checking" | "available" | "downloading" | "ready" | "error";
  version?: string;
  releaseNotes?: string;
  progress?: number; // 0-100
  error?: string;
}

// Bundled binary diagnostics
export interface BinaryInfo {
  name: string;
  available: boolean;
  path: string | null;
  version: string | null;
  source: "ota" | "bundled" | "system" | null;
}
