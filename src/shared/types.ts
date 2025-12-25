import type { Language } from "./i18n";
import type {
  VideoItem,
  DownloadProgress,
  UploadProgress,
} from "./videoLibrary.types";
import type { AudioItem, AudioUploadProgress } from "./audioLibrary.types";

export type DisplayMode = "idle" | "text" | "video";

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
}

export interface VideoState {
  src: string | null;
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

export interface DisplayState {
  mode: DisplayMode;
  idle: IdleState;
  text: TextState;
  video: VideoState;
  audio: AudioState;
}

export interface MonitorInfo {
  id: number;
  name: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isPrimary: boolean;
}

export interface AppSettings {
  displayMonitor: number;
  serverPort: number;
  language: Language;
  volume: number;
}

// Socket.io event types
export type ServerToClientEvents = {
  stateUpdate: (state: DisplayState) => void;
  settingsUpdate: (settings: AppSettings) => void;
  monitors: (monitors: MonitorInfo[]) => void;
  hymns: (hymns: Hymn[]) => void;
  bibleBooks: (
    books: { id: string; name: string; chapterCount: number }[]
  ) => void;
  bibleChapter: (verses: BibleVerse[]) => void;
  // Video Library
  videoLibrary: (videos: VideoItem[]) => void;
  downloadProgress: (progress: DownloadProgress) => void;
  uploadProgress: (progress: UploadProgress) => void;
  // Audio Library
  audioLibrary: (audios: AudioItem[]) => void;
  audioUploadProgress: (progress: AudioUploadProgress) => void;
};

export type ClientToServerEvents = {
  setMode: (mode: DisplayMode) => void;
  loadText: (title: string, content: string) => void;
  nextSlide: () => void;
  prevSlide: () => void;
  goToSlide: (index: number) => void;
  loadVideo: (src: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekVideo: (time: number) => void;
  setVolume: (volume: number) => void;
  setDisplayMonitor: (monitorId: number) => void;
  setLanguage: (language: Language) => void;
  getMonitors: () => void;
  goIdle: () => void;
  // Hymns
  getHymns: () => void;
  loadHymn: (hymnNumber: string) => void;
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
  loadAudio: (src: string, name: string) => void;
  playAudio: () => void;
  pauseAudio: () => void;
  stopAudio: () => void;
  seekAudio: (time: number) => void;
  setAudioVolume: (volume: number) => void;
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
};

export const DEFAULT_SETTINGS: AppSettings = {
  displayMonitor: -1, // -1 means auto-detect secondary
  serverPort: 3847,
  language: "ro",
  volume: 1,
};

// Hymn types
export interface Hymn {
  number: string;
  title: string;
  chorus: string;
  verses: string[];
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
