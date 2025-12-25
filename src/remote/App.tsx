import { useEffect, useState, useCallback } from 'react'
import type { DisplayState, AppSettings, MonitorInfo, Hymn, BibleVerse } from '../shared/types'
import { DEFAULT_STATE, DEFAULT_SETTINGS } from '../shared/types'
import Layout from './components/Layout'
import HymnsPage from './pages/HymnsPage'
import BiblePage from './pages/BiblePage'
import VideoPage from './pages/VideoPage'
import SettingsPage from './pages/SettingsPage'

declare global {
  interface Window {
    electronAPI?: {
      getState: () => Promise<DisplayState>
      getSettings: () => Promise<AppSettings>
      getMonitors: () => Promise<MonitorInfo[]>
      onStateUpdate: (callback: (state: DisplayState) => void) => () => void
      onSettingsUpdate: (callback: (settings: AppSettings) => void) => () => void
      setMode: (mode: 'idle' | 'text' | 'video') => Promise<void>
      loadText: (title: string, content: string) => Promise<void>
      nextSlide: () => Promise<void>
      prevSlide: () => Promise<void>
      goToSlide: (index: number) => Promise<void>
      loadVideo: (src: string) => Promise<void>
      playVideo: () => Promise<void>
      pauseVideo: () => Promise<void>
      stopVideo: () => Promise<void>
      seekVideo: (time: number) => Promise<void>
      setVolume: (volume: number) => Promise<void>
      setDisplayMonitor: (monitorId: number) => Promise<void>
      goIdle: () => Promise<void>
      openFileDialog: (filters: { name: string; extensions: string[] }[]) => Promise<string | null>
      // Hymns
      getHymns: () => Promise<Hymn[]>
      searchHymns: (query: string) => Promise<Hymn[]>
      loadHymn: (hymnNumber: string) => Promise<void>
      // Bible
      getBibleBooks: () => Promise<{ id: string; name: string; chapterCount: number }[]>
      getBibleChapter: (bookId: string, chapter: number) => Promise<BibleVerse[]>
      loadBibleVerses: (bookId: string, bookName: string, chapter: number, startVerse: number, endVerse?: number) => Promise<void>
    }
  }
}

export default function App() {
  const [state, setState] = useState<DisplayState>(DEFAULT_STATE)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [monitors, setMonitors] = useState<MonitorInfo[]>([])

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getState().then(setState)
      window.electronAPI.getSettings().then(setSettings)
      window.electronAPI.getMonitors().then(setMonitors)

      const unsubState = window.electronAPI.onStateUpdate(setState)
      const unsubSettings = window.electronAPI.onSettingsUpdate(setSettings)

      return () => {
        unsubState()
        unsubSettings()
      }
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        return // Don't handle shortcuts when typing in inputs
      }

      switch (e.key) {
        case 'ArrowRight':
          handleNextSlide()
          break
        case 'ArrowLeft':
          window.electronAPI?.prevSlide()
          break
        case 'Escape':
          window.electronAPI?.goIdle()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state])

  const handleGoIdle = useCallback(() => {
    window.electronAPI?.goIdle()
  }, [])

  const handleNextSlide = useCallback(() => {
    // If on last slide, go to idle
    if (state.mode === 'text' && state.text.currentSlide >= state.text.slides.length - 1) {
      // clear text before going idle to avoid showing last slide briefly
      window.electronAPI?.loadText('', '')

      window.electronAPI?.goIdle()
    } else {
      window.electronAPI?.nextSlide()
    }
  }, [state])

  const handlePrevSlide = useCallback(() => {
    window.electronAPI?.prevSlide()
  }, [])

  const renderPage = (page: 'hymns' | 'bible' | 'video' | 'settings') => {
    switch (page) {
      case 'hymns':
        return <HymnsPage textState={state.text} />
      case 'bible':
        return <BiblePage textState={state.text} />
      case 'video':
        return <VideoPage videoState={state.video} />
      case 'settings':
        return <SettingsPage monitors={monitors} settings={settings} />
      default:
        return null
    }
  }

  return (
    <Layout
      state={state}
      onGoIdle={handleGoIdle}
      onNextSlide={handleNextSlide}
      onPrevSlide={handlePrevSlide}
    >
      {renderPage}
    </Layout>
  )
}
