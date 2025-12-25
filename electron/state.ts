import type { DisplayState, AppSettings, DisplayMode } from '../src/shared/types'
import { DEFAULT_STATE, DEFAULT_SETTINGS } from '../src/shared/types'

type StateChangeCallback = (state: DisplayState) => void
type SettingsChangeCallback = (settings: AppSettings) => void

export class StateManager {
  private state: DisplayState = { ...DEFAULT_STATE }
  private settings: AppSettings = { ...DEFAULT_SETTINGS }
  private stateListeners: StateChangeCallback[] = []
  private settingsListeners: SettingsChangeCallback[] = []

  getState(): DisplayState {
    return { ...this.state }
  }

  getSettings(): AppSettings {
    return { ...this.settings }
  }

  onStateChange(callback: StateChangeCallback) {
    this.stateListeners.push(callback)
    return () => {
      this.stateListeners = this.stateListeners.filter((cb) => cb !== callback)
    }
  }

  onSettingsChange(callback: SettingsChangeCallback) {
    this.settingsListeners.push(callback)
    return () => {
      this.settingsListeners = this.settingsListeners.filter((cb) => cb !== callback)
    }
  }

  private notifyStateChange() {
    const stateCopy = this.getState()
    this.stateListeners.forEach((cb) => cb(stateCopy))
  }

  private notifySettingsChange() {
    const settingsCopy = this.getSettings()
    this.settingsListeners.forEach((cb) => cb(settingsCopy))
  }

  // Mode control
  setMode(mode: DisplayMode) {
    this.state.mode = mode
    this.notifyStateChange()
  }

  goIdle() {
    this.state.mode = 'idle'
    this.state.video.playing = false
    this.notifyStateChange()
  }

  // Text mode
  loadText(title: string, content: string) {
    // Split content into slides by double newlines or --- markers
    const slides = content
      .split(/\n\n+|---+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    this.state.text = {
      title,
      slides,
      currentSlide: 0,
    }
    this.state.mode = 'text'
    this.notifyStateChange()
  }

  nextSlide() {
    if (this.state.text.currentSlide < this.state.text.slides.length - 1) {
      this.state.text.currentSlide++
      this.notifyStateChange()
    }
  }

  prevSlide() {
    if (this.state.text.currentSlide > 0) {
      this.state.text.currentSlide--
      this.notifyStateChange()
    }
  }

  goToSlide(index: number) {
    if (index >= 0 && index < this.state.text.slides.length) {
      this.state.text.currentSlide = index
      this.notifyStateChange()
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
    }
    this.state.mode = 'video'
    this.notifyStateChange()
  }

  playVideo() {
    this.state.video.playing = true
    this.notifyStateChange()
  }

  pauseVideo() {
    this.state.video.playing = false
    this.notifyStateChange()
  }

  stopVideo() {
    this.state.video.playing = false
    this.state.video.currentTime = 0
    this.notifyStateChange()
  }

  seekVideo(time: number) {
    this.state.video.currentTime = time
    this.notifyStateChange()
  }

  setVolume(volume: number) {
    this.state.video.volume = Math.max(0, Math.min(1, volume))
    this.notifyStateChange()
  }

  updateVideoTime(time: number, duration: number) {
    this.state.video.currentTime = time
    this.state.video.duration = duration
    this.notifyStateChange()
  }

  // Settings
  setDisplayMonitor(monitorId: number) {
    this.settings.displayMonitor = monitorId
    this.notifySettingsChange()
  }

  setServerPort(port: number) {
    this.settings.serverPort = port
    this.notifySettingsChange()
  }
}
