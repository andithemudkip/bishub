import { useEffect, useCallback, useState } from "react";
import type { UpdateStatus } from "../shared/types";
import { getTranslations } from "../shared/i18n";
import UpdateBanner from "./components/UpdateBanner";
import Layout from "./components/Layout";
import HymnsPage from "./pages/HymnsPage";
import BiblePage from "./pages/BiblePage";
import VideoLibraryPage from "./pages/VideoLibraryPage";
import AudioLibraryPage from "./pages/AudioLibraryPage";
import SettingsPage from "./pages/SettingsPage";
import { useRemoteAPI } from "./useRemoteAPI";

export default function App() {
  const api = useRemoteAPI();
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    state: "idle",
  });
  const [appVersion, setAppVersion] = useState<string>("0.0.0");
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const t = getTranslations(api.settings.language);

  // Load app version and listen for update events
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getAppVersion?.().then(setAppVersion);

      const cleanup = window.electronAPI.onUpdateStatus?.(
        (status: UpdateStatus) => {
          setUpdateStatus(status);
          // Show banner again when update is ready
          if (status.state === "ready") {
            setBannerDismissed(false);
          }
        }
      );

      return cleanup;
    }
  }, []);

  const handleCheckForUpdates = useCallback(() => {
    window.electronAPI?.checkForUpdates?.();
  }, []);

  const handleInstallUpdate = useCallback(() => {
    window.electronAPI?.installUpdate?.();
  }, []);

  const handleDismissBanner = useCallback(() => {
    setBannerDismissed(true);
  }, []);

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
        case "ArrowDown":
        case "PageDown":
          // Prevent scroll when presenting
          if (api.state.mode === "text") e.preventDefault();
          handleNextSlide();
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          // Prevent scroll when presenting
          if (api.state.mode === "text") e.preventDefault();
          api.prevSlide();
          break;
        case "Escape":
          api.goIdle();
          break;
        case "F5":
          // TODO: focus search input
          e.preventDefault();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [api.state]);

  const handleGoIdle = useCallback(() => {
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
            isIdle={api.state.mode === "idle"}
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
            videoVolume={api.state.video.volume}
            audioVolume={api.state.audio.volume}
            onSetLanguage={api.setLanguage}
            onSetWallpaper={api.setIdleWallpaper}
            onSetClockFontSize={api.setClockFontSize}
            onSetClockPosition={api.setClockPosition}
            onSetAudioWidgetPosition={api.setAudioWidgetPosition}
            onSetVolume={api.setVolume}
            onSetAudioVolume={api.setAudioVolume}
            appVersion={appVersion}
            updateStatus={updateStatus}
            onCheckForUpdates={handleCheckForUpdates}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {!bannerDismissed && (
        <UpdateBanner
          status={updateStatus}
          t={t}
          onInstall={handleInstallUpdate}
          onDismiss={handleDismissBanner}
        />
      )}
      <Layout
        state={api.state}
        settings={api.settings}
        onGoIdle={handleGoIdle}
        onNextSlide={handleNextSlide}
        onPrevSlide={handlePrevSlide}
      >
        {renderPage}
      </Layout>
    </>
  );
}
