import type {
  DisplayState,
  AppSettings,
  DisplayMode,
  ClockPosition,
  AudioWidgetPosition,
  TextContentType,
  HymnRef,
  BibleContext,
} from "../src/shared/types";
import type { ParsedTTML } from "../src/shared/ttmlParser";
import { buildScreenGroups, getActiveScreen } from "../src/shared/ttmlParser";
import type { Language } from "../src/shared/i18n";
import { DEFAULT_STATE, DEFAULT_SETTINGS } from "../src/shared/types";
import Store from "electron-store";
import crypto from "crypto";

type StateChangeCallback = (state: DisplayState) => void;
type SettingsChangeCallback = (settings: AppSettings) => void;

interface SettingsSchema {
  settings: AppSettings;
  idleSettings: {
    wallpaper: string | null;
    clockFontSize: number;
    clockPosition: ClockPosition;
    audioWidgetPosition: AudioWidgetPosition;
  };
}

export class StateManager {
  private state: DisplayState;
  private settings: AppSettings;
  private stateListeners: StateChangeCallback[] = [];
  private settingsListeners: SettingsChangeCallback[] = [];
  private settingsStore: Store<SettingsSchema>;
  private securityKey: string;
  private autoAdvanceTimer: NodeJS.Timeout | null = null;
  private cachedScreenGroups: number[][] = [];

  constructor() {
    // Generate random security key for web remote authentication
    this.securityKey = crypto.randomBytes(4).toString("hex");
    console.log("Security key generated:", this.securityKey);
    // Deep copy DEFAULT_STATE to avoid mutating the original
    this.state = {
      mode: DEFAULT_STATE.mode,
      idle: { ...DEFAULT_STATE.idle },
      text: { ...DEFAULT_STATE.text, slides: [] },
      video: { ...DEFAULT_STATE.video },
      audio: { ...DEFAULT_STATE.audio },
      image: { ...DEFAULT_STATE.image, slideshowImages: [] },
    };

    // Initialize settings store
    this.settingsStore = new Store<SettingsSchema>({
      name: "settings",
      defaults: {
        settings: DEFAULT_SETTINGS,
        idleSettings: {
          wallpaper: null,
          clockFontSize: 100,
          clockPosition: "center",
          audioWidgetPosition: "bottom-right",
        },
      },
    });

    // Load persisted settings and merge with defaults to handle missing fields
    const storedSettings = this.settingsStore.get("settings");
    this.settings = { ...DEFAULT_SETTINGS, ...storedSettings };
    console.log("Loaded settings:", this.settings);

    // Load persisted idle settings
    const idleSettings = this.settingsStore.get("idleSettings");
    if (idleSettings) {
      this.state.idle.wallpaper = idleSettings.wallpaper ?? null;
      this.state.idle.clockFontSize = idleSettings.clockFontSize ?? 100;
      this.state.idle.clockPosition = idleSettings.clockPosition ?? "center";
      this.state.idle.audioWidgetPosition =
        idleSettings.audioWidgetPosition ?? "bottom-right";
    }

    // Initialize video volume from persisted settings (with fallback)
    this.state.video.volume = this.settings.volume ?? 1;

    // Initialize audio volume from persisted settings
    this.state.audio.volume = this.settings.audioVolume ?? 1;
  }

  getState(): DisplayState {
    return { ...this.state };
  }

  getSettings(): AppSettings {
    return { ...this.settings };
  }

  getSecurityKey(): string {
    return this.securityKey;
  }

  onStateChange(callback: StateChangeCallback) {
    this.stateListeners.push(callback);
    return () => {
      this.stateListeners = this.stateListeners.filter((cb) => cb !== callback);
    };
  }

  onSettingsChange(callback: SettingsChangeCallback) {
    this.settingsListeners.push(callback);
    return () => {
      this.settingsListeners = this.settingsListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  private notifyStateChange() {
    const stateCopy = this.getState();
    this.stateListeners.forEach((cb) => cb(stateCopy));
  }

  private notifySettingsChange() {
    // Persist settings to store
    this.settingsStore.set("settings", this.settings);

    const settingsCopy = this.getSettings();
    this.settingsListeners.forEach((cb) => cb(settingsCopy));
  }

  /**
   * A hymn's karaoke or instrumental track belongs to the slides it came with,
   * so anything that replaces those slides must silence it. Background audio is
   * untouched — that one lives and dies with idle mode.
   */
  private stopHymnAudio() {
    if (this.state.audio.role === "hymn" && this.state.audio.src) {
      this.stopAudio();
    }
  }

  // Mode control
  setMode(mode: DisplayMode) {
    const isHymnAudio = this.state.audio.role === "hymn";
    // Stop hymn audio when leaving text mode
    if (isHymnAudio && mode !== "text" && this.state.audio.src) {
      this.stopAudio();
    }
    // Stop standalone audio when leaving idle mode
    if (!isHymnAudio && mode !== "idle" && this.state.audio.playing) {
      this.stopAudio();
    }
    this.state.mode = mode;
    this.notifyStateChange();
  }

  goIdle() {
    this.stopHymnAudio();
    this.state.text.syncedLyrics = undefined;
    this.cachedScreenGroups = [];
    this.state.mode = "idle";
    this.state.video.playing = false;
    this.clearAutoAdvanceTimer();
    this.notifyStateChange();
  }

  // Text mode
  loadText(
    title: string,
    content: string,
    contentType: TextContentType = "custom",
    hymnRef?: HymnRef
  ) {
    this.stopHymnAudio();
    this.cachedScreenGroups = [];

    const slides = content
      .split(/\n\n+|---+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    this.state.text = {
      title,
      slides,
      currentSlide: 0,
      contentType,
      bibleContext: undefined,
      hymnRef,
    };
    this.state.mode = "text";
    this.notifyStateChange();
  }

  loadSyncedHymn(
    title: string,
    slides: string[],
    syncedLyrics: ParsedTTML,
    audioPath: string,
    hymnRef?: HymnRef
  ) {
    this.state.text = {
      title,
      slides,
      currentSlide: 0,
      contentType: "hymn",
      bibleContext: undefined,
      hymnRef,
      syncedLyrics,
    };
    // Load audio without switching to idle mode
    this.state.audio = {
      src: audioPath,
      name: title,
      playing: true,
      currentTime: 0,
      duration: 0,
      volume: this.state.audio.volume,
      role: "hymn",
    };
    this.cachedScreenGroups = buildScreenGroups(slides, syncedLyrics.lines.length);
    this.state.mode = "text";
    this.notifyStateChange();
  }

  /**
   * Karaoke minus the word-sync: the instrumental plays while the operator
   * advances slides by hand, exactly as they do for a silent hymn. Deliberately
   * leaves `syncedLyrics` unset — that field is what makes slides follow the
   * audio, and here the two are independent.
   */
  loadInstrumentalHymn(
    title: string,
    slides: string[],
    audioPath: string,
    hymnRef?: HymnRef
  ) {
    this.cachedScreenGroups = [];
    this.state.text = {
      title,
      slides,
      currentSlide: 0,
      contentType: "hymn",
      bibleContext: undefined,
      hymnRef,
    };
    this.state.audio = {
      src: audioPath,
      name: title,
      playing: true,
      currentTime: 0,
      duration: 0,
      volume: this.state.audio.volume,
      role: "hymn",
    };
    this.state.mode = "text";
    this.notifyStateChange();
  }

  loadBibleChapter(
    title: string,
    slides: string[],
    startIndex: number,
    bibleContext: BibleContext
  ) {
    this.stopHymnAudio();
    this.cachedScreenGroups = [];
    this.state.text = {
      title,
      slides,
      currentSlide: startIndex,
      contentType: "bible",
      bibleContext,
    };
    this.state.mode = "text";
    this.notifyStateChange();
  }

  private getScreenGroups() {
    return this.cachedScreenGroups;
  }

  // Get the time at the end of a screen's last word
  private getScreenEndTime(groups: number[][], screenIndex: number) {
    const lines = this.state.text.syncedLyrics!.lines;
    const lastLineIdx = groups[screenIndex][groups[screenIndex].length - 1];
    const lastLine = lines[lastLineIdx];
    return lastLine.words[lastLine.words.length - 1].end;
  }

  nextSlide() {
    if (this.state.text.syncedLyrics) {
      const groups = this.getScreenGroups();
      const current = getActiveScreen(groups, this.state.text.syncedLyrics!.lines, this.state.audio.currentTime);
      if (current < groups.length - 1) {
        // Seek to end of current screen's last word — lets people hear the bridge
        this.seekAudio(this.getScreenEndTime(groups, current));
      }
      return;
    }
    if (this.state.text.currentSlide < this.state.text.slides.length - 1) {
      this.state.text.currentSlide++;
      this.notifyStateChange();
    }
  }

  prevSlide() {
    if (this.state.text.syncedLyrics) {
      const groups = this.getScreenGroups();
      const current = getActiveScreen(groups, this.state.text.syncedLyrics!.lines, this.state.audio.currentTime);
      if (current > 0) {
        // Seek to end of the screen before the previous one, so prev screen plays from its intro
        const target = current - 1;
        this.seekAudio(target > 0 ? this.getScreenEndTime(groups, target - 1) : 0);
      } else {
        this.seekAudio(0);
      }
      return;
    }
    if (this.state.text.currentSlide > 0) {
      this.state.text.currentSlide--;
      this.notifyStateChange();
    }
  }

  goToSlide(index: number) {
    if (index >= 0 && index < this.state.text.slides.length) {
      this.state.text.currentSlide = index;
      this.notifyStateChange();
    }
  }

  // Video mode
  loadVideo(src: string, videoId?: string) {
    this.stopHymnAudio();
    this.state.video = {
      src,
      videoId: videoId ?? null,
      playing: false,
      currentTime: 0,
      duration: 0,
      volume: this.state.video.volume,
    };
    this.state.mode = "video";
    this.notifyStateChange();
  }

  playVideo() {
    this.state.video.playing = true;
    this.notifyStateChange();
  }

  pauseVideo() {
    this.state.video.playing = false;
    this.notifyStateChange();
  }

  stopVideo() {
    this.state.video.src = null;
    this.state.video.videoId = null;
    this.state.video.currentTime = 0;
    this.state.video.duration = 0;
    this.goIdle();
  }

  seekVideo(time: number) {
    this.state.video.currentTime = time;
    this.notifyStateChange();
  }

  setVolume(volume: number) {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.state.video.volume = clampedVolume;
    this.settings.volume = clampedVolume;
    this.notifyStateChange();
    this.notifySettingsChange();
  }

  updateVideoTime(time: number, duration: number) {
    this.state.video.currentTime = time;
    this.state.video.duration = duration;
    this.notifyStateChange();
  }

  // Settings
  setDisplayMonitor(monitorId: number) {
    this.settings.displayMonitor = monitorId;
    this.notifySettingsChange();
  }

  setServerPort(port: number) {
    this.settings.serverPort = port;
    this.notifySettingsChange();
  }

  setLanguage(language: Language) {
    this.settings.language = language;
    this.notifySettingsChange();
  }

  setSyncedLyrics(enabled: boolean) {
    this.settings.syncedLyrics = enabled;
    this.notifySettingsChange();
  }

  setInstrumentals(enabled: boolean) {
    this.settings.instrumentals = enabled;
    this.notifySettingsChange();
  }

  setKaraokeBannerDismissed(dismissed: boolean) {
    this.settings.karaokeBannerDismissed = dismissed;
    this.notifySettingsChange();
  }

  setBibleTranslation(translationId: string) {
    this.settings.bibleTranslation = translationId;
    this.notifySettingsChange();
  }

  setHymnal(slug: string) {
    this.settings.hymnal = slug;
    this.notifySettingsChange();
  }

  setOpenOnStartup(openOnStartup: boolean) {
    this.settings.openOnStartup = openOnStartup;
    this.notifySettingsChange();
  }

  // Idle screen settings
  setIdleWallpaper(wallpaper: string | null) {
    this.state.idle.wallpaper = wallpaper;
    this.persistIdleSettings();
    this.notifyStateChange();
  }

  setClockFontSize(size: number) {
    this.state.idle.clockFontSize = Math.max(50, Math.min(150, size));
    this.persistIdleSettings();
    this.notifyStateChange();
  }

  setClockPosition(position: ClockPosition) {
    this.state.idle.clockPosition = position;
    this.persistIdleSettings();
    this.notifyStateChange();
  }

  private persistIdleSettings() {
    this.settingsStore.set("idleSettings", {
      wallpaper: this.state.idle.wallpaper,
      clockFontSize: this.state.idle.clockFontSize,
      clockPosition: this.state.idle.clockPosition,
      audioWidgetPosition: this.state.idle.audioWidgetPosition,
    });
  }

  // Audio mode (plays during idle)
  loadAudio(src: string, name: string) {
    this.state.audio = {
      src,
      name,
      playing: false,
      currentTime: 0,
      duration: 0,
      volume: this.state.audio.volume,
      role: "background",
    };
    // Ensure we're in idle mode for audio
    if (this.state.mode !== "idle") {
      this.state.mode = "idle";
    }
    this.notifyStateChange();
  }

  playAudio() {
    if (this.state.audio.src) {
      this.state.audio.playing = true;
      this.notifyStateChange();
    }
  }

  pauseAudio() {
    this.state.audio.playing = false;
    this.notifyStateChange();
  }

  stopAudio() {
    this.state.audio.playing = false;
    this.state.audio.currentTime = 0;
    this.state.audio.src = null;
    this.state.audio.name = null;
    this.state.audio.role = "background";
    this.notifyStateChange();
  }

  seekAudio(time: number) {
    this.state.audio.currentTime = time;
    this.notifyStateChange();
  }

  setAudioVolume(volume: number) {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.state.audio.volume = clampedVolume;
    this.settings.audioVolume = clampedVolume;
    this.notifyStateChange();
    this.notifySettingsChange();
  }

  updateAudioTime(time: number, duration: number) {
    this.state.audio.currentTime = time;
    this.state.audio.duration = duration;
    const finished = duration > 0 && time >= duration;
    if (this.state.text.syncedLyrics) {
      // Go idle when synced hymn audio finishes
      if (finished) {
        this.goIdle();
        return;
      }
      const groups = this.getScreenGroups();
      const screen = getActiveScreen(groups, this.state.text.syncedLyrics!.lines, this.state.audio.currentTime);
      this.state.text.currentSlide = screen;
    } else if (finished && this.state.audio.role === "hymn") {
      // An instrumental ending must not clear the screen the way karaoke does —
      // the slides are the operator's to advance, so just stop the transport.
      this.state.audio.playing = false;
    }
    this.notifyStateChange();
  }

  setAudioWidgetPosition(position: AudioWidgetPosition) {
    this.state.idle.audioWidgetPosition = position;
    this.persistIdleSettings();
    this.notifyStateChange();
  }

  // Image mode
  loadImage(src: string, imageId: string) {
    this.stopHymnAudio();
    this.clearAutoAdvanceTimer();
    this.state.image = {
      src,
      imageId,
      slideshowId: null,
      slideshowImages: [],
      currentIndex: 0,
      autoAdvance: false,
      autoAdvanceInterval: 5000,
      loop: false,
      fit: "fill",
    };
    this.state.mode = "image";
    this.notifyStateChange();
  }

  loadSlideshow(
    images: { src: string; imageId: string }[],
    slideshowId: string,
    settings: {
      autoAdvance: boolean;
      autoAdvanceInterval: number;
      loop: boolean;
      fit: "fill" | "fit";
    }
  ) {
    this.stopHymnAudio();
    this.clearAutoAdvanceTimer();
    if (images.length === 0) return;

    this.state.image = {
      src: images[0].src,
      imageId: images[0].imageId,
      slideshowId,
      slideshowImages: images,
      currentIndex: 0,
      autoAdvance: settings.autoAdvance,
      autoAdvanceInterval: settings.autoAdvanceInterval,
      loop: settings.loop,
      fit: settings.fit,
    };
    this.state.mode = "image";
    this.notifyStateChange();

    if (settings.autoAdvance) {
      this.startAutoAdvanceTimer();
    }
  }

  nextImage() {
    const { image } = this.state;
    if (image.slideshowImages.length === 0) return;

    if (image.currentIndex < image.slideshowImages.length - 1) {
      image.currentIndex++;
    } else if (image.loop) {
      image.currentIndex = 0;
    } else {
      this.clearAutoAdvanceTimer();
      return;
    }

    image.src = image.slideshowImages[image.currentIndex].src;
    image.imageId = image.slideshowImages[image.currentIndex].imageId;
    this.notifyStateChange();
  }

  prevImage() {
    const { image } = this.state;
    if (image.slideshowImages.length === 0) return;

    if (image.currentIndex > 0) {
      image.currentIndex--;
    } else if (image.loop) {
      image.currentIndex = image.slideshowImages.length - 1;
    } else {
      return;
    }

    image.src = image.slideshowImages[image.currentIndex].src;
    image.imageId = image.slideshowImages[image.currentIndex].imageId;
    this.notifyStateChange();
  }

  goToImage(index: number) {
    const { image } = this.state;
    if (index >= 0 && index < image.slideshowImages.length) {
      image.currentIndex = index;
      image.src = image.slideshowImages[index].src;
      image.imageId = image.slideshowImages[index].imageId;
      this.notifyStateChange();
    }
  }

  setImageAutoAdvance(enabled: boolean) {
    this.state.image.autoAdvance = enabled;
    if (enabled) {
      this.startAutoAdvanceTimer();
    } else {
      this.clearAutoAdvanceTimer();
    }
    this.notifyStateChange();
  }

  setImageFit(fit: "fill" | "fit") {
    this.state.image.fit = fit;
    this.notifyStateChange();
  }

  setImageLoop(loop: boolean) {
    this.state.image.loop = loop;
    this.notifyStateChange();
  }

  setImageAutoAdvanceInterval(intervalMs: number) {
    this.state.image.autoAdvanceInterval = intervalMs;
    // Restart timer with new interval if auto-advance is active
    if (this.state.image.autoAdvance) {
      this.startAutoAdvanceTimer();
    }
    this.notifyStateChange();
  }

  private startAutoAdvanceTimer() {
    this.clearAutoAdvanceTimer();
    this.autoAdvanceTimer = setInterval(() => {
      this.nextImage();
    }, this.state.image.autoAdvanceInterval);
  }

  private clearAutoAdvanceTimer() {
    if (this.autoAdvanceTimer) {
      clearInterval(this.autoAdvanceTimer);
      this.autoAdvanceTimer = null;
    }
  }
}
