import { useState } from "react";
import type { AppSettings, VideoState } from "../../shared/types";
import type { VideoItem } from "../../shared/videoLibrary.types";
import { useVideoLibrary } from "../useVideoLibrary";
import VideoLibraryList from "../components/VideoLibraryList";
import YouTubeDownloader from "../components/YouTubeDownloader";
import MediaUploader from "../components/MediaUploader";
import StickyPlaybackBar from "../components/StickyPlaybackBar";
import { getTranslations } from "@shared/i18n";
import { formatFileSize } from "@shared/utils";
import { Card } from "../components/ui/Card";
import { renderTip } from "../components/ui/renderTip";

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

  return (
    <div className="min-w-0 max-w-2xl mx-auto w-full min-h-full flex flex-col">
      <div className="space-y-4 sm:space-y-6 mb-4">
        {/* Add video section */}
        <Card compact tip={renderTip(t.videoLibrary.addTip)}>
          {/* Tabs */}
          <div className={`flex items-center bg-gray-900/50 border border-gray-700/50 rounded-lg overflow-hidden mr-8 ${activeTab !== "library" ? "mb-4" : ""}`}>
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
                <span>
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
              <span>
                {t.videoLibrary.youtube}
              </span>
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
                <span>
                  {t.videoLibrary.upload}
                </span>
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
              uploadUrl="/api/videos/upload"
              uploadFieldName="video"
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
            {library.videos.length > 0 && (
              <span className="text-xs sm:text-sm font-normal text-gray-500 ml-2">
                {formatFileSize(library.videos.reduce((sum, v) => sum + v.fileSize, 0))}
              </span>
            )}
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
      </div>

      {/* Sticky playback controls */}
      {videoState.src && (
        <StickyPlaybackBar
          trackName={videoState.src.split("/").pop() || ""}
          isPlaying={videoState.playing}
          currentTime={videoState.currentTime}
          duration={videoState.duration}
          volume={videoState.volume}
          onPlay={playVideo}
          onPause={pauseVideo}
          onStop={stopVideo}
          onSeek={seekVideo}
          onVolumeChange={setVolume}
          labels={{
            nowPlaying: t.videoLibrary.nowPlaying,
            play: t.videoLibrary.play,
            pause: t.videoLibrary.pause,
            stop: t.videoLibrary.stop,
            volume: t.videoLibrary.volume,
          }}
        />
      )}
    </div>
  );
}
