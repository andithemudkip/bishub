import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type {
  DisplayState,
  AppSettings,
  MonitorInfo,
  Hymn,
  BibleVerse,
  ServerToClientEvents,
  ClientToServerEvents,
  ClockPosition,
  AudioWidgetPosition,
} from "../shared/types";
import type { Language } from "../shared/i18n";
import { DEFAULT_STATE, DEFAULT_SETTINGS } from "../shared/types";

type SocketType = Socket<ServerToClientEvents, ClientToServerEvents>;

// Extract security key from URL query parameter for web remote authentication
function getSecurityKeyFromURL(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("key");
}

interface RemoteAPI {
  state: DisplayState;
  settings: AppSettings;
  monitors: MonitorInfo[];
  hymns: Hymn[];
  isConnected: boolean;
  // Actions
  setMode: (mode: "idle" | "text" | "video") => void;
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
  goIdle: () => void;
  // Hymns
  loadHymn: (hymnNumber: string) => void;
  // Bible
  getBibleBooks: () => Promise<
    { id: string; name: string; chapterCount: number }[]
  >;
  getBibleChapter: (bookId: string, chapter: number) => Promise<BibleVerse[]>;
  loadBibleVerses: (
    bookId: string,
    bookName: string,
    chapter: number,
    startVerse: number,
    endVerse?: number
  ) => void;
  // Audio
  loadAudio: (src: string, name: string) => void;
  playAudio: () => void;
  pauseAudio: () => void;
  stopAudio: () => void;
  seekAudio: (time: number) => void;
  setAudioVolume: (volume: number) => void;
  // Idle screen settings (Electron only)
  setIdleWallpaper: (selectNew?: boolean) => Promise<string | null>;
  setClockFontSize: (size: number) => void;
  setClockPosition: (position: ClockPosition) => void;
  setAudioWidgetPosition: (position: AudioWidgetPosition) => void;
}

export function useRemoteAPI(): RemoteAPI {
  const [state, setState] = useState<DisplayState>(DEFAULT_STATE);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [bibleBooks, setBibleBooks] = useState<
    { id: string; name: string; chapterCount: number }[]
  >([]);
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<SocketType | null>(null);
  const bibleBooksCb = useRef<
    | ((books: { id: string; name: string; chapterCount: number }[]) => void)
    | null
  >(null);
  const bibleChapterCb = useRef<((verses: BibleVerse[]) => void) | null>(null);

  const isElectron = !!window.electronAPI;

  useEffect(() => {
    if (isElectron) {
      // Use Electron IPC
      window.electronAPI!.getState().then(setState);
      window.electronAPI!.getSettings().then(setSettings);
      window.electronAPI!.getMonitors().then(setMonitors);
      window.electronAPI!.getHymns().then(setHymns);

      const unsubState = window.electronAPI!.onStateUpdate(setState);
      const unsubSettings = window.electronAPI!.onSettingsUpdate(setSettings);
      setIsConnected(true);

      return () => {
        unsubState();
        unsubSettings();
      };
    } else {
      // Use Socket.io with security key authentication
      const securityKey = getSecurityKeyFromURL();
      const socket: SocketType = io({
        auth: { key: securityKey },
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        setIsConnected(true);
        socket.emit("getHymns");
        socket.emit("getBibleBooks");
      });

      socket.on("disconnect", () => {
        setIsConnected(false);
      });

      socket.on("stateUpdate", setState);
      socket.on("settingsUpdate", setSettings);
      socket.on("monitors", setMonitors);
      socket.on("hymns", setHymns);
      socket.on("bibleBooks", (books) => {
        setBibleBooks(books);
        if (bibleBooksCb.current) {
          bibleBooksCb.current(books);
          bibleBooksCb.current = null;
        }
      });
      socket.on("bibleChapter", (verses) => {
        if (bibleChapterCb.current) {
          bibleChapterCb.current(verses);
          bibleChapterCb.current = null;
        }
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [isElectron]);

  const api: RemoteAPI = {
    state,
    settings,
    monitors,
    hymns,
    isConnected,

    setMode: useCallback(
      (mode) => {
        if (isElectron) window.electronAPI!.setMode(mode);
        else socketRef.current?.emit("setMode", mode);
      },
      [isElectron]
    ),

    loadText: useCallback(
      (title, content) => {
        if (isElectron) window.electronAPI!.loadText(title, content);
        else socketRef.current?.emit("loadText", title, content);
      },
      [isElectron]
    ),

    nextSlide: useCallback(() => {
      if (isElectron) window.electronAPI!.nextSlide();
      else socketRef.current?.emit("nextSlide");
    }, [isElectron]),

    prevSlide: useCallback(() => {
      if (isElectron) window.electronAPI!.prevSlide();
      else socketRef.current?.emit("prevSlide");
    }, [isElectron]),

    goToSlide: useCallback(
      (index) => {
        if (isElectron) window.electronAPI!.goToSlide(index);
        else socketRef.current?.emit("goToSlide", index);
      },
      [isElectron]
    ),

    loadVideo: useCallback(
      (src) => {
        if (isElectron) window.electronAPI!.loadVideo(src);
        else socketRef.current?.emit("loadVideo", src);
      },
      [isElectron]
    ),

    playVideo: useCallback(() => {
      if (isElectron) window.electronAPI!.playVideo();
      else socketRef.current?.emit("playVideo");
    }, [isElectron]),

    pauseVideo: useCallback(() => {
      if (isElectron) window.electronAPI!.pauseVideo();
      else socketRef.current?.emit("pauseVideo");
    }, [isElectron]),

    stopVideo: useCallback(() => {
      if (isElectron) window.electronAPI!.stopVideo();
      else socketRef.current?.emit("stopVideo");
    }, [isElectron]),

    seekVideo: useCallback(
      (time) => {
        if (isElectron) window.electronAPI!.seekVideo(time);
        else socketRef.current?.emit("seekVideo", time);
      },
      [isElectron]
    ),

    setVolume: useCallback(
      (volume) => {
        if (isElectron) window.electronAPI!.setVolume(volume);
        else socketRef.current?.emit("setVolume", volume);
      },
      [isElectron]
    ),

    setDisplayMonitor: useCallback(
      (monitorId) => {
        if (isElectron) window.electronAPI!.setDisplayMonitor(monitorId);
        else socketRef.current?.emit("setDisplayMonitor", monitorId);
      },
      [isElectron]
    ),

    setLanguage: useCallback(
      (language: Language) => {
        if (isElectron) window.electronAPI!.setLanguage(language);
        else socketRef.current?.emit("setLanguage", language);
      },
      [isElectron]
    ),

    goIdle: useCallback(() => {
      if (isElectron) window.electronAPI!.goIdle();
      else socketRef.current?.emit("goIdle");
    }, [isElectron]),

    loadHymn: useCallback(
      (hymnNumber) => {
        if (isElectron) window.electronAPI!.loadHymn(hymnNumber);
        else socketRef.current?.emit("loadHymn", hymnNumber);
      },
      [isElectron]
    ),

    getBibleBooks: useCallback(() => {
      if (isElectron) {
        return window.electronAPI!.getBibleBooks();
      }
      // Return cached books if available
      if (bibleBooks.length > 0) {
        return Promise.resolve(bibleBooks);
      }
      return new Promise((resolve) => {
        bibleBooksCb.current = resolve;
        socketRef.current?.emit("getBibleBooks");
      });
    }, [isElectron, bibleBooks]),

    getBibleChapter: useCallback(
      (bookId, chapter) => {
        if (isElectron) {
          return window.electronAPI!.getBibleChapter(bookId, chapter);
        }
        return new Promise((resolve) => {
          bibleChapterCb.current = resolve;
          socketRef.current?.emit("getBibleChapter", bookId, chapter);
        });
      },
      [isElectron]
    ),

    loadBibleVerses: useCallback(
      (bookId, bookName, chapter, startVerse, endVerse) => {
        if (isElectron)
          window.electronAPI!.loadBibleVerses(
            bookId,
            bookName,
            chapter,
            startVerse,
            endVerse
          );
        else
          socketRef.current?.emit(
            "loadBibleVerses",
            bookId,
            bookName,
            chapter,
            startVerse,
            endVerse
          );
      },
      [isElectron]
    ),

    // Audio
    loadAudio: useCallback(
      (src, name) => {
        if (isElectron) window.electronAPI!.loadAudio(src, name);
        else socketRef.current?.emit("loadAudio", src, name);
      },
      [isElectron]
    ),

    playAudio: useCallback(() => {
      if (isElectron) window.electronAPI!.playAudio();
      else socketRef.current?.emit("playAudio");
    }, [isElectron]),

    pauseAudio: useCallback(() => {
      if (isElectron) window.electronAPI!.pauseAudio();
      else socketRef.current?.emit("pauseAudio");
    }, [isElectron]),

    stopAudio: useCallback(() => {
      if (isElectron) window.electronAPI!.stopAudio();
      else socketRef.current?.emit("stopAudio");
    }, [isElectron]),

    seekAudio: useCallback(
      (time) => {
        if (isElectron) window.electronAPI!.seekAudio(time);
        else socketRef.current?.emit("seekAudio", time);
      },
      [isElectron]
    ),

    setAudioVolume: useCallback(
      (volume) => {
        if (isElectron) window.electronAPI!.setAudioVolume(volume);
        else socketRef.current?.emit("setAudioVolume", volume);
      },
      [isElectron]
    ),

    // Idle screen settings (Electron only)
    setIdleWallpaper: useCallback(
      (selectNew = true) => {
        if (isElectron) {
          return window.electronAPI!.setIdleWallpaper(selectNew);
        }
        return Promise.resolve(null);
      },
      [isElectron]
    ),

    setClockFontSize: useCallback(
      (size: number) => {
        if (isElectron) window.electronAPI!.setClockFontSize(size);
      },
      [isElectron]
    ),

    setClockPosition: useCallback(
      (position: ClockPosition) => {
        if (isElectron) window.electronAPI!.setClockPosition(position);
      },
      [isElectron]
    ),

    setAudioWidgetPosition: useCallback(
      (position: AudioWidgetPosition) => {
        if (isElectron) window.electronAPI!.setAudioWidgetPosition(position);
      },
      [isElectron]
    ),
  };

  return api;
}
