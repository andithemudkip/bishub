import { useState } from "react";
import type { AppSettings, VideoState } from "../../shared/types";
import type { VideoItem } from "../../shared/videoLibrary.types";
import { useVideoLibrary } from "../useVideoLibrary";
import VideoLibraryList from "../components/VideoLibraryList";
import YouTubeDownloader from "../components/YouTubeDownloader";
import VideoUploader from "../components/VideoUploader";
import { getTranslations } from "@shared/i18n";

interface Props {
  videoState: VideoState;
  loadVideo: (src: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekVideo: (time: number) => void;
  setVolume: (volume: number) => void;
  settings: AppSettings;
}

export default function VideoLibraryPage({
  videoState,
  loadVideo,
  playVideo,
  pauseVideo,
  stopVideo,
  seekVideo,
  setVolume,
  settings,
}: Props) {
  const library = useVideoLibrary(loadVideo);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"library" | "youtube" | "upload">(
    "library"
  );

  const t = getTranslations(settings.language);

  const handleSelectVideo = (video: VideoItem) => {
    setSelectedVideoId(video.id);
    library.loadVideoToDisplay(video);
    playVideo();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seekVideo(Number(e.target.value));
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(e.target.value));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* Add video section */}
      <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {library.isElectron && (
            <button
              onClick={() => library.addLocalVideo()}
              className="px-3 py-2 sm:px-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2 text-sm sm:text-base"
            >
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
              <span>{t.videoLibrary.addLocalFile}</span>
            </button>
          )}
          <button
            onClick={() =>
              setActiveTab(activeTab === "youtube" ? "library" : "youtube")
            }
            className={`px-3 py-2 sm:px-4 rounded-lg transition-colors flex items-center gap-2 text-sm sm:text-base ${
              activeTab === "youtube"
                ? "bg-red-600 hover:bg-red-500"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
            </svg>
            {t.videoLibrary.youtube}
          </button>
          {!library.isElectron && (
            <button
              onClick={() =>
                setActiveTab(activeTab === "upload" ? "library" : "upload")
              }
              className={`px-3 py-2 sm:px-4 rounded-lg transition-colors flex items-center gap-2 text-sm sm:text-base ${
                activeTab === "upload"
                  ? "bg-blue-600 hover:bg-blue-500"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              {t.videoLibrary.upload}
            </button>
          )}
        </div>

        {/* YouTube downloader */}
        {activeTab === "youtube" && (
          <YouTubeDownloader
            onDownload={library.downloadYouTubeVideo}
            onCancel={library.cancelDownload}
            activeDownloads={library.downloads}
            t={t}
          />
        )}

        {/* File uploader (web remote only) */}
        {activeTab === "upload" && !library.isElectron && (
          <VideoUploader
            onUpload={library.uploadVideo}
            activeUploads={library.uploads}
            t={t}
          />
        )}
      </div>

      {/* Video library */}
      <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
          {t.videoLibrary.library} ({library.videos.length})
        </h3>
        <VideoLibraryList
          videos={library.videos}
          selectedVideoId={selectedVideoId}
          onSelect={handleSelectVideo}
          onDelete={library.deleteVideo}
          onRename={library.renameVideo}
          t={t}
        />
      </div>

      {/* Video controls - only show when video is loaded */}
      {videoState.src && (
        <div className="bg-gray-800 rounded-lg p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Current video */}
          <div>
            <div className="text-xs sm:text-sm text-gray-400 mb-1">
              {t.videoLibrary.nowPlaying}
            </div>
            <div className="font-semibold truncate text-sm sm:text-base">
              {videoState.src.split("/").pop()}
            </div>
          </div>

          {/* Playback controls */}
          <div className="flex gap-2 sm:gap-3">
            {videoState.playing ? (
              <button
                onClick={pauseVideo}
                className="flex-1 py-3 sm:py-4 bg-yellow-600 hover:bg-yellow-500 rounded-lg transition-colors text-base sm:text-lg font-semibold flex items-center justify-center gap-2"
              >
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
                <span className="hidden xs:inline">{t.videoLibrary.pause}</span>
              </button>
            ) : (
              <button
                onClick={playVideo}
                className="flex-1 py-3 sm:py-4 bg-green-600 hover:bg-green-500 rounded-lg transition-colors text-base sm:text-lg font-semibold flex items-center justify-center gap-2"
              >
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span className="hidden xs:inline">{t.videoLibrary.play}</span>
              </button>
            )}
            <button
              onClick={stopVideo}
              className="py-3 px-4 sm:py-4 sm:px-6 bg-red-600 hover:bg-red-500 rounded-lg transition-colors text-base sm:text-lg font-semibold flex items-center gap-2"
            >
              <svg
                className="w-5 h-5 sm:w-6 sm:h-6"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M6 6h12v12H6z" />
              </svg>
              <span className="hidden xs:inline">{t.videoLibrary.stop}</span>
            </button>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs sm:text-sm text-gray-400 mb-2">
              <span>{formatTime(videoState.currentTime)}</span>
              <span>{formatTime(videoState.duration)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={videoState.duration || 100}
              value={videoState.currentTime}
              onChange={handleSeek}
              className="w-full h-2 sm:h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Volume control */}
          <div>
            <div className="text-xs sm:text-sm text-gray-400 mb-2">
              {t.videoLibrary.volume}
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={videoState.volume}
                onChange={handleVolume}
                className="flex-1 h-2 sm:h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="w-10 sm:w-12 text-right text-gray-400 text-xs sm:text-sm">
                {Math.round(videoState.volume * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
