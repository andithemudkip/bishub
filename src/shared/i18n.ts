// Internationalization (i18n) system for BisHub
// Supports Romanian (ro) and English (en)

export type Language = "ro" | "en";

export interface Translations {
  // Navigation
  nav: {
    hymns: string;
    bible: string;
    video: string;
    settings: string;
  };

  // Header controls
  header: {
    goIdle: string;
  };

  // Status
  status: {
    idle: string;
    playingVideo: string;
    videoPaused: string;
  };

  // Hymns page
  hymns: {
    searchPlaceholder: string;
    nowDisplaying: string;
    slide: string;
    of: string;
    noHymnsFound: string;
    verses: string;
    verse: string;
    chorus: string;
  };

  // Bible page
  bible: {
    quickSearch: string;
    quickSearchHint: string;
    browse: string;
    book: string;
    chapter: string;
    fromVerse: string;
    toVerse: string;
    load: string;
    loadVerses: string;
    selectBook: string;
    couldNotParse: string;
  };

  // Settings page
  settings: {
    language: string;
    display: string;
    displayMonitor: string;
    autoSecondary: string;
    selectMonitorHint: string;
    mobileRemote: string;
    scanOrVisit: string;
    sameWifi: string;
    about: string;
    churchDisplayApp: string;
    keyboardShortcuts: string;
    nextSlide: string;
    previousSlide: string;
    goToIdle: string;
  };

  // Video library
  videoLibrary: {
    addLocalFile: string;
    youtube: string;
    upload: string;
    library: string;
    searchPlaceholder: string;
    noVideos: string;
    noVideosHint: string;
    noResults: string;
    nowPlaying: string;
    play: string;
    pause: string;
    stop: string;
    volume: string;
    rename: string;
    delete: string;
    confirmDelete: string;
    cancel: string;
    youtubeUrl: string;
    download: string;
    downloading: string;
    processing: string;
    complete: string;
    uploadDrop: string;
    uploadHint: string;
    uploading: string;
    invalidUrl: string;
    enterUrl: string;
  };
}

const ro: Translations = {
  nav: {
    hymns: "Imnuri",
    bible: "Biblie",
    video: "Video",
    settings: "Setări",
  },
  header: {
    goIdle: "Întrerupe",
  },
  status: {
    idle: "Inactiv",
    playingVideo: "Redare video",
    videoPaused: "Video în pauză",
  },
  hymns: {
    searchPlaceholder: "Caută după număr sau titlu...",
    nowDisplaying: "Se afișează:",
    slide: "Slide",
    of: "din",
    noHymnsFound: "Nu s-au găsit imnuri pentru",
    verses: "versuri",
    verse: "verset",
    chorus: "refren",
  },
  bible: {
    quickSearch: "Căutare rapidă",
    quickSearchHint:
      "Tastează o referință precum: gen 2:16, ps 23:1-6, ioan 3:16, 1imp 1:20",
    browse: "Răsfoiește",
    book: "Carte",
    chapter: "Capitol",
    fromVerse: "De la versetul",
    toVerse: "La versetul",
    load: "Încarcă",
    loadVerses: "Încarcă versetele",
    selectBook: "Selectează o carte...",
    couldNotParse: "Nu s-a putut interpreta referința",
  },
  settings: {
    language: "Limbă",
    display: "Afișaj",
    displayMonitor: "Monitor afișare",
    autoSecondary: "Auto (Monitor secundar)",
    selectMonitorHint: "Selectează monitorul pentru afișarea conținutului",
    mobileRemote: "Telecomandă mobilă",
    scanOrVisit: "Scanează sau accesează:",
    sameWifi: "Asigură-te că telefonul este conectat la aceeași rețea WiFi",
    about: "Despre",
    churchDisplayApp: "Aplicație pentru afișare în biserică",
    keyboardShortcuts: "Scurtături tastatură",
    nextSlide: "Slide următor",
    previousSlide: "Slide anterior",
    goToIdle: "Întrerupe afișarea",
  },
  videoLibrary: {
    addLocalFile: "Adaugă fișier",
    youtube: "YouTube",
    upload: "Încarcă",
    library: "Bibliotecă video",
    searchPlaceholder: "Caută videoclipuri...",
    noVideos: "Niciun videoclip în bibliotecă",
    noVideosHint: "Adaugă videoclipuri folosind butoanele de mai sus",
    noResults: "Niciun rezultat găsit",
    nowPlaying: "Se redă:",
    play: "Redare",
    pause: "Pauză",
    stop: "Stop",
    volume: "Volum",
    rename: "Redenumește",
    delete: "Șterge",
    confirmDelete: "Șterge",
    cancel: "Anulează",
    youtubeUrl: "Lipește URL YouTube...",
    download: "Descarcă",
    downloading: "Se descarcă...",
    processing: "Se procesează...",
    complete: "Finalizat!",
    uploadDrop: "Trage fișierul video sau click pentru a naviga",
    uploadHint: "Max 1GB - MP4, WebM, MOV, AVI, MKV",
    uploading: "Se încarcă...",
    invalidUrl: "Te rog introdu un URL YouTube valid",
    enterUrl: "Te rog introdu un URL",
  },
};

const en: Translations = {
  nav: {
    hymns: "Hymns",
    bible: "Bible",
    video: "Video",
    settings: "Settings",
  },
  header: {
    goIdle: "Go Idle",
  },
  status: {
    idle: "Idle",
    playingVideo: "Playing video",
    videoPaused: "Video paused",
  },
  hymns: {
    searchPlaceholder: "Search by number or title...",
    nowDisplaying: "Now displaying:",
    slide: "Slide",
    of: "of",
    noHymnsFound: "No hymns found for",
    verses: "verses",
    verse: "verse",
    chorus: "chorus",
  },
  bible: {
    quickSearch: "Quick Search",
    quickSearchHint:
      "Type a reference like: gen 2:16, ps 23:1-6, john 3:16, 1ki 1:20",
    browse: "Browse",
    book: "Book",
    chapter: "Chapter",
    fromVerse: "From verse",
    toVerse: "To verse",
    load: "Load",
    loadVerses: "Load Verses",
    selectBook: "Select a book...",
    couldNotParse: "Could not parse reference",
  },
  settings: {
    language: "Language",
    display: "Display",
    displayMonitor: "Display Monitor",
    autoSecondary: "Auto (Secondary Monitor)",
    selectMonitorHint: "Select which monitor to use for the display output",
    mobileRemote: "Mobile Remote",
    scanOrVisit: "Scan or visit:",
    sameWifi: "Make sure your phone is connected to the same WiFi network",
    about: "About",
    churchDisplayApp: "Church Display Application",
    keyboardShortcuts: "Keyboard Shortcuts",
    nextSlide: "Next slide",
    previousSlide: "Previous slide",
    goToIdle: "Go to idle",
  },
  videoLibrary: {
    addLocalFile: "Add file",
    youtube: "YouTube",
    upload: "Upload",
    library: "Video Library",
    searchPlaceholder: "Search videos...",
    noVideos: "No videos in library",
    noVideosHint: "Add videos using the buttons above",
    noResults: "No results found",
    nowPlaying: "Now playing:",
    play: "Play",
    pause: "Pause",
    stop: "Stop",
    volume: "Volume",
    rename: "Rename",
    delete: "Delete",
    confirmDelete: "Delete",
    cancel: "Cancel",
    youtubeUrl: "Paste YouTube URL...",
    download: "Download",
    downloading: "Downloading...",
    processing: "Processing...",
    complete: "Complete!",
    uploadDrop: "Drop video file or click to browse",
    uploadHint: "Max 1GB - MP4, WebM, MOV, AVI, MKV",
    uploading: "Uploading...",
    invalidUrl: "Please enter a valid YouTube URL",
    enterUrl: "Please enter a URL",
  },
};

const translations: Record<Language, Translations> = { ro, en };

export function getTranslations(language: Language): Translations {
  return translations[language] || translations.ro;
}

// Language display names
export const LANGUAGE_NAMES: Record<Language, string> = {
  ro: "Română",
  en: "English",
};

export const AVAILABLE_LANGUAGES: Language[] = ["ro", "en"];
