export type DisplayMode = "idle" | "text" | "video";

export interface IdleState {
  wallpaper: string | null;
  showClock: boolean;
}

export interface TextState {
  title: string;
  slides: string[];
  currentSlide: number;
}

export interface VideoState {
  src: string | null;
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
};

export const DEFAULT_STATE: DisplayState = {
  mode: "idle",
  idle: {
    wallpaper: null,
    showClock: true,
  },
  text: {
    title: "",
    slides: [],
    currentSlide: 0,
  },
  video: {
    src: null,
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
  },
};

export const DEFAULT_SETTINGS: AppSettings = {
  displayMonitor: -1, // -1 means auto-detect secondary
  serverPort: 3847,
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
