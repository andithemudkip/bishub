const { contextBridge, ipcRenderer } = require("electron");

const electronAPI = {
  getState: (): Promise<any> => ipcRenderer.invoke("get-state"),
  getSettings: (): Promise<any> => ipcRenderer.invoke("get-settings"),
  getMonitors: (): Promise<any[]> => ipcRenderer.invoke("get-monitors"),
  getLocalIP: (): Promise<string> => ipcRenderer.invoke("get-local-ip"),

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
