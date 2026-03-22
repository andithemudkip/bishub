import { useState } from "react";
import type { AppSettings, VideoState } from "../../shared/types";
import type { VideoItem } from "../../shared/videoLibrary.types";
import { useVideoLibrary } from "../useVideoLibrary";
import VideoLibraryList from "../components/VideoLibraryList";
import YouTubeDownloader from "../components/YouTubeDownloader";
import MediaUploader from "../components/MediaUploader";
import { getTranslations } from "@shared/i18n";
import { Card } from "../components/ui/Card";
import { formatDuration } from "@shared/utils";

interface Props {
  videoState: VideoState;
  loadVideo: (src: string, videoId?: string) => void;
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
    "library",
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

  return (
    <div className="space-y-6 min-w-0 max-w-full">
      {/* Add video section */}
      <Card compact>
        {/* Tabs */}
        <div className="flex items-center bg-gray-900/50 border border-gray-700/50 rounded-lg overflow-hidden mb-4">
          {library.isElectron && (
            <button
              onClick={() => library.addLocalVideo()}
              className="px-3 py-2.5 sm:px-4 hover:bg-gray-700 active:bg-gray-600 transition-colors flex items-center gap-2 text-sm text-gray-300"
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
                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span className="hidden sm:inline">
                {t.videoLibrary.addLocalFile}
              </span>
            </button>
          )}
          <button
            onClick={() =>
              setActiveTab(activeTab === "youtube" ? "library" : "youtube")
            }
            className={`px-3 py-2.5 sm:px-4 transition-colors flex items-center gap-2 text-sm ${
              activeTab === "youtube"
                ? "bg-gray-700 text-red-400"
                : "text-gray-300 hover:bg-gray-700"
            }`}
          >
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
            </svg>
            <span className="hidden sm:inline">{t.videoLibrary.youtube}</span>
          </button>
          {!library.isElectron && (
            <button
              onClick={() =>
                setActiveTab(activeTab === "upload" ? "library" : "upload")
              }
              className={`px-3 py-2.5 sm:px-4 transition-colors flex items-center gap-2 text-sm ${
                activeTab === "upload"
                  ? "bg-gray-700 text-blue-400"
                  : "text-gray-300 hover:bg-gray-700"
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
              <span className="hidden xs:inline">{t.videoLibrary.upload}</span>
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
          <MediaUploader
            onUpload={library.uploadVideo}
            activeUploads={library.uploads}
            allowedExtensions={[".mp4", ".webm", ".mov", ".avi", ".mkv"]}
            maxSizeBytes={1024 * 1024 * 1024}
            labels={{
              uploading: t.videoLibrary.uploading,
              uploadDrop: t.videoLibrary.uploadDrop,
              uploadHint: t.videoLibrary.uploadHint,
              processing: t.videoLibrary.processing,
              complete: t.videoLibrary.complete,
              invalidType: t.videoLibrary.invalidType,
              tooLarge: t.videoLibrary.tooLarge,
              uploadFailed: t.videoLibrary.uploadFailed,
            }}
          />
        )}
      </Card>

      {/* Video library */}
      <Card compact className="overflow-hidden">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
          {t.videoLibrary.library} ({library.videos.length})
        </h3>
        <VideoLibraryList
          videos={library.videos}
          selectedVideoId={selectedVideoId}
          onSelect={handleSelectVideo}
          onDelete={library.deleteVideo}
          onRename={library.renameVideo}
          onOpenFileLocation={(filePath) =>
            window.electronAPI?.showItemInFolder(filePath)
          }
          t={t}
        />
      </Card>

      {/* Video controls - only show when video is loaded */}
      {videoState.src && (
        <Card className="space-y-4 sm:space-y-6">
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
            <div className="flex-1 flex items-center bg-gray-900/50 border border-gray-700/50 rounded-lg overflow-hidden">
              {videoState.playing ? (
                <button
                  onClick={pauseVideo}
                  className="flex-1 py-3 sm:py-3.5 hover:bg-gray-700 active:bg-gray-600 transition-colors flex items-center justify-center gap-2 text-yellow-400"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                  <span className="hidden xs:inline text-sm font-medium">{t.videoLibrary.pause}</span>
                </button>
              ) : (
                <button
                  onClick={playVideo}
                  className="flex-1 py-3 sm:py-3.5 hover:bg-gray-700 active:bg-gray-600 transition-colors flex items-center justify-center gap-2 text-green-400"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span className="hidden xs:inline text-sm font-medium">{t.videoLibrary.play}</span>
                </button>
              )}
            </div>
            <button
              onClick={stopVideo}
              className="px-4 py-3 sm:py-3.5 rounded-lg flex items-center gap-2 flex-shrink-0 bg-red-600/20 text-red-400 hover:bg-red-600/30 active:bg-red-600/40 border border-red-600/40 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h12v12H6z" />
              </svg>
              <span className="hidden xs:inline text-sm font-medium">{t.videoLibrary.stop}</span>
            </button>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs sm:text-sm text-gray-400 mb-2">
              <span>{formatDuration(videoState.currentTime)}</span>
              <span>{formatDuration(videoState.duration)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={videoState.duration || 100}
              value={videoState.currentTime}
              onChange={handleSeek}
              className="w-full"
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
                className="flex-1"
              />
              <span className="w-10 sm:w-12 text-right text-gray-400 text-xs sm:text-sm">
                {Math.round(videoState.volume * 100)}%
              </span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
