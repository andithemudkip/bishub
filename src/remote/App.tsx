import { useEffect, useCallback, useState } from "react";
import type { UpdateStatus } from "../shared/types";
import { getTranslations } from "../shared/i18n";
import { getApiUrl } from "../shared/utils";
import { useShortcut } from "./hooks/useShortcut";
import UpdateBanner from "./components/UpdateBanner";
import Layout from "./components/Layout";
import HymnsPage from "./pages/HymnsPage";
import BiblePage from "./pages/BiblePage";
import ImageLibraryPage from "./pages/ImageLibraryPage";
import VideoLibraryPage from "./pages/VideoLibraryPage";
import AudioLibraryPage from "./pages/AudioLibraryPage";
import TransferPage from "./pages/TransferPage";
import SettingsPage from "./pages/SettingsPage";
import AccessDeniedPage from "./pages/AccessDeniedPage";
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
    } else {
      fetch(getApiUrl("/api/version"))
        .then((res) => res.json())
        .then((data) => setAppVersion(data.version))
        .catch(() => {});
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
  useShortcut(
    "nextSlide",
    (e) => {
      if (api.state.mode === "text" || api.state.mode === "image") e.preventDefault();
      if (api.state.mode === "image") {
        api.nextImage();
      } else {
        handleNextSlide();
      }
    }
  );

  useShortcut(
    "prevSlide",
    (e) => {
      if (api.state.mode === "text" || api.state.mode === "image") e.preventDefault();
      if (api.state.mode === "image") {
        api.prevImage();
      } else {
        api.prevSlide();
      }
    }
  );

  useShortcut("goIdle", () => api.goIdle());

  useShortcut("focusSearch", (e) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent("focusSearch"));
  });

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

  type Page = "hymns" | "bible" | "images" | "video" | "audio" | "transfer" | "settings";

  const renderPage = (page: Page, navigateTo: (page: Page) => void) => {
    switch (page) {
      case "hymns":
        return (
          <HymnsPage
            textState={api.state.text}
            isTextMode={api.state.mode === "text"}
            hymns={api.hymns}
            onLoadHymn={api.loadHymn}
            settings={api.settings}
            audioState={api.state.audio}
            onPlayAudio={api.playAudio}
            onPauseAudio={api.pauseAudio}
            onSeekAudio={api.seekAudio}
            mp3Downloads={api.mp3Downloads}
            mp3CacheStats={api.mp3CacheStats}
            onDownloadHymnMP3={api.downloadHymnMP3}
            onDismissKaraokeBanner={() => api.setKaraokeBannerDismissed(true)}
            onOpenKaraokeSettings={() => navigateTo("settings")}
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
            searchBibleVerses={api.searchBibleVerses}
            goToSlide={api.goToSlide}
            settings={api.settings}
          />
        );
      case "images":
        return (
          <ImageLibraryPage
            imageState={api.state.image}
            loadImage={api.loadImage}
            loadSlideshow={api.loadSlideshow}
            setImageAutoAdvance={api.setImageAutoAdvance}
            setImageFit={api.setImageFit}
            setImageLoop={api.setImageLoop}
            setImageAutoAdvanceInterval={api.setImageAutoAdvanceInterval}
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
      case "transfer":
        return <TransferPage settings={api.settings} />;
      case "settings":
        return (
          <SettingsPage
            monitors={api.monitors}
            settings={api.settings}
            idleState={api.state.idle}
            videoVolume={api.state.video.volume}
            audioVolume={api.state.audio.volume}
            onSetLanguage={api.setLanguage}
            onSetBibleTranslation={api.setBibleTranslation}
            bibleDownloadStatus={api.bibleDownloadStatus}
            downloadedTranslations={api.downloadedTranslations}
            onSetWallpaper={api.setIdleWallpaper}
            onSetClockFontSize={api.setClockFontSize}
            onSetClockPosition={api.setClockPosition}
            onSetAudioWidgetPosition={api.setAudioWidgetPosition}
            onSetVolume={api.setVolume}
            onSetAudioVolume={api.setAudioVolume}
            onSetSyncedLyrics={api.setSyncedLyrics}
            appVersion={appVersion}
            updateStatus={updateStatus}
            onCheckForUpdates={handleCheckForUpdates}
            mp3CacheStats={api.mp3CacheStats}
            mp3Downloads={api.mp3Downloads}
            onDownloadAllHymnMP3s={api.downloadAllHymnMP3s}
            onCancelAllHymnMP3Downloads={api.cancelAllHymnMP3Downloads}
            onClearHymnMP3Cache={api.clearHymnMP3Cache}
          />
        );
      default:
        return null;
    }
  };

  if (api.authError) {
    return <AccessDeniedPage failed={api.authFailed} onConnect={api.reconnectWithKey} />;
  }

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
        onNextImage={api.nextImage}
        onPrevImage={api.prevImage}
        onSetImageFit={api.setImageFit}
      >
        {renderPage}
      </Layout>
    </>
  );
}
