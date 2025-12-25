import { useEffect, useCallback } from "react";
import type {
  DisplayState,
  AppSettings,
  MonitorInfo,
  Hymn,
  BibleVerse,
} from "../shared/types";
import Layout from "./components/Layout";
import HymnsPage from "./pages/HymnsPage";
import BiblePage from "./pages/BiblePage";
import VideoPage from "./pages/VideoPage";
import SettingsPage from "./pages/SettingsPage";
import { useRemoteAPI } from "./useRemoteAPI";

declare global {
  interface Window {
    electronAPI?: {
      getState: () => Promise<DisplayState>;
      getSettings: () => Promise<AppSettings>;
      getMonitors: () => Promise<MonitorInfo[]>;
      onStateUpdate: (callback: (state: DisplayState) => void) => () => void;
      onSettingsUpdate: (
        callback: (settings: AppSettings) => void
      ) => () => void;
      setMode: (mode: "idle" | "text" | "video") => Promise<void>;
      loadText: (title: string, content: string) => Promise<void>;
      nextSlide: () => Promise<void>;
      prevSlide: () => Promise<void>;
      goToSlide: (index: number) => Promise<void>;
      loadVideo: (src: string) => Promise<void>;
      playVideo: () => Promise<void>;
      pauseVideo: () => Promise<void>;
      stopVideo: () => Promise<void>;
      seekVideo: (time: number) => Promise<void>;
      setVolume: (volume: number) => Promise<void>;
      setDisplayMonitor: (monitorId: number) => Promise<void>;
      goIdle: () => Promise<void>;
      openFileDialog: (
        filters: { name: string; extensions: string[] }[]
      ) => Promise<string | null>;
      // Hymns
      getHymns: () => Promise<Hymn[]>;
      searchHymns: (query: string) => Promise<Hymn[]>;
      loadHymn: (hymnNumber: string) => Promise<void>;
      // Bible
      getBibleBooks: () => Promise<
        { id: string; name: string; chapterCount: number }[]
      >;
      getBibleChapter: (
        bookId: string,
        chapter: number
      ) => Promise<BibleVerse[]>;
      loadBibleVerses: (
        bookId: string,
        bookName: string,
        chapter: number,
        startVerse: number,
        endVerse?: number
      ) => Promise<void>;
    };
  }
}

export default function App() {
  const api = useRemoteAPI();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return; // Don't handle shortcuts when typing in inputs
      }

      switch (e.key) {
        case "ArrowRight":
          handleNextSlide();
          break;
        case "ArrowLeft":
          api.prevSlide();
          break;
        case "Escape":
          api.goIdle();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [api.state]);

  const handleGoIdle = useCallback(() => {
    api.loadText("", "");
    api.goIdle();
  }, [api]);

  const handleNextSlide = useCallback(() => {
    // If on last slide, go to idle
    if (
      api.state.mode === "text" &&
      api.state.text.currentSlide >= api.state.text.slides.length - 1
    ) {
      // clear text before going idle to avoid showing last slide briefly
      api.loadText("", "");
      api.goIdle();
    } else {
      api.nextSlide();
    }
  }, [api]);

  const handlePrevSlide = useCallback(() => {
    api.prevSlide();
  }, [api]);

  const renderPage = (page: "hymns" | "bible" | "video" | "settings") => {
    switch (page) {
      case "hymns":
        return (
          <HymnsPage
            textState={api.state.text}
            hymns={api.hymns}
            onLoadHymn={api.loadHymn}
          />
        );
      case "bible":
        return (
          <BiblePage
            textState={api.state.text}
            getBibleBooks={api.getBibleBooks}
            getBibleChapter={api.getBibleChapter}
            loadBibleVerses={api.loadBibleVerses}
          />
        );
      case "video":
        return <VideoPage videoState={api.state.video} />;
      case "settings":
        return <SettingsPage monitors={api.monitors} settings={api.settings} />;
      default:
        return null;
    }
  };

  return (
    <Layout
      state={api.state}
      onGoIdle={handleGoIdle}
      onNextSlide={handleNextSlide}
      onPrevSlide={handlePrevSlide}
    >
      {renderPage}
    </Layout>
  );
}
