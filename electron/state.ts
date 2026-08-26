import type {
  DisplayState,
  AppSettings,
  DisplayMode,
  ClockPosition,
  AudioWidgetPosition,
  TextContentType,
  HymnRef,
  BibleContext,
  ChromeSizeKey,
} from "../src/shared/types";
import type { ParsedTTML } from "../src/shared/ttmlParser";
import { buildScreenGroups, getActiveScreen } from "../src/shared/ttmlParser";
import type { Language } from "../src/shared/i18n";
import { DEFAULT_STATE, DEFAULT_SETTINGS } from "../src/shared/types";
import { CHROME_SIZE_MIN, CHROME_SIZE_MAX } from "../src/shared/utils";
import {
  normalizeHex,
  DEFAULT_SLIDE_BACKGROUND,
  DEFAULT_BIBLE_BACKGROUND,
} from "../src/shared/slideTheme";
import type { QueueTrack, AudioQueueState } from "../src/shared/audioPlaylist.types";
import { getAudioLibrary } from "./audioLibrary";
import { getAudioPlaylists } from "./audioPlaylists";
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
      audio: { ...DEFAULT_STATE.audio, queue: this.emptyQueue() },
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
      queue: this.emptyQueue(),
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
      queue: this.emptyQueue(),
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

  /** Size of one display chrome element (title / slide counter / slide dots), in %. */
  setChromeSize(key: ChromeSizeKey, size: number) {
    this.settings[key] = Math.max(
      CHROME_SIZE_MIN,
      Math.min(CHROME_SIZE_MAX, Math.round(size)),
    );
    this.notifySettingsChange();
  }

  /** Gradient behind text/karaoke slides. Hex is validated here because it
   * arrives from a colour input, a web remote, or an older persisted config. */
  setSlideBackground(from: string, to: string) {
    this.settings.slideBackgroundFrom = normalizeHex(
      from,
      DEFAULT_SLIDE_BACKGROUND.from,
    );
    this.settings.slideBackgroundTo = normalizeHex(
      to,
      DEFAULT_SLIDE_BACKGROUND.to,
    );
    this.notifySettingsChange();
  }

  /** Optional separate gradient for Bible slides. */
  setBibleBackground(enabled: boolean, from: string, to: string) {
    this.settings.bibleBackgroundEnabled = enabled;
    this.settings.bibleBackgroundFrom = normalizeHex(
      from,
      DEFAULT_BIBLE_BACKGROUND.from,
    );
    this.settings.bibleBackgroundTo = normalizeHex(
      to,
      DEFAULT_BIBLE_BACKGROUND.to,
    );
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
    // Tapping a library row means "play this now" — the queue, if any, is
    // abandoned rather than silently continued.
    this.state.audio = {
      src,
      name,
      playing: false,
      currentTime: 0,
      duration: 0,
      volume: this.state.audio.volume,
      role: "background",
      queue: this.emptyQueue(),
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
    // Queue is intentionally left intact — pausing is not abandoning it.
    this.state.audio.playing = false;
    this.notifyStateChange();
  }

  stopAudio() {
    this.state.audio.playing = false;
    this.state.audio.currentTime = 0;
    this.state.audio.src = null;
    this.state.audio.name = null;
    this.state.audio.role = "background";
    this.state.audio.queue = this.emptyQueue();
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

  /**
   * Fired by the display's native <audio> "ended" event — a separate signal
   * from updateAudioTime()'s time-threshold `finished` detection, which is
   * fragile and must not grow a queue branch (would double-fire). The
   * syncedLyrics/hymn branches below just replicate updateAudioTime()'s
   * existing behavior so this handler is idempotent alongside it; queue
   * playback is always role "background" with no syncedLyrics, so those
   * branches and the queue branch can never both apply to the same track.
   */
  handleAudioEnded() {
    if (this.state.text.syncedLyrics) {
      this.goIdle();
      return;
    }
    if (this.state.audio.role === "hymn") {
      this.state.audio.playing = false;
      this.notifyStateChange();
      return;
    }
    if (
      this.state.audio.queue.source !== null &&
      this.state.audio.queue.tracks.length > 0
    ) {
      this.nextTrack();
      return;
    }
    this.state.audio.playing = false;
    this.notifyStateChange();
  }

  private emptyQueue(): AudioQueueState {
    return {
      source: null,
      playlistId: null,
      name: null,
      tracks: [],
      index: 0,
      loop: false,
    };
  }

  /** Resolves audioIds to playable QueueTrack snapshots, dropping ids that no longer exist. */
  resolveQueueTracks(audioIds: string[]): QueueTrack[] {
    const library = getAudioLibrary();
    const tracks: QueueTrack[] = [];
    for (const audioId of audioIds) {
      const item = library.getById(audioId);
      if (item) {
        tracks.push({
          audioId: item.id,
          src: item.path,
          name: item.name,
          duration: item.duration,
        });
      }
    }
    return tracks;
  }

  /** Sets the live audio src/name/transport for the track at `index` in the current queue, without touching the queue itself. */
  private loadQueueTrack(index: number, autoplay = true) {
    const track = this.state.audio.queue.tracks[index];
    if (!track) return;

    this.state.audio.queue.index = index;
    this.state.audio.src = track.src;
    this.state.audio.name = track.name;
    this.state.audio.currentTime = 0;
    this.state.audio.duration = 0;
    this.state.audio.playing = autoplay;
    this.state.audio.role = "background";
    if (this.state.mode !== "idle") {
      this.state.mode = "idle";
    }
    this.notifyStateChange();
  }

  playPlaylist(playlistId: string, startIndex = 0) {
    const playlist = getAudioPlaylists().getById(playlistId);
    if (!playlist) return;
    const tracks = this.resolveQueueTracks(playlist.audioIds);
    if (tracks.length === 0) return;

    const index = Math.max(0, Math.min(startIndex, tracks.length - 1));
    this.state.audio.queue = {
      source: "playlist",
      playlistId,
      name: playlist.name,
      tracks,
      index,
      loop: playlist.loop,
    };
    this.loadQueueTrack(index);
  }

  playQueue(startIndex = 0) {
    const audioIds = getAudioPlaylists().getQueue();
    const tracks = this.resolveQueueTracks(audioIds);
    if (tracks.length === 0) return;

    const index = Math.max(0, Math.min(startIndex, tracks.length - 1));
    const preserveLoop = this.state.audio.queue.source === "ephemeral";
    this.state.audio.queue = {
      source: "ephemeral",
      playlistId: null,
      name: null,
      tracks,
      index,
      loop: preserveLoop ? this.state.audio.queue.loop : false,
    };
    this.loadQueueTrack(index);
  }

  nextTrack() {
    const { queue } = this.state.audio;
    if (queue.tracks.length === 0) return;

    let nextIndex = queue.index + 1;
    if (nextIndex >= queue.tracks.length) {
      if (queue.loop) {
        nextIndex = 0;
      } else {
        // Queue finished. Rewind to the top rather than sitting on the last
        // track, so pressing Play restarts the set instead of replaying the
        // final song. Paused, so finishing never auto-restarts.
        this.loadQueueTrack(0, false);
        return;
      }
    }
    this.loadQueueTrack(nextIndex);
  }

  previousTrack() {
    const { queue, currentTime } = this.state.audio;
    if (queue.tracks.length === 0) return;

    // Standard media behavior: past a few seconds in, "previous" restarts the track.
    if (currentTime > 3) {
      this.seekAudio(0);
      return;
    }

    let prevIndex = queue.index - 1;
    if (prevIndex < 0) {
      if (queue.loop) {
        prevIndex = queue.tracks.length - 1;
      } else {
        this.seekAudio(0);
        return;
      }
    }
    this.loadQueueTrack(prevIndex);
  }

  setQueueLoop(loop: boolean) {
    this.state.audio.queue.loop = loop;
    if (this.state.audio.queue.source === "playlist" && this.state.audio.queue.playlistId) {
      getAudioPlaylists().setLoop(this.state.audio.queue.playlistId, loop);
    }
    this.notifyStateChange();
  }

  /**
   * Re-projects the live queue after the underlying source (playlist or Up
   * Next) was edited, preserving the currently playing track by audioId so
   * reordering during a live service never skips or restarts it. If the
   * playing track was removed from the source, playback continues to its end
   * — the queue snapshot keeps it alive even though it's gone from `tracks`.
   */
  syncQueueFromSource(tracks: QueueTrack[]) {
    const { queue } = this.state.audio;
    if (queue.source === null) return;

    const playingAudioId = queue.tracks[queue.index]?.audioId ?? null;
    const foundIndex = playingAudioId
      ? tracks.findIndex((t) => t.audioId === playingAudioId)
      : -1;
    const index =
      foundIndex !== -1
        ? foundIndex
        : Math.min(queue.index, Math.max(0, tracks.length - 1));

    this.state.audio.queue = { ...queue, tracks, index };
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
