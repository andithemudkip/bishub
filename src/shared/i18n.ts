// Internationalization (i18n) system for BisHub
// Supports Romanian (ro) and English (en)

export type Language = "ro" | "en";

export interface Translations {
  // Common
  common: {
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    daysAgo: string;
  };

  // Navigation
  nav: {
    hymns: string;
    bible: string;
    images: string;
    video: string;
    audio: string;
    transfer: string;
    settings: string;
    more: string;
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
    presentingImage: string;
    presentingSlideshow: string;
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
    chorusPrefix: string;
    nowPlaying: string;
    switchToStatic: string;
    switchToSynced: string;
  };

  // Karaoke audio (TTML + MP3)
  karaoke: {
    sectionTitle: string;
    defaultToggleLabel: string;
    defaultToggleHint: string;
    cacheStats: string; // {count}, {total}, {size}
    downloadAll: string;
    downloadAllConfirm: string; // {size}
    downloading: string;
    cancelAll: string;
    clearCache: string;
    clearCacheConfirm: string;
    bannerText: string;
    bannerDismiss: string;
    bannerOpenSettings: string;
    downloadButton: string;
    cancelDownload: string;
    errorDownload: string;
    errorDiskSpace: string;
    statusQueued: string;
  };

  // Bible page
  bible: {
    searchPlaceholder: string;
    go: string;
    back: string;
    browse: string;
    oldTestament: string;
    newTestament: string;
    filterBooks: string;
    chapter: string;
    verse: string;
    tapToJump: string;
    currentlyDisplaying: string;
    currentlyLoaded: string;
    viewVerses: string;
    couldNotParse: string;
    searchResults: string;
    noSearchResults: string;
    searching: string;
    minCharsHint: string;
    recentSearches: string;
    clearHistory: string;
    examples: string;
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
    volume: string;
    securityKey: string;
    securityKeyHint: string;
    openOnStartup: string;
    focusSearch: string;
    switchPage: string;
    // Idle screen settings
    idleScreen: string;
    wallpaper: string;
    selectWallpaper: string;
    clearWallpaper: string;
    noWallpaper: string;
    clockFontSize: string;
    clockPosition: string;
    positionTopLeft: string;
    positionTopRight: string;
    positionBottomLeft: string;
    positionBottomRight: string;
    positionCenter: string;
    audioWidgetPosition: string;
    bibleTranslation: string;
    downloadingBible: string;
    bibleDownloadError: string;
    displayTip: string;
    idleScreenTip: string;
    mobileRemoteTip: string;
    keyboardShortcutsTip: string;
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
    invalidType: string;
    tooLarge: string;
    uploadFailed: string;
    invalidUrl: string;
    enterUrl: string;
    openFileLocation: string;
    addTip: string;
  };

  // Audio library
  audioLibrary: {
    addLocalFile: string;
    addFolder: string;
    upload: string;
    library: string;
    searchPlaceholder: string;
    noAudios: string;
    noAudiosHint: string;
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
    uploadDrop: string;
    uploadHint: string;
    uploading: string;
    invalidType: string;
    tooLarge: string;
    uploadFailed: string;
    processing: string;
    complete: string;
    // YouTube audio download
    youtube: string;
    youtubeUrl: string;
    download: string;
    enterUrl: string;
    invalidUrl: string;
    // Directory import
    scanningFolder: string;
    importingFolder: string;
    importProgress: string;
    importComplete: string;
    importErrors: string;
    noAudioFiles: string;
    openFileLocation: string;
    addTip: string;
    libraryTab: string;
    scheduleTab: string;
  };

  // Audio scheduling
  audioSchedule: {
    title: string;
    newSchedule: string;
    atTime: string;
    inMinutes: string;
    schedule: string;
    saveAsPreset: string;
    presets: string;
    noPresets: string;
    pendingSchedules: string;
    noPendingSchedules: string;
    scheduledFor: string;
    inXMinutes: string;
    cancel: string;
    activate: string;
    delete: string;
    presetName: string;
    selectAudio: string;
    enterTime: string;
    enterMinutes: string;
    willPlayAt: string;
    skippedNotIdle: string;
    triggered: string;
    expired: string;
    tip: string;
  };

  // Image Library
  imageLibrary: {
    addLocalFile: string;
    addLocalFiles: string;
    upload: string;
    searchPlaceholder: string;
    noImages: string;
    noImagesHint: string;
    noResults: string;
    present: string;
    rename: string;
    delete: string;
    confirmDelete: string;
    cancel: string;
    uploadDrop: string;
    uploadHint: string;
    uploading: string;
    processing: string;
    complete: string;
    invalidType: string;
    tooLarge: string;
    uploadFailed: string;
    openFileLocation: string;
    addTip: string;
    // Slideshow
    slideshow: string;
    createSlideshow: string;
    slideshowName: string;
    enterName: string;
    deleteSlideshow: string;
    deleteSlideshowHint: string;
    addImages: string;
    removeFromSlideshow: string;
    imagesCount: string;
    // Slideshow settings
    autoAdvance: string;
    interval: string;
    seconds: string;
    loop: string;
    fit: string;
    fitFill: string;
    fitContain: string;
    // Multi-select
    selectMode: string;
    selectedCount: string;
    // Upload prompt
    addAsIndividual: string;
    addAsSlideshow: string;
    multipleImagesPrompt: string;
    confirmBulkDelete: string;
    emptySlideshowLabel: string;
    emptySlideshowHint: string;
  };

  // File Transfers
  transfer: {
    uploadDrop: string;
    uploadHint: string;
    noFiles: string;
    noFilesHint: string;
    addToVideo: string;
    addToAudio: string;
    addToImages: string;
    openInExplorer: string;
    delete: string;
    confirmDelete: string;
    uploading: string;
    complete: string;
    uploadFailed: string;
    addedToVideo: string;
    addedToAudio: string;
    addedToImages: string;
    files: string;
    uploadTip: string;
    filesTip: string;
  };

  // Preview panel
  preview: {
    title: string;
    collapse: string;
    expand: string;
    tapToCollapse: string;
    current: string;
    next: string;
    endOfSlides: string;
  };

  // Auth
  auth: {
    accessDenied: string;
    invalidKeyMessage: string;
    securityKeyLabel: string;
    securityKeyPlaceholder: string;
    connect: string;
    connectionFailed: string;
  };

  // Updates
  updates: {
    updateAvailable: string;
    updateDownloading: string;
    updateReady: string;
    restartToUpdate: string;
    currentVersion: string;
    checkingForUpdates: string;
    upToDate: string;
    checkForUpdates: string;
    newVersion: string;
  };

  // Diagnostics (bundled binaries shown in Settings > About)
  diagnostics: {
    bundledBinaries: string;
    available: string;
    notFound: string;
    sourceOta: string;
    sourceBundled: string;
    sourceSystem: string;
    unknownVersion: string;
  };

  // YouTube download phase labels (shared between video and audio)
  youtubeDownload: {
    preparing: string;
    fetching: string;
    downloading: string;
    extracting: string;
    merging: string;
  };
}

const ro: Translations = {
  common: {
    justNow: "acum",
    minutesAgo: "acum {n} min",
    hoursAgo: "acum {n} ore",
    daysAgo: "acum {n} zile",
  },
  nav: {
    hymns: "Imnuri",
    bible: "Biblie",
    images: "Imagini",
    video: "Video",
    audio: "Audio",
    transfer: "Transfer",
    settings: "Setări",
    more: "Mai mult",
  },
  header: {
    goIdle: "Întrerupe",
  },
  status: {
    idle: "Inactiv",
    playingVideo: "Redare video",
    videoPaused: "Video în pauză",
    presentingImage: "Afișare imagine",
    presentingSlideshow: "Prezentare",
  },
  hymns: {
    searchPlaceholder: "Caută după număr sau titlu...",
    nowDisplaying: "Se afișează:",
    slide: "Slide",
    of: "din",
    noHymnsFound: "Nu s-au găsit imnuri pentru",
    verses: "strofe",
    verse: "strofă",
    chorus: "refren",
    chorusPrefix: "R",
    nowPlaying: "Redare:",
    switchToStatic: "Text simplu",
    switchToSynced: "Sincronizat",
  },
  karaoke: {
    sectionTitle: "Lirică sincronizată",
    defaultToggleLabel: "Activată implicit",
    defaultToggleHint:
      "Imnurile cu instrumentalul descărcat pornesc cu lirică sincronizată. Poți comuta la text simplu pentru fiecare imn în bara de redare.",
    cacheStats: "{count} din {total} instrumentale descărcate · {size}",
    downloadAll: "Descarcă tot",
    downloadAllConfirm: "Descarcă {size}? Asta poate dura câteva minute.",
    downloading: "Se descarcă...",
    cancelAll: "Anulează tot",
    clearCache: "Șterge cache-ul",
    clearCacheConfirm: "Sigur ștergi toate instrumentalele descărcate?",
    bannerText:
      "Instrumentale disponibile pentru imnurile sincronizate.",
    bannerDismiss: "Ascunde",
    bannerOpenSettings: "Deschide setările",
    downloadButton: "Descarcă",
    cancelDownload: "Anulează",
    errorDownload: "Descărcare eșuată",
    errorDiskSpace: "Spațiu insuficient pe disc",
    statusQueued: "În așteptare",
  },
  bible: {
    searchPlaceholder: "Tastează o referință sau caută text...",
    go: "Du-te",
    back: "Înapoi",
    browse: "Răsfoiește",
    oldTestament: "Vechiul Testament",
    newTestament: "Noul Testament",
    filterBooks: "Filtrează cărțile...",
    chapter: "Capitol",
    verse: "Versetul",
    tapToJump: "Atinge un verset pentru a sări la el",
    currentlyDisplaying: "Se afișează",
    currentlyLoaded: "Versete încărcate",
    viewVerses: "Vezi versetele",
    couldNotParse: "Nu s-a putut interpreta referința",
    searchResults: "Rezultate",
    noSearchResults: "Niciun rezultat găsit pentru",
    searching: "Se caută...",
    minCharsHint: "Introdu cel puțin 3 caractere",
    recentSearches: "Căutări recente",
    clearHistory: "Șterge istoricul",
    examples: "Exemple",
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
    volume: "Volum",
    focusSearch: "Focalizează câmpul de căutare",
    switchPage: "Schimbă pagina",
    // Idle screen settings
    idleScreen: "Ecran de așteptare",
    wallpaper: "Fundal",
    selectWallpaper: "Selectează imaginea",
    clearWallpaper: "Șterge",
    noWallpaper: "Fără imagine",
    clockFontSize: "Dimensiune ceas",
    clockPosition: "Poziție ceas",
    positionTopLeft: "Stânga sus",
    positionTopRight: "Dreapta sus",
    positionBottomLeft: "Stânga jos",
    positionBottomRight: "Dreapta jos",
    positionCenter: "Centru",
    audioWidgetPosition: "Poziție widget audio",
    bibleTranslation: "Traducere Biblie",
    downloadingBible: "Se descarcă traducerea...",
    bibleDownloadError: "Descărcarea a eșuat",
    securityKey: "Cheie de securitate:",
    securityKeyHint: "Necesară pentru a conecta alte dispozitive la această sesiune",
    openOnStartup: "Deschide la pornirea sistemului",
    displayTip:
      "Alege pe ce monitor se afișează conținutul proiectat. **Auto** folosește al doilea monitor dacă este conectat. Selectează manual dacă detectarea automată alege monitorul greșit.",
    idleScreenTip:
      "Ecranul de așteptare apare pe proiecție când nu se prezintă nimic. Poți seta o **imagine de fundal**, ajusta **ceasul** și poziționa **widgetul audio**.",
    mobileRemoteTip:
      "Controlează proiecția de pe telefon. Asigură-te că telefonul este pe **aceeași rețea WiFi**, apoi scanează codul QR sau tastează adresa URL în browser.",
    keyboardShortcutsTip:
      "Aceste scurtături funcționează în fereastra de control. Folosește **tastele săgeți** pentru a naviga între slide-uri.",
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
    volume: "Volum video",
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
    invalidType: "Tip de fișier invalid",
    tooLarge: "Fișierul este prea mare",
    uploadFailed: "Încărcarea a eșuat. Te rog încearcă din nou.",
    invalidUrl: "Te rog introdu un URL YouTube valid",
    enterUrl: "Te rog introdu un URL",
    openFileLocation: "Deschide locația fișierului",
    addTip:
      "**Adaugă fișier** alege un video de pe acest calculator. **YouTube** descarcă un video de la un link. **Încarcă** trimite un video de pe telefon sau alt dispozitiv.",
  },
  audioLibrary: {
    addLocalFile: "Adaugă fișier",
    addFolder: "Adaugă folder",
    upload: "Încarcă",
    library: "Bibliotecă audio",
    searchPlaceholder: "Caută audio...",
    noAudios: "Niciun fișier audio în bibliotecă",
    noAudiosHint: "Adaugă fișiere audio folosind butoanele de mai sus",
    noResults: "Niciun rezultat găsit",
    nowPlaying: "Se redă:",
    play: "Redare",
    pause: "Pauză",
    stop: "Stop",
    volume: "Volum audio",
    rename: "Redenumește",
    delete: "Șterge",
    confirmDelete: "Șterge",
    cancel: "Anulează",
    uploadDrop: "Trage fișierul audio sau click pentru a naviga",
    uploadHint: "Max 500MB - MP3, WAV, OGG, M4A, FLAC",
    uploading: "Se încarcă...",
    invalidType: "Tip de fișier invalid",
    tooLarge: "Fișierul este prea mare",
    uploadFailed: "Încărcarea a eșuat. Te rog încearcă din nou.",
    processing: "Se procesează...",
    complete: "Finalizat!",
    youtube: "YouTube",
    youtubeUrl: "Lipește linkul YouTube...",
    download: "Descarcă",
    enterUrl: "Te rog introdu un link",
    invalidUrl: "Te rog introdu un link YouTube valid",
    scanningFolder: "Se scanează folderul...",
    importingFolder: "Se importă folderul...",
    importProgress: "{current} din {total} fișiere",
    importComplete: "Import finalizat",
    importErrors: "{count} fișiere eșuate",
    noAudioFiles: "Niciun fișier audio găsit în folder",
    openFileLocation: "Deschide locația fișierului",
    addTip:
      "**Adaugă fișier** alege un fișier audio de pe acest calculator. **Adaugă folder** importă toate fișierele audio dintr-un folder. **Încarcă** trimite audio de pe telefon sau alt dispozitiv. **YouTube** descarcă doar track-ul audio dintr-un videoclip.",
    libraryTab: "Bibliotecă",
    scheduleTab: "Programare",
  },
  audioSchedule: {
    title: "Programare audio",
    newSchedule: "Programare nouă",
    atTime: "La ora",
    inMinutes: "Peste minute",
    schedule: "Programează",
    saveAsPreset: "Salvează ca preset",
    presets: "Presetări",
    noPresets: "Nicio presetare salvată",
    pendingSchedules: "Programări active",
    noPendingSchedules: "Nicio programare activă",
    scheduledFor: "Programat pentru",
    inXMinutes: "peste {minutes} minute",
    cancel: "Anulează",
    activate: "Activează",
    delete: "Șterge",
    presetName: "Nume preset",
    selectAudio: "Selectează fișierul audio",
    enterTime: "Introdu ora (HH:MM)",
    enterMinutes: "Minute de acum",
    willPlayAt: "Va reda la",
    skippedNotIdle: "Omis (nu e în modul inactiv)",
    triggered: "Redat",
    expired: "Expirat",
    tip: "Programează redarea audio automat la o anumită oră sau după un număr de minute. Audio-ul se redă doar când ecranul este **inactiv**. Salvează programări ca **presetări** pentru reutilizare rapidă.",
  },
  imageLibrary: {
    addLocalFile: "Adaugă fișier",
    addLocalFiles: "Adaugă fișiere",
    upload: "Încarcă",
    searchPlaceholder: "Caută imagini...",
    noImages: "Nicio imagine în bibliotecă",
    noImagesHint: "Adaugă imagini folosind butoanele de mai sus",
    noResults: "Niciun rezultat găsit",
    present: "Prezintă",
    rename: "Redenumește",
    delete: "Șterge",
    confirmDelete: "Șterge",
    cancel: "Anulează",
    uploadDrop: "Trage imagini sau click pentru a naviga",
    uploadHint: "Max 100MB - JPG, PNG, GIF, WebP",
    uploading: "Se încarcă...",
    processing: "Se procesează...",
    complete: "Finalizat!",
    invalidType: "Tip de fișier invalid",
    tooLarge: "Fișierul este prea mare",
    uploadFailed: "Încărcarea a eșuat. Te rog încearcă din nou.",
    openFileLocation: "Deschide locația fișierului",
    addTip:
      "**Adaugă fișier** alege o imagine de pe acest calculator. **Încarcă** trimite o imagine de pe telefon sau alt dispozitiv.",
    slideshow: "Prezentare",
    createSlideshow: "Crează prezentare",
    slideshowName: "Nume prezentare",
    enterName: "Introdu un nume...",
    deleteSlideshow: "Șterge prezentarea",
    deleteSlideshowHint: "Imaginile nu vor fi șterse",
    addImages: "Adaugă imagini",
    removeFromSlideshow: "Scoate din prezentare",
    imagesCount: "{count} imagini",
    autoAdvance: "Avansare automată",
    interval: "Interval",
    seconds: "secunde",
    loop: "Repetare",
    fit: "Încadrare",
    fitFill: "Umple",
    fitContain: "Încadrează",
    selectMode: "Selectare",
    selectedCount: "{count} selectate",
    addAsIndividual: "Adaugă individual",
    addAsSlideshow: "Crează prezentare",
    multipleImagesPrompt: "Adaugă ca imagini individuale sau crează o prezentare?",
    confirmBulkDelete: "Confirmă ștergerea",
    emptySlideshowLabel: "Goală",
    emptySlideshowHint: "Această prezentare nu conține imagini",
  },
  transfer: {
    uploadDrop: "Trage fișiere aici sau apasă pentru a selecta",
    uploadHint: "Orice tip de fișier, max 2GB",
    noFiles: "Niciun fișier transferat",
    noFilesHint: "Deschide această pagină pe telefon pentru a trimite fișiere",
    addToVideo: "Adaugă la video",
    addToAudio: "Adaugă la audio",
    addToImages: "Adaugă la imagini",
    openInExplorer: "Deschide în explorer",
    delete: "Șterge",
    confirmDelete: "Sigur vrei să ștergi acest fișier?",
    uploading: "Se încarcă...",
    complete: "Complet!",
    uploadFailed: "Încărcarea a eșuat",
    addedToVideo: "Adăugat în biblioteca video",
    addedToAudio: "Adăugat în biblioteca audio",
    addedToImages: "Adăugat în biblioteca de imagini",
    files: "Fișiere",
    uploadTip:
      "Trage fișiere aici sau apasă pentru a selecta. Fișierele încărcate sunt păstrate temporar până le muți în biblioteca **video** sau **audio**.",
    filesTip:
      "Aici poți trimite fișiere de pe **telefon** sau din **browser** către calculatorul principal. Adăugarea într-o bibliotecă **copiază** fișierul — originalul rămâne aici și ocupă spațiu. După ce l-ai adăugat la **video** sau **audio**, poți să-l **ștergi** în siguranță de aici.",
  },
  preview: {
    title: "Previzualizare",
    collapse: "Ascunde",
    expand: "Arată previzualizare",
    tapToCollapse: "Atinge pentru a ascunde",
    current: "Curent",
    next: "Următor",
    endOfSlides: "Sfârșitul slide-urilor",
  },
  updates: {
    updateAvailable: "Actualizare disponibilă",
    updateDownloading: "Se descarcă actualizarea...",
    updateReady: "Actualizare pregătită",
    restartToUpdate: "Reporniți pentru actualizare",
    currentVersion: "Versiunea curentă",
    checkingForUpdates: "Se verifică actualizările...",
    upToDate: "Aplicația este la zi",
    checkForUpdates: "Verifică actualizări",
    newVersion: "Versiune nouă",
  },
  diagnostics: {
    bundledBinaries: "Binare incluse",
    available: "Disponibil",
    notFound: "Lipsește",
    sourceOta: "actualizat",
    sourceBundled: "inclus",
    sourceSystem: "sistem",
    unknownVersion: "versiune necunoscută",
  },
  youtubeDownload: {
    preparing: "Se pregătește...",
    fetching: "Se obțin informațiile...",
    downloading: "Se descarcă...",
    extracting: "Se extrage audio...",
    merging: "Se combină...",
  },
  auth: {
    accessDenied: "Acces refuzat",
    invalidKeyMessage: "Cheia de securitate lipsește sau este invalidă. Introdu cheia corectă pentru a te conecta.",
    securityKeyLabel: "Cheie de securitate",
    securityKeyPlaceholder: "Introdu cheia de securitate",
    connect: "Conectare",
    connectionFailed: "Conectarea a eșuat. Verifică cheia și încearcă din nou.",
  },
};

const en: Translations = {
  common: {
    justNow: "just now",
    minutesAgo: "{n}m ago",
    hoursAgo: "{n}h ago",
    daysAgo: "{n}d ago",
  },
  nav: {
    hymns: "Hymns",
    bible: "Bible",
    images: "Images",
    video: "Video",
    audio: "Audio",
    transfer: "Transfer",
    settings: "Settings",
    more: "More",
  },
  header: {
    goIdle: "Go Idle",
  },
  status: {
    idle: "Idle",
    playingVideo: "Playing video",
    videoPaused: "Video paused",
    presentingImage: "Presenting image",
    presentingSlideshow: "Slideshow",
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
    chorusPrefix: "Ch",
    nowPlaying: "Now playing:",
    switchToStatic: "Static",
    switchToSynced: "Synced",
  },
  karaoke: {
    sectionTitle: "Synced lyrics",
    defaultToggleLabel: "Enabled by default",
    defaultToggleHint:
      "Hymns with a downloaded instrumental start with synced lyrics. You can switch to static text per hymn from the playback bar.",
    cacheStats: "{count} of {total} instrumentals downloaded · {size}",
    downloadAll: "Download all",
    downloadAllConfirm:
      "Download {size}? This may take a few minutes.",
    downloading: "Downloading...",
    cancelAll: "Cancel all",
    clearCache: "Clear cache",
    clearCacheConfirm:
      "Delete all downloaded instrumentals?",
    bannerText:
      "Instrumentals available for synced hymns.",
    bannerDismiss: "Dismiss",
    bannerOpenSettings: "Open settings",
    downloadButton: "Download",
    cancelDownload: "Cancel",
    errorDownload: "Download failed",
    errorDiskSpace: "Insufficient disk space",
    statusQueued: "Queued",
  },
  bible: {
    searchPlaceholder: "Type a reference or search text...",
    go: "Go",
    back: "Back",
    browse: "Browse",
    oldTestament: "Old Testament",
    newTestament: "New Testament",
    filterBooks: "Filter books...",
    chapter: "Chapter",
    verse: "Verse",
    tapToJump: "Tap a verse to jump to it",
    currentlyDisplaying: "Currently displaying",
    currentlyLoaded: "Currently loaded verses",
    viewVerses: "View verses",
    couldNotParse: "Could not parse reference",
    searchResults: "Results",
    noSearchResults: "No results found for",
    searching: "Searching...",
    minCharsHint: "Enter at least 3 characters",
    recentSearches: "Recent searches",
    clearHistory: "Clear history",
    examples: "Examples",
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
    volume: "Volume",
    focusSearch: "Focus search input",
    switchPage: "Switch page",
    // Idle screen settings
    idleScreen: "Idle Screen",
    wallpaper: "Wallpaper",
    selectWallpaper: "Select image",
    clearWallpaper: "Clear",
    noWallpaper: "No image",
    clockFontSize: "Clock size",
    clockPosition: "Clock position",
    positionTopLeft: "Top left",
    positionTopRight: "Top right",
    positionBottomLeft: "Bottom left",
    positionBottomRight: "Bottom right",
    positionCenter: "Center",
    audioWidgetPosition: "Audio widget position",
    bibleTranslation: "Bible Translation",
    downloadingBible: "Downloading translation...",
    bibleDownloadError: "Download failed",
    securityKey: "Security Key:",
    securityKeyHint: "Required to connect other devices to this session",
    openOnStartup: "Open on system startup",
    displayTip:
      "Choose which monitor shows the projected content. **Auto** uses the second monitor if connected. Pick a specific monitor if auto-detection chooses the wrong one.",
    idleScreenTip:
      "The idle screen is what's shown on the projection when nothing is being presented. You can set a **background image**, adjust the **clock**, and position the **audio widget**.",
    mobileRemoteTip:
      "Control the projection from your phone. Make sure your phone is on the **same WiFi network**, then scan the QR code or type the URL into your browser.",
    keyboardShortcutsTip:
      "These shortcuts work in the remote control window. Use **arrow keys** to navigate between slides.",
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
    volume: "Video volume",
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
    invalidType: "Invalid file type",
    tooLarge: "File is too large",
    uploadFailed: "Upload failed. Please try again.",
    invalidUrl: "Please enter a valid YouTube URL",
    enterUrl: "Please enter a URL",
    openFileLocation: "Open file location",
    addTip:
      "**Add file** picks a video from this computer. **YouTube** downloads a video from a link. **Upload** sends a video from your phone or another device.",
  },
  audioLibrary: {
    addLocalFile: "Add file",
    addFolder: "Add folder",
    upload: "Upload",
    library: "Audio Library",
    searchPlaceholder: "Search audio...",
    noAudios: "No audio files in library",
    noAudiosHint: "Add audio files using the buttons above",
    noResults: "No results found",
    nowPlaying: "Now playing:",
    play: "Play",
    pause: "Pause",
    stop: "Stop",
    volume: "Audio volume",
    rename: "Rename",
    delete: "Delete",
    confirmDelete: "Delete",
    cancel: "Cancel",
    uploadDrop: "Drop audio file or click to browse",
    uploadHint: "Max 500MB - MP3, WAV, OGG, M4A, FLAC",
    uploading: "Uploading...",
    invalidType: "Invalid file type",
    tooLarge: "File is too large",
    uploadFailed: "Upload failed. Please try again.",
    processing: "Processing...",
    complete: "Complete!",
    youtube: "YouTube",
    youtubeUrl: "Paste YouTube URL...",
    download: "Download",
    enterUrl: "Please enter a URL",
    invalidUrl: "Please enter a valid YouTube URL",
    scanningFolder: "Scanning folder...",
    importingFolder: "Importing folder...",
    importProgress: "{current} of {total} files",
    importComplete: "Import complete",
    importErrors: "{count} files failed",
    noAudioFiles: "No audio files found in folder",
    openFileLocation: "Open file location",
    addTip:
      "**Add file** picks an audio file from this computer. **Add folder** imports all audio files from a folder at once. **Upload** sends audio from your phone or another device. **YouTube** downloads just the audio track from a video.",
    libraryTab: "Library",
    scheduleTab: "Schedule",
  },
  audioSchedule: {
    title: "Audio Scheduling",
    newSchedule: "New Schedule",
    atTime: "At time",
    inMinutes: "In minutes",
    schedule: "Schedule",
    saveAsPreset: "Save as Preset",
    presets: "Presets",
    noPresets: "No presets saved",
    pendingSchedules: "Pending Schedules",
    noPendingSchedules: "No scheduled audio",
    scheduledFor: "Scheduled for",
    inXMinutes: "in {minutes} minutes",
    cancel: "Cancel",
    activate: "Activate",
    delete: "Delete",
    presetName: "Preset name",
    selectAudio: "Select audio file",
    enterTime: "Enter time (HH:MM)",
    enterMinutes: "Minutes from now",
    willPlayAt: "Will play at",
    skippedNotIdle: "Skipped (not in idle mode)",
    triggered: "Played",
    expired: "Expired",
    tip: "Schedule audio to play automatically at a set time or after a number of minutes. Audio only plays when the display is **idle**. Save schedules as **presets** for quick reuse.",
  },
  imageLibrary: {
    addLocalFile: "Add file",
    addLocalFiles: "Add files",
    upload: "Upload",
    searchPlaceholder: "Search images...",
    noImages: "No images in library",
    noImagesHint: "Add images using the buttons above",
    noResults: "No results found",
    present: "Present",
    rename: "Rename",
    delete: "Delete",
    confirmDelete: "Delete",
    cancel: "Cancel",
    uploadDrop: "Drop images or click to browse",
    uploadHint: "Max 100MB - JPG, PNG, GIF, WebP",
    uploading: "Uploading...",
    processing: "Processing...",
    complete: "Complete!",
    invalidType: "Invalid file type",
    tooLarge: "File is too large",
    uploadFailed: "Upload failed. Please try again.",
    openFileLocation: "Open file location",
    addTip:
      "**Add file** picks an image from this computer. **Upload** sends an image from your phone or another device.",
    slideshow: "Slideshow",
    createSlideshow: "Create slideshow",
    slideshowName: "Slideshow name",
    enterName: "Enter a name...",
    deleteSlideshow: "Delete slideshow",
    deleteSlideshowHint: "Images will not be deleted",
    addImages: "Add images",
    removeFromSlideshow: "Remove from slideshow",
    imagesCount: "{count} images",
    autoAdvance: "Auto-advance",
    interval: "Interval",
    seconds: "seconds",
    loop: "Loop",
    fit: "Fit",
    fitFill: "Fill",
    fitContain: "Contain",
    selectMode: "Select",
    selectedCount: "{count} selected",
    addAsIndividual: "Add individually",
    addAsSlideshow: "Create slideshow",
    multipleImagesPrompt: "Add as individual images or create a slideshow?",
    confirmBulkDelete: "Confirm delete",
    emptySlideshowLabel: "Empty",
    emptySlideshowHint: "This slideshow has no images",
  },
  transfer: {
    uploadDrop: "Drag files here or tap to select",
    uploadHint: "Any file type, max 2GB",
    noFiles: "No transferred files",
    noFilesHint: "Open this page on your phone to upload files",
    addToVideo: "Add to video",
    addToAudio: "Add to audio",
    addToImages: "Add to images",
    openInExplorer: "Open in explorer",
    delete: "Delete",
    confirmDelete: "Are you sure you want to delete this file?",
    uploading: "Uploading...",
    complete: "Complete!",
    uploadFailed: "Upload failed",
    addedToVideo: "Added to video library",
    addedToAudio: "Added to audio library",
    addedToImages: "Added to image library",
    files: "Files",
    uploadTip:
      "Drag files here or tap to browse. Uploaded files are held in a temporary area until you move them to the **video** or **audio** library.",
    filesTip:
      "Transfer files from your **phone** or **browser** to the main computer here. Adding to a library **copies** the file — the original stays here and still takes up space. Once added to **video** or **audio**, you can safely **delete** it from here.",
  },
  preview: {
    title: "Preview",
    collapse: "Collapse",
    expand: "Show preview",
    tapToCollapse: "Tap to hide",
    current: "Current",
    next: "Next",
    endOfSlides: "End of slides",
  },
  updates: {
    updateAvailable: "Update available",
    updateDownloading: "Downloading update...",
    updateReady: "Update ready",
    restartToUpdate: "Restart to update",
    currentVersion: "Current version",
    checkingForUpdates: "Checking for updates...",
    upToDate: "You're up to date",
    checkForUpdates: "Check for updates",
    newVersion: "New version",
  },
  diagnostics: {
    bundledBinaries: "Bundled binaries",
    available: "Available",
    notFound: "Not found",
    sourceOta: "updated",
    sourceBundled: "bundled",
    sourceSystem: "system",
    unknownVersion: "version unknown",
  },
  youtubeDownload: {
    preparing: "Preparing...",
    fetching: "Fetching video info...",
    downloading: "Downloading...",
    extracting: "Extracting audio...",
    merging: "Merging streams...",
  },
  auth: {
    accessDenied: "Access Denied",
    invalidKeyMessage: "The security key is missing or invalid. Enter the correct key to connect.",
    securityKeyLabel: "Security Key",
    securityKeyPlaceholder: "Enter security key",
    connect: "Connect",
    connectionFailed: "Connection failed. Check the key and try again.",
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
