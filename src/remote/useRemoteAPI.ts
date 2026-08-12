import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type {
  DisplayState,
  AppSettings,
  MonitorInfo,
  Hymn,
  BibleVerse,
  BibleSearchResult,
  HymnSearchResult,
  ServerToClientEvents,
  ClientToServerEvents,
  ClockPosition,
  AudioWidgetPosition,
  MP3DownloadProgress,
  MP3CacheStats,
  DeviceInfo,
  HymnPlaybackMode,
} from "../shared/types";
import type { Language } from "../shared/i18n";
import { DEFAULT_STATE, DEFAULT_SETTINGS } from "../shared/types";
import {
  getSecurityKeyFromURL,
  updateProgressList,
  getDeviceToken,
  setDeviceToken,
  clearDeviceToken,
} from "../shared/utils";

type SocketType = Socket<ServerToClientEvents, ClientToServerEvents>;

interface RemoteAPI {
  state: DisplayState;
  settings: AppSettings;
  monitors: MonitorInfo[];
  hymns: Hymn[];
  /** Which book `hymns` holds — lags `settings.hymnal` while a fetch is in flight. */
  hymnsSlug: string;
  isConnected: boolean;
  isPaired: boolean;
  authError: boolean;
  authFailed: boolean;
  reconnectWithKey: (key: string) => void;
  // Actions
  setMode: (mode: "idle" | "text" | "video" | "image") => void;
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
  goIdle: () => void;
  // Hymns
  loadHymn: (
    slug: string,
    hymnNumber: string,
    playbackMode?: HymnPlaybackMode,
  ) => void;
  setHymnal: (slug: string) => void;
  searchAllHymns: (query: string) => Promise<HymnSearchResult[]>;
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
  // Image
  loadImage: (src: string, imageId: string) => void;
  loadSlideshow: (slideshowId: string) => void;
  nextImage: () => void;
  prevImage: () => void;
  goToImage: (index: number) => void;
  setImageAutoAdvance: (enabled: boolean) => void;
  setImageFit: (fit: "fill" | "fit") => void;
  setImageLoop: (loop: boolean) => void;
  setImageAutoAdvanceInterval: (intervalMs: number) => void;
  // Idle screen settings (Electron only)
  setIdleWallpaper: (selectNew?: boolean) => Promise<string | null>;
  setClockFontSize: (size: number) => void;
  setClockPosition: (position: ClockPosition) => void;
  setAudioWidgetPosition: (position: AudioWidgetPosition) => void;
  // Hymn karaoke MP3 cache
  mp3Downloads: MP3DownloadProgress[];
  mp3CacheStats: MP3CacheStats;
  downloadHymnMP3: (hymnNumber: string) => void;
  downloadAllHymnMP3s: () => void;
  cancelHymnMP3Download: (hymnNumber: string) => void;
  cancelAllHymnMP3Downloads: () => void;
  clearHymnMP3Cache: () => void;
  setKaraokeBannerDismissed: (dismissed: boolean) => void;
  // Devices
  devices: DeviceInfo[];
  connectedDeviceIds: string[];
  renameDevice: (deviceId: string, name: string) => void;
  revokeDevice: (deviceId: string) => void;
}

export function useRemoteAPI(): RemoteAPI {
  const [state, setState] = useState<DisplayState>(DEFAULT_STATE);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [hymnData, setHymnData] = useState<{ slug: string; hymns: Hymn[] }>({
    slug: "",
    hymns: [],
  });
  const [bibleBooks, setBibleBooks] = useState<
    { id: string; name: string; chapterCount: number }[]
  >([]);
  const [isConnected, setIsConnected] = useState(false);
  const isElectronEnv = !!window.electronAPI;
  const [isPaired, setIsPaired] = useState(
    () => isElectronEnv || !!getDeviceToken()
  );
  const [authError, setAuthError] = useState(false);
  const [bibleDownloadStatus, setBibleDownloadStatus] = useState<RemoteAPI["bibleDownloadStatus"]>(null);
  const [downloadedTranslations, setDownloadedTranslations] = useState<string[]>(["ron-rccv"]);
  const [mp3Downloads, setMp3Downloads] = useState<MP3DownloadProgress[]>([]);
  const [mp3CacheStats, setMp3CacheStats] = useState<MP3CacheStats>({
    count: 0,
    sizeBytes: 0,
    availableCount: 0,
  });
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [connectedDeviceIds, setConnectedDeviceIds] = useState<string[]>([]);
  const authAttempted = useRef(false);

  const handleMP3Progress = useCallback((progress: MP3DownloadProgress) => {
    setMp3Downloads((prev) => updateProgressList(prev, progress, setMp3Downloads));
  }, []);

  const socketRef = useRef<SocketType | null>(null);
  const bibleBooksCb = useRef<
    | ((books: { id: string; name: string; chapterCount: number }[]) => void)
    | null
  >(null);
  const bibleChapterCb = useRef<((verses: BibleVerse[]) => void) | null>(null);
  const bibleSearchCb = useRef<((results: BibleSearchResult[]) => void) | null>(
    null
  );
  const hymnSearchCb = useRef<
    ((results: HymnSearchResult[]) => void) | null
  >(null);

  const isElectron = isElectronEnv;

  const connectSocket = useCallback(
    (token: string) => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      }

      setAuthError(false);
      const socket: SocketType = io({ auth: { token } });
      socketRef.current = socket;

      socket.on("connect", () => {
        setIsConnected(true);
        setAuthError(false);
        socket.emit("getBibleBooks");
        socket.emit("getDownloadedTranslations");
      });

      socket.on("disconnect", () => {
        setIsConnected(false);
      });

      socket.on("connect_error", (err) => {
        if (err.message === "Invalid token") {
          clearDeviceToken();
          setIsPaired(false);
          setAuthError(true);
          socket.disconnect();
        }
      });

      socket.on("stateUpdate", setState);
      socket.on("settingsUpdate", setSettings);
      socket.on("monitors", setMonitors);
      socket.on("hymns", (slug, list) => setHymnData({ slug, hymns: list }));
      socket.on("hymnSearchResults", (results) => {
        if (hymnSearchCb.current) {
          hymnSearchCb.current(results);
          hymnSearchCb.current = null;
        }
      });
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
      socket.on("mp3DownloadProgress", handleMP3Progress);
      socket.on("mp3CacheStats", setMp3CacheStats);
      socket.on("devices", setDevices);
      socket.on("connectedDeviceIds", setConnectedDeviceIds);
      socket.emit("getHymnMP3CacheStats");
    },
    [handleMP3Progress]
  );

  const pairingInFlight = useRef(false);

  const pairAndConnect = useCallback(
    async (pairingKey: string) => {
      if (pairingInFlight.current) return;
      pairingInFlight.current = true;
      try {
        // Defensive: a concurrent attempt may have already stored a token.
        const existing = getDeviceToken();
        if (existing) {
          setIsPaired(true);
          connectSocket(existing);
          return;
        }
        const res = await fetch(`/api/pair?key=${encodeURIComponent(pairingKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userAgent: navigator.userAgent }),
        });
        if (!res.ok) {
          setAuthError(true);
          setIsPaired(false);
          return;
        }
        const { token } = await res.json();
        setDeviceToken(token);
        const url = new URL(window.location.href);
        url.searchParams.delete("key");
        window.history.replaceState({}, "", url.toString());
        setIsPaired(true);
        connectSocket(token);
      } catch {
        setAuthError(true);
        setIsPaired(false);
      } finally {
        pairingInFlight.current = false;
      }
    },
    [connectSocket]
  );

  useEffect(() => {
    if (isElectron) {
      // Use Electron IPC
      window.electronAPI!.getState().then(setState);
      window.electronAPI!.getSettings().then(setSettings);
      window.electronAPI!.getMonitors().then(setMonitors);
      window.electronAPI!.getDownloadedTranslations().then(setDownloadedTranslations);
      window.electronAPI!.getDevices?.().then(setDevices);

      const unsubState = window.electronAPI!.onStateUpdate(setState);
      const unsubSettings = window.electronAPI!.onSettingsUpdate(setSettings);
      const unsubMonitors = window.electronAPI!.onMonitorsUpdate(setMonitors);
      const unsubHymns = window.electronAPI!.onHymnsUpdate((slug, list) =>
        setHymnData({ slug, hymns: list }),
      );
      const unsubMP3Progress =
        window.electronAPI!.onHymnMP3DownloadProgress(handleMP3Progress);
      const unsubMP3Stats =
        window.electronAPI!.onHymnMP3CacheStats(setMp3CacheStats);
      const unsubDevices =
        window.electronAPI!.onDevicesUpdate?.(setDevices) ?? (() => {});
      const unsubConnectedDevices =
        window.electronAPI!.onConnectedDevicesUpdate?.(setConnectedDeviceIds) ??
        (() => {});
      window.electronAPI!.getHymnMP3CacheStats().then(setMp3CacheStats);
      setIsConnected(true);

      return () => {
        unsubState();
        unsubSettings();
        unsubMonitors();
        unsubHymns();
        unsubMP3Progress();
        unsubMP3Stats();
        unsubDevices();
        unsubConnectedDevices();
      };
    } else {
      const token = getDeviceToken();
      if (token) {
        connectSocket(token);
      } else {
        const pairingKey = getSecurityKeyFromURL();
        if (pairingKey) {
          pairAndConnect(pairingKey);
        } else {
          setAuthError(true);
        }
      }

      return () => {
        socketRef.current?.disconnect();
      };
    }
  }, [isElectron, connectSocket, pairAndConnect, handleMP3Progress]);

  const reconnectWithKey = useCallback(
    (key: string) => {
      authAttempted.current = true;
      pairAndConnect(key);
    },
    [pairAndConnect]
  );

  // Hymns are fetched one book at a time rather than all at once: the full
  // corpus is ~3 MB across nine hymnals, which every web remote would otherwise
  // pull on connect.
  const selectedHymnal = settings.hymnal;
  useEffect(() => {
    if (!isConnected || !selectedHymnal) return;
    if (isElectron) {
      window
        .electronAPI!.getHymns(selectedHymnal)
        .then((list) => setHymnData({ slug: selectedHymnal, hymns: list }));
    } else {
      socketRef.current?.emit("getHymns", selectedHymnal);
    }
  }, [isConnected, isElectron, selectedHymnal]);

  const api: RemoteAPI = {
    state,
    settings,
    monitors,
    hymns: hymnData.hymns,
    hymnsSlug: hymnData.slug,
    isConnected,
    isPaired,
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

    setSyncedLyrics: useCallback(
      (enabled: boolean) => {
        if (isElectron) window.electronAPI!.setSyncedLyrics(enabled);
        else socketRef.current?.emit("setSyncedLyrics", enabled);
      },
      [isElectron]
    ),

    setInstrumentals: useCallback(
      (enabled: boolean) => {
        if (isElectron) window.electronAPI!.setInstrumentals(enabled);
        else socketRef.current?.emit("setInstrumentals", enabled);
      },
      [isElectron]
    ),

    goIdle: useCallback(() => {
      if (isElectron) window.electronAPI!.goIdle();
      else socketRef.current?.emit("goIdle");
    }, [isElectron]),

    searchAllHymns: useCallback(
      (query: string) => {
        if (isElectron) return window.electronAPI!.searchAllHymns(query);
        return new Promise<HymnSearchResult[]>((resolve) => {
          hymnSearchCb.current = resolve;
          socketRef.current?.emit("searchAllHymns", query);
        });
      },
      [isElectron],
    ),

    setHymnal: useCallback(
      (slug: string) => {
        if (isElectron) window.electronAPI!.setHymnal(slug);
        else socketRef.current?.emit("setHymnal", slug);
      },
      [isElectron],
    ),
    loadHymn: useCallback(
      (slug, hymnNumber, playbackMode?) => {
        if (isElectron)
          window.electronAPI!.loadHymn(slug, hymnNumber, playbackMode);
        else socketRef.current?.emit("loadHymn", slug, hymnNumber, playbackMode);
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

    // Image
    loadImage: useCallback(
      (src, imageId) => {
        if (isElectron) window.electronAPI!.loadImageToDisplay(src, imageId);
        else socketRef.current?.emit("loadImage", src, imageId);
      },
      [isElectron]
    ),

    loadSlideshow: useCallback(
      (slideshowId) => {
        if (isElectron) window.electronAPI!.loadSlideshowToDisplay(slideshowId);
        else socketRef.current?.emit("loadSlideshow", slideshowId);
      },
      [isElectron]
    ),

    nextImage: useCallback(() => {
      if (isElectron) window.electronAPI!.nextImage();
      else socketRef.current?.emit("nextImage");
    }, [isElectron]),

    prevImage: useCallback(() => {
      if (isElectron) window.electronAPI!.prevImage();
      else socketRef.current?.emit("prevImage");
    }, [isElectron]),

    goToImage: useCallback(
      (index) => {
        if (isElectron) window.electronAPI!.goToImage(index);
        else socketRef.current?.emit("goToImage", index);
      },
      [isElectron]
    ),

    setImageAutoAdvance: useCallback(
      (enabled) => {
        if (isElectron) window.electronAPI!.setImageAutoAdvance(enabled);
        else socketRef.current?.emit("setImageAutoAdvance", enabled);
      },
      [isElectron]
    ),

    setImageFit: useCallback(
      (fit) => {
        if (isElectron) window.electronAPI!.setImageFit(fit);
        else socketRef.current?.emit("setImageFit", fit);
      },
      [isElectron]
    ),

    setImageLoop: useCallback(
      (loop) => {
        if (isElectron) window.electronAPI!.setImageLoop(loop);
        else socketRef.current?.emit("setImageLoop", loop);
      },
      [isElectron]
    ),

    setImageAutoAdvanceInterval: useCallback(
      (intervalMs) => {
        if (isElectron) window.electronAPI!.setImageAutoAdvanceInterval(intervalMs);
        else socketRef.current?.emit("setImageAutoAdvanceInterval", intervalMs);
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

    // Hymn karaoke MP3 cache
    mp3Downloads,
    mp3CacheStats,

    downloadHymnMP3: useCallback(
      (hymnNumber: string) => {
        if (isElectron) window.electronAPI!.downloadHymnMP3(hymnNumber);
        else socketRef.current?.emit("downloadHymnMP3", hymnNumber);
      },
      [isElectron]
    ),

    downloadAllHymnMP3s: useCallback(() => {
      if (isElectron) window.electronAPI!.downloadAllHymnMP3s();
      else socketRef.current?.emit("downloadAllHymnMP3s");
    }, [isElectron]),

    cancelHymnMP3Download: useCallback(
      (hymnNumber: string) => {
        if (isElectron) window.electronAPI!.cancelHymnMP3Download(hymnNumber);
        else socketRef.current?.emit("cancelHymnMP3Download", hymnNumber);
      },
      [isElectron]
    ),

    cancelAllHymnMP3Downloads: useCallback(() => {
      if (isElectron) window.electronAPI!.cancelAllHymnMP3Downloads();
      else socketRef.current?.emit("cancelAllHymnMP3Downloads");
    }, [isElectron]),

    clearHymnMP3Cache: useCallback(() => {
      if (isElectron) window.electronAPI!.clearHymnMP3Cache();
      else socketRef.current?.emit("clearHymnMP3Cache");
    }, [isElectron]),

    setKaraokeBannerDismissed: useCallback(
      (dismissed: boolean) => {
        if (isElectron) window.electronAPI!.setKaraokeBannerDismissed(dismissed);
        else socketRef.current?.emit("setKaraokeBannerDismissed", dismissed);
      },
      [isElectron]
    ),

    // Devices
    devices,
    connectedDeviceIds,
    renameDevice: useCallback(
      (deviceId: string, name: string) => {
        if (isElectron) window.electronAPI!.renameDevice?.(deviceId, name);
        else socketRef.current?.emit("renameDevice", deviceId, name);
      },
      [isElectron]
    ),
    revokeDevice: useCallback(
      (deviceId: string) => {
        if (isElectron) window.electronAPI!.revokeDevice?.(deviceId);
        else socketRef.current?.emit("revokeDevice", deviceId);
      },
      [isElectron]
    ),
  };

  return api;
}
