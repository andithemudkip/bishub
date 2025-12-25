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
import VideoLibraryPage from "./pages/VideoLibraryPage";
import AudioLibraryPage from "./pages/AudioLibraryPage";
import SettingsPage from "./pages/SettingsPage";
import { useRemoteAPI } from "./useRemoteAPI";
import type {
  VideoItem,
  DownloadProgress,
  UploadProgress,
} from "../shared/videoLibrary.types";
import type {
  AudioItem,
  AudioUploadProgress,
} from "../shared/audioLibrary.types";

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
      setLanguage: (language: string) => Promise<void>;
      goIdle: () => Promise<void>;
      // Idle screen settings
      setIdleWallpaper: (selectNew?: boolean) => Promise<string | null>;
      setClockFontSize: (size: number) => Promise<void>;
      setClockPosition: (position: string) => Promise<void>;
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
      // Video Library
      getVideoLibrary: () => Promise<VideoItem[]>;
      addLocalVideo: () => Promise<VideoItem | null>;
      deleteVideo: (videoId: string) => Promise<boolean>;
      renameVideo: (
        videoId: string,
        newName: string
      ) => Promise<VideoItem | null>;
      downloadYouTubeVideo: (url: string) => Promise<DownloadProgress>;
      cancelYouTubeDownload: (downloadId: string) => Promise<boolean>;
      getActiveDownloads: () => Promise<DownloadProgress[]>;
      getVideoThumbnail: (videoId: string) => Promise<string | null>;
      onVideoLibraryUpdate: (
        callback: (videos: VideoItem[]) => void
      ) => () => void;
      onDownloadProgress: (
        callback: (progress: DownloadProgress) => void
      ) => () => void;
      onUploadProgress: (
        callback: (progress: UploadProgress) => void
      ) => () => void;
      // Audio Library
      getAudioLibrary: () => Promise<AudioItem[]>;
      addLocalAudio: () => Promise<AudioItem | null>;
      deleteAudio: (audioId: string) => Promise<boolean>;
      renameAudio: (
        audioId: string,
        newName: string
      ) => Promise<AudioItem | null>;
      loadAudio: (src: string, name: string) => Promise<void>;
      playAudio: () => Promise<void>;
      pauseAudio: () => Promise<void>;
      stopAudio: () => Promise<void>;
      seekAudio: (time: number) => Promise<void>;
      setAudioVolume: (volume: number) => Promise<void>;
      setAudioWidgetPosition: (position: string) => Promise<void>;
      onAudioLibraryUpdate: (
        callback: (audios: AudioItem[]) => void
      ) => () => void;
      onAudioUploadProgress: (
        callback: (progress: AudioUploadProgress) => void
      ) => () => void;
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
        case "PageDown":
          // Prevent scroll when presenting
          if (api.state.mode === "text") e.preventDefault();
          handleNextSlide();
          break;
        case "ArrowLeft":
        case "PageUp":
          // Prevent scroll when presenting
          if (api.state.mode === "text") e.preventDefault();
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

  const renderPage = (
    page: "hymns" | "bible" | "video" | "audio" | "settings"
  ) => {
    switch (page) {
      case "hymns":
        return (
          <HymnsPage
            textState={api.state.text}
            hymns={api.hymns}
            onLoadHymn={api.loadHymn}
            settings={api.settings}
          />
        );
      case "bible":
        return (
          <BiblePage
            textState={api.state.text}
            getBibleBooks={api.getBibleBooks}
            getBibleChapter={api.getBibleChapter}
            loadBibleVerses={api.loadBibleVerses}
            goToSlide={api.goToSlide}
            settings={api.settings}
          />
        );
      case "video":
        return (
          <VideoLibraryPage
            videoState={api.state.video}
            loadVideo={api.loadVideo}
            playVideo={api.playVideo}
            pauseVideo={api.pauseVideo}
            stopVideo={api.stopVideo}
            seekVideo={api.seekVideo}
            setVolume={api.setVolume}
            settings={api.settings}
          />
        );
      case "audio":
        return (
          <AudioLibraryPage
            audioState={api.state.audio}
            loadAudio={api.loadAudio}
            playAudio={api.playAudio}
            pauseAudio={api.pauseAudio}
            stopAudio={api.stopAudio}
            seekAudio={api.seekAudio}
            setAudioVolume={api.setAudioVolume}
            settings={api.settings}
          />
        );
      case "settings":
        return (
          <SettingsPage
            monitors={api.monitors}
            settings={api.settings}
            idleState={api.state.idle}
            onSetLanguage={api.setLanguage}
            onSetWallpaper={api.setIdleWallpaper}
            onSetClockFontSize={api.setClockFontSize}
            onSetClockPosition={api.setClockPosition}
            onSetAudioWidgetPosition={api.setAudioWidgetPosition}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Layout
      state={api.state}
      settings={api.settings}
      onGoIdle={handleGoIdle}
      onNextSlide={handleNextSlide}
      onPrevSlide={handlePrevSlide}
    >
      {renderPage}
    </Layout>
  );
}
