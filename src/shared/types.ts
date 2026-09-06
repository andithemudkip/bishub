import type { Language } from "./i18n";
import { DEFAULT_SLIDE_BACKGROUND, DEFAULT_BIBLE_BACKGROUND } from "./slideTheme";
import type {
  VideoItem,
  DownloadProgress,
  UploadProgress,
} from "./videoLibrary.types";
import type { AudioItem, AudioUploadProgress, AudioDownloadProgress } from "./audioLibrary.types";
import type {
  AudioSchedule,
  ScheduleEvent,
  CreateScheduleParams,
  UpdateScheduleParams,
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
import type { AudioPlaylist, AudioQueueState } from "./audioPlaylist.types";

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

/**
 * Which hymn is on screen. Hymn numbers repeat across books, so the book slug
 * is part of the identity — matching on the number alone (or on the rendered
 * title) collides once more than one hymnal is loaded.
 */
export interface HymnRef {
  book: string;
  number: string;
}

export interface TextState {
  title: string;
  slides: string[];
  currentSlide: number;
  contentType: TextContentType;
  bibleContext?: BibleContext;
  hymnRef?: HymnRef;
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

/**
 * What the loaded audio belongs to. Background audio is the idle-mode music
 * library; hymn audio is a karaoke or instrumental track tied to the slides on
 * screen. The two have opposite lifetimes — background audio dies when you
 * leave idle, hymn audio dies when you leave the hymn — so the mode switches
 * key off this rather than guessing from `TextState.syncedLyrics`.
 */
export type AudioRole = "background" | "hymn";

export interface AudioState {
  src: string | null;
  name: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  role: AudioRole;
  /** The live playback queue — a projection of a playlist or the ephemeral Up Next list. */
  queue: AudioQueueState;
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
  /** Slug of the hymnal the remote is browsing. */
  hymnal: string;
  volume: number;
  audioVolume: number;
  openOnStartup: boolean;
  syncedLyrics: boolean;
  /**
   * Play the instrumental behind manually-advanced slides for hymns that have
   * an MP3 but no synced lyrics. Separate from `syncedLyrics` on purpose —
   * turning off word-sync shouldn't take the accompaniment away with it.
   */
  instrumentals: boolean;
  karaokeBannerDismissed: boolean;
  /**
   * Sizes of the display's chrome — the title, the slide counter and the slide
   * dots — as percentages of the built-in size (100 = default), clamped to
   * `CHROME_SIZE_MIN`..`CHROME_SIZE_MAX`. The body text is fitted around
   * whatever these resolve to, so raising them shrinks the text rather than
   * letting the two collide.
   */
  titleSize: number;
  slideCounterSize: number;
  slideDotsSize: number;
  /**
   * Gradient behind text and karaoke slides, top → bottom, as `#rrggbb`. Only
   * the background is stored: every foreground on the slide is derived from
   * these two stops by `getSlideTheme`, so the two can never fall out of step.
   */
  slideBackgroundFrom: string;
  slideBackgroundTo: string;
  /**
   * Bible slides may opt out of the global background. Only Bible gets an
   * override — the global background is already the hymn background, and it
   * lets an operator tell a reading from a hymn at a glance.
   */
  bibleBackgroundEnabled: boolean;
  bibleBackgroundFrom: string;
  bibleBackgroundTo: string;
}

/** The chrome elements whose size the operator can tune. */
export type ChromeSizeKey = "titleSize" | "slideCounterSize" | "slideDotsSize";

/** Whether a hymn's instrumental MP3 exists remotely and whether it's on disk. */
export type HymnAudioAvailability = "none" | "downloadable" | "cached";

/**
 * How to present a hymn. `auto` picks the richest form the assets and settings
 * allow (karaoke → instrumental → static); the rest are the operator overriding
 * that for one hymn, and so deliberately ignore the settings — `instrumental`
 * still plays with the instrumentals setting off, and `static` must not be
 * re-upgraded by `auto`'s fallback. An override that the assets can't satisfy
 * degrades to static rather than failing.
 */
export type HymnPlaybackMode = "auto" | "synced" | "instrumental" | "static";

export type MP3DownloadStatus =
  | "queued"
  | "downloading"
  | "complete"
  | "error"
  | "cancelled";

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
  hymns: (slug: string, hymns: Hymn[]) => void;
  hymnSearchResults: (results: HymnSearchResult[]) => void;
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
  // Audio Playlists + Up Next queue
  audioPlaylists: (playlists: AudioPlaylist[]) => void;
  audioQueue: (audioIds: string[]) => void;
  // Audio Scheduling
  audioSchedules: (schedules: AudioSchedule[]) => void;
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
  setInstrumentals: (enabled: boolean) => void;
  setChromeSize: (key: ChromeSizeKey, size: number) => void;
  setSlideBackground: (from: string, to: string) => void;
  setBibleBackground: (
    enabled: boolean,
    from: string,
    to: string,
  ) => void;
  getMonitors: () => void;
  goIdle: () => void;
  // Devices
  getDevices: () => void;
  renameDevice: (deviceId: string, name: string) => void;
  revokeDevice: (deviceId: string) => void;
  // Hymns
  getHymns: (slug: string) => void;
  loadHymn: (
    slug: string,
    hymnNumber: string,
    playbackMode?: HymnPlaybackMode,
  ) => void;
  setHymnal: (slug: string) => void;
  searchAllHymns: (query: string) => void;
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
  // Audio Playlists
  getAudioPlaylists: () => void;
  createAudioPlaylist: (name: string, audioIds: string[]) => void;
  renameAudioPlaylist: (playlistId: string, name: string) => void;
  deleteAudioPlaylist: (playlistId: string) => void;
  setAudioPlaylistLoop: (playlistId: string, loop: boolean) => void;
  addTracksToPlaylist: (playlistId: string, audioIds: string[]) => void;
  removeTrackFromPlaylist: (playlistId: string, audioId: string) => void;
  reorderPlaylist: (playlistId: string, orderedAudioIds: string[]) => void;
  // Up Next (ephemeral queue)
  getAudioQueue: () => void;
  addToQueue: (audioIds: string[]) => void;
  playNextInQueue: (audioIds: string[]) => void;
  removeFromQueue: (audioId: string) => void;
  reorderQueue: (orderedAudioIds: string[]) => void;
  clearQueue: () => void;
  // Queue transport
  playAudioPlaylist: (playlistId: string, startIndex?: number) => void;
  playAudioQueue: (startIndex?: number) => void;
  nextTrack: () => void;
  previousTrack: () => void;
  setQueueLoop: (loop: boolean) => void;
  // Audio Scheduling
  getAudioSchedules: () => void;
  createAudioSchedule: (params: CreateScheduleParams) => void;
  updateAudioSchedule: (params: UpdateScheduleParams) => void;
  deleteAudioSchedule: (scheduleId: string) => void;
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
    role: "background",
    queue: {
      source: null,
      playlistId: null,
      name: null,
      tracks: [],
      index: 0,
      orphanedAt: null,
      loop: false,
    },
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
  hymnal: "imnuri-crestine",
  volume: 1,
  audioVolume: 1,
  openOnStartup: false,
  syncedLyrics: true,
  instrumentals: true,
  karaokeBannerDismissed: false,
  titleSize: 100,
  slideCounterSize: 100,
  slideDotsSize: 100,
  slideBackgroundFrom: DEFAULT_SLIDE_BACKGROUND.from,
  slideBackgroundTo: DEFAULT_SLIDE_BACKGROUND.to,
  bibleBackgroundEnabled: false,
  bibleBackgroundFrom: DEFAULT_BIBLE_BACKGROUND.from,
  bibleBackgroundTo: DEFAULT_BIBLE_BACKGROUND.to,
};

// Hymn types
export type HymnBlockKind = "verse" | "chorus" | "bridge";

export interface HymnBlock {
  kind: HymnBlockKind;
  text: string;
}

/** A hymn plus the book it came from, for cross-book search results. */
export interface HymnSearchResult {
  book: string;
  bookName: string;
  hymn: Hymn;
}

export interface Hymn {
  number: string;
  title: string;
  /** Distinct stanzas, deduplicated — a chorus is stored once however often it recurs. */
  blocks: HymnBlock[];
  /**
   * Indices into `blocks`, in performance order. Repeats are expressed by
   * repeating an index, so irregular layouts (chorus first, bridges, a chorus
   * that only follows some verses) are data rather than flags.
   */
  sequence: number[];
  /** Only annotated for the book that has karaoke assets. */
  audioAvailability?: HymnAudioAvailability;
  /** Whether word-synced lyrics exist for this hymn (karaoke, not just instrumental). */
  hasSyncedLyrics?: boolean;
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
