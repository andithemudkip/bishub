import type {
  DisplayState,
  AppSettings,
  DisplayMode,
  ClockPosition,
  AudioWidgetPosition,
  TextContentType,
  BibleContext,
} from "../src/shared/types";
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
  audioVolume: number;
}

export class StateManager {
  private state: DisplayState;
  private settings: AppSettings;
  private stateListeners: StateChangeCallback[] = [];
  private settingsListeners: SettingsChangeCallback[] = [];
  private settingsStore: Store<SettingsSchema>;
  private securityKey: string;

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
        audioVolume: 1,
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
      this.state.idle.audioWidgetPosition = idleSettings.audioWidgetPosition ?? "bottom-right";
    }

    // Initialize video volume from persisted settings (with fallback)
    this.state.video.volume = this.settings.volume ?? 1;

    // Initialize audio volume from persisted settings
    this.state.audio.volume = this.settingsStore.get("audioVolume", 1);
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

  // Mode control
  setMode(mode: DisplayMode) {
    // Stop audio when leaving idle mode
    if (mode !== "idle" && this.state.audio.playing) {
      this.stopAudio();
    }
    this.state.mode = mode;
    this.notifyStateChange();
  }

  goIdle() {
    this.state.mode = "idle";
    this.state.video.playing = false;
    this.notifyStateChange();
  }

  // Text mode
  loadText(
    title: string,
    content: string,
    contentType: TextContentType = "custom"
  ) {
    // Split content into slides by double newlines or --- markers
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

  nextSlide() {
    if (this.state.text.currentSlide < this.state.text.slides.length - 1) {
      this.state.text.currentSlide++;
      this.notifyStateChange();
    }
  }

  prevSlide() {
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
  loadVideo(src: string) {
    this.state.video = {
      src,
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
    this.state.video.playing = false;
    this.state.video.currentTime = 0;
    this.notifyStateChange();
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
    this.notifyStateChange();
  }

  seekAudio(time: number) {
    this.state.audio.currentTime = time;
    this.notifyStateChange();
  }

  setAudioVolume(volume: number) {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.state.audio.volume = clampedVolume;
    this.settingsStore.set("audioVolume", clampedVolume);
    this.notifyStateChange();
  }

  updateAudioTime(time: number, duration: number) {
    this.state.audio.currentTime = time;
    this.state.audio.duration = duration;
    this.notifyStateChange();
  }

  setAudioWidgetPosition(position: AudioWidgetPosition) {
    this.state.idle.audioWidgetPosition = position;
    this.persistIdleSettings();
    this.notifyStateChange();
  }
}
