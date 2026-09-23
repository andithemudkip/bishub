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
import type { HymnalInfo } from "./hymnals";
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
/** Progress of a Bible translation download, broadcast to every client. */
export interface BibleTranslationStatus {
  translationId: string;
  status: "downloading" | "ready" | "error";
  progress?: number;
  error?: string;
}

export type ServerToClientEvents = {
  stateUpdate: (state: DisplayState) => void;
  settingsUpdate: (settings: AppSettings) => void;
  monitors: (monitors: MonitorInfo[]) => void;
  devices: (devices: DeviceInfo[]) => void;
  connectedDeviceIds: (ids: string[]) => void;
  /** Whether the fullscreen display window is currently open. Sent on connect too. */
  displayWindowState: (open: boolean) => void;
  hymns: (slug: string, hymns: Hymn[]) => void;
  /** The merged book list: bundled hymnals plus the user's own books. */
  hymnals: (hymnals: HymnalInfo[]) => void;
  /** Outcome of a commit, sent only to the socket that asked for it. */
  hymnImportCommitted: (result: HymnCommitResult) => void;
  /** Outcome of a delete, sent only to the socket that asked for it. */
  customHymnDeleted: (slug: string, number: string, deleted: boolean) => void;
  hymnSearchResults: (results: HymnSearchResult[]) => void;
  bibleBooks: (
    books: { id: string; name: string; chapterCount: number }[]
  ) => void;
  bibleChapter: (verses: BibleVerse[]) => void;
  bibleSearchResults: (results: BibleSearchResult[]) => void;
  bibleTranslationStatus: (status: BibleTranslationStatus) => void;
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
  getHymnals: () => void;
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
  /**
   * Hymn import. There is no parse event here on purpose: a deck arrives over
   * HTTP at POST /api/hymns/import, because a .pptx is megabytes of binary and
   * Socket.io is the wrong pipe for it. Only the finished Hymn comes back this
   * way, and `fileName` is recorded as provenance — the server stamps the rest.
   */
  commitHymnImport: (hymn: Hymn, fileName?: string) => void;
  deleteCustomHymn: (slug: string, number: string) => void;
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
  /**
   * Where a user's hymn came from. Only ever present on hymns in custom books;
   * bundled hymnals never carry it.
   *
   * Written from the first release even though nothing reads it yet: it is the
   * one thing that is expensive to retrofit once someone has hundreds of local
   * hymns, and it is what makes "update this from the registry", "don't clobber
   * my edits" and "where did this come from?" possible later.
   */
  source?: HymnSource;
}

export interface HymnSource {
  kind: "pptx" | "manual" | "registry";
  /** ISO timestamp. */
  importedAt: string;
  /** For kind "pptx". */
  fileName?: string;
  /** For kind "registry". */
  registryId?: string;
  registryVersion?: number;
  /** Set once the user edits a hymn after importing it. */
  edited?: boolean;
}

/** A user-created hymn book, stored in userData rather than shipped in assets. */
export interface CustomHymnalMeta {
  slug: string;
  name: string;
  shortName: string;
  language: string;
  languageName: string;
  /** Bumped when the on-disk shape changes, so a migration has something to read. */
  version: number;
  createdAt: string;
}

// PPTX hymn import
// The parser runs in the main process, but ParsedDeck crosses IPC/Socket.io to the
// renderer, which maps it to a Hymn locally on every slide de-selection. Both sides
// need these, so they live here rather than in electron/pptxParser.ts.

/** Why a .pptx could not be read. Crosses the wire as a code, never as English. */
export type PptxParseReason =
  | "legacy-ppt"
  | "not-a-pptx"
  | "no-text-found"
  | "too-large"
  /** The bytes never arrived — an unreadable path, a failed upload. */
  | "unreadable";

export interface ParsedSlide {
  /**
   * One entry per <p:txBody> in document order, empty ones dropped.
   * Deliberately NOT joined: on most real decks the title is its own shape
   * above verse 1, and welding them together corrupts the lyrics.
   */
  shapes: string[];
}

export interface ParsedDeck {
  /** Slides in presentation order, which is not slideN.xml order. */
  slides: ParsedSlide[];
  /**
   * docProps/core.xml <dc:title>. Unreliable in practice — often a leftover from
   * the deck a file was copied from, or a dump of slide 1 — so treat it as the
   * last title candidate, not the first.
   */
  docTitle?: string;
}

/**
 * One file's outcome from an import request.
 *
 * Failures are per file, not per request: picking five decks and having one turn
 * out to be a legacy .ppt must not lose the other four.
 */
export type PptxImportResult =
  | { ok: true; fileName: string; deck: ParsedDeck }
  | { ok: false; fileName: string; reason: PptxParseReason };

/** Why a commit was refused. Crosses the wire as a code, never as English. */
export type HymnCommitReason = "invalid-hymn" | "write-failed";

/**
 * On success `hymn` is the hymn **as stored**, whose number may differ from the
 * one committed: two imports can race, so the storage layer re-checks and bumps
 * on collision rather than refusing. The UI should read the number back from
 * here rather than assuming the one it sent.
 */
export type HymnCommitResult =
  | { ok: true; slug: string; hymn: Hymn }
  | { ok: false; reason: HymnCommitReason };

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
