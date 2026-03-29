import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type {
  DisplayState,
  AppSettings,
  MonitorInfo,
  Hymn,
  BibleVerse,
  BibleSearchResult,
  ServerToClientEvents,
  ClientToServerEvents,
  ClockPosition,
  AudioWidgetPosition,
} from "../shared/types";
import type { Language } from "../shared/i18n";
import { DEFAULT_STATE, DEFAULT_SETTINGS } from "../shared/types";
import { getSecurityKeyFromURL } from "../shared/utils";

type SocketType = Socket<ServerToClientEvents, ClientToServerEvents>;

interface RemoteAPI {
  state: DisplayState;
  settings: AppSettings;
  monitors: MonitorInfo[];
  hymns: Hymn[];
  isConnected: boolean;
  authError: boolean;
  authFailed: boolean;
  reconnectWithKey: (key: string) => void;
  // Actions
  setMode: (mode: "idle" | "text" | "video") => void;
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
  searchBibleVerses: (query: string) => Promise<BibleSearchResult[]>;
  setBibleTranslation: (translationId: string) => void;
  bibleDownloadStatus: {
    translationId: string;
    status: "downloading" | "ready" | "error";
    progress?: number;
    error?: string;
  } | null;
  downloadedTranslations: string[];
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
  const [authError, setAuthError] = useState(false);
  const [bibleDownloadStatus, setBibleDownloadStatus] = useState<RemoteAPI["bibleDownloadStatus"]>(null);
  const [downloadedTranslations, setDownloadedTranslations] = useState<string[]>(["ron-rccv"]);
  const authAttempted = useRef(false);

  const socketRef = useRef<SocketType | null>(null);
  const bibleBooksCb = useRef<
    | ((books: { id: string; name: string; chapterCount: number }[]) => void)
    | null
  >(null);
  const bibleChapterCb = useRef<((verses: BibleVerse[]) => void) | null>(null);
  const bibleSearchCb = useRef<((results: BibleSearchResult[]) => void) | null>(
    null
  );

  const isElectron = !!window.electronAPI;

  useEffect(() => {
    if (isElectron) {
      // Use Electron IPC
      window.electronAPI!.getState().then(setState);
      window.electronAPI!.getSettings().then(setSettings);
      window.electronAPI!.getMonitors().then(setMonitors);
      window.electronAPI!.getHymns().then(setHymns);
      window.electronAPI!.getDownloadedTranslations().then(setDownloadedTranslations);

      const unsubState = window.electronAPI!.onStateUpdate(setState);
      const unsubSettings = window.electronAPI!.onSettingsUpdate(setSettings);
      setIsConnected(true);

      return () => {
        unsubState();
        unsubSettings();
      };
    } else {
      connectSocket(getSecurityKeyFromURL());

      return () => {
        socketRef.current?.disconnect();
      };
    }
  }, [isElectron]);

  function connectSocket(key: string | null) {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
    }

    setAuthError(false);
    const socket: SocketType = io({ auth: { key } });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      setAuthError(false);
      socket.emit("getHymns");
      socket.emit("getBibleBooks");
      socket.emit("getDownloadedTranslations");
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("connect_error", (err) => {
      if (err.message === "Invalid security key") {
        setAuthError(true);
        socket.disconnect();
      }
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
    socket.on("bibleSearchResults", (results) => {
      if (bibleSearchCb.current) {
        bibleSearchCb.current(results);
        bibleSearchCb.current = null;
      }
    });
    socket.on("bibleTranslationStatus", (status) => {
      setBibleDownloadStatus(status);
    });
    socket.on("downloadedTranslations", setDownloadedTranslations);
  }

  const reconnectWithKey = useCallback((key: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("key", key);
    window.history.replaceState({}, "", url.toString());
    authAttempted.current = true;
    connectSocket(key);
  }, []);

  const api: RemoteAPI = {
    state,
    settings,
    monitors,
    hymns,
    isConnected,
    authError,
    authFailed: authError && authAttempted.current,
    reconnectWithKey,

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
      (src, videoId?) => {
        if (isElectron) window.electronAPI!.loadVideo(src, videoId);
        else socketRef.current?.emit("loadVideo", src, videoId);
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

    searchBibleVerses: useCallback(
      (query: string) => {
        if (isElectron) {
          return window.electronAPI!.searchBibleVerses(query);
        }
        return new Promise((resolve) => {
          bibleSearchCb.current = resolve;
          socketRef.current?.emit("searchBibleVerses", query);
        });
      },
      [isElectron]
    ),

    setBibleTranslation: useCallback(
      (translationId: string) => {
        // Clear cached books so getBibleBooks re-fetches for new translation
        setBibleBooks([]);
        if (isElectron) {
          setBibleDownloadStatus({ translationId, status: "downloading", progress: 0 });
          window.electronAPI!.setBibleTranslation(translationId).then((result: { status: string; error?: string }) => {
            setBibleDownloadStatus(
              result.status === "ready"
                ? { translationId, status: "ready" }
                : { translationId, status: "error", error: result.error }
            );
            // Refresh downloaded list
            window.electronAPI!.getDownloadedTranslations().then(setDownloadedTranslations);
          });
        } else {
          socketRef.current?.emit("setBibleTranslation", translationId);
        }
      },
      [isElectron]
    ),

    bibleDownloadStatus,
    downloadedTranslations,

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
        else socketRef.current?.emit("setClockFontSize", size);
      },
      [isElectron]
    ),

    setClockPosition: useCallback(
      (position: ClockPosition) => {
        if (isElectron) window.electronAPI!.setClockPosition(position);
        else socketRef.current?.emit("setClockPosition", position);
      },
      [isElectron]
    ),

    setAudioWidgetPosition: useCallback(
      (position: AudioWidgetPosition) => {
        if (isElectron) window.electronAPI!.setAudioWidgetPosition(position);
        else socketRef.current?.emit("setAudioWidgetPosition", position);
      },
      [isElectron]
    ),
  };

  return api;
}
