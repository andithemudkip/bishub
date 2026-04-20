import { useMemo, useState } from "react";
import type { AppSettings, AudioState } from "../../shared/types";
import type { AudioItem } from "../../shared/audioLibrary.types";
import { useAudioLibrary } from "../useAudioLibrary";
import { useAudioScheduler } from "../useAudioScheduler";
import AudioLibraryList from "../components/AudioLibraryList";
import MediaUploader from "../components/MediaUploader";
import YouTubeDownloader from "../components/YouTubeDownloader";
import AudioScheduleSection from "../components/AudioScheduleSection";
import StickyPlaybackBar from "../components/StickyPlaybackBar";
import { getTranslations } from "@shared/i18n";
import { formatFileSize } from "@shared/utils";
import { Card } from "../components/ui/Card";
import { renderTip } from "../components/ui/renderTip";
import { YouTubeIcon } from "../components/icons/ui";


interface Props {
  audioState: AudioState;
  loadAudio: (src: string, name: string) => void;
  playAudio: () => void;
  pauseAudio: () => void;
  stopAudio: () => void;
  seekAudio: (time: number) => void;
  setAudioVolume: (volume: number) => void;
  settings: AppSettings;
}

export default function AudioLibraryPage({
  audioState,
  loadAudio,
  playAudio,
  pauseAudio,
  stopAudio,
  seekAudio,
  setAudioVolume,
  settings,
}: Props) {
  const library = useAudioLibrary(loadAudio);
  const scheduler = useAudioScheduler();
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
  const [pageTab, setPageTab] = useState<"library" | "schedule">("library");
  const [addPanel, setAddPanel] = useState<"upload" | "youtube" | null>(null);

  const t = getTranslations(settings.language);

  const youtubeLabels = useMemo(
    () => ({
      urlPlaceholder: t.audioLibrary.youtubeUrl,
      downloadButton: t.audioLibrary.download,
      enterUrl: t.audioLibrary.enterUrl,
      invalidUrl: t.audioLibrary.invalidUrl,
      processing: t.audioLibrary.processing,
      complete: t.audioLibrary.complete,
      cancel: t.audioLibrary.cancel,
      stages: t.youtubeDownload,
    }),
    [t],
  );

  const handleSelectAudio = (audio: AudioItem) => {
    setSelectedAudioId(audio.id);
    library.loadAudioToDisplay(audio);
    playAudio();
  };

  return (
    <div className="min-w-0 w-full min-h-full flex flex-col">
      <div className="max-w-2xl mx-auto w-full space-y-4 sm:space-y-6 mb-4">
        {/* Tabs — Library / Schedule */}
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setPageTab("library")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              pageTab === "library"
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {t.audioLibrary.libraryTab}
          </button>
          <button
            onClick={() => setPageTab("schedule")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              pageTab === "schedule"
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {t.audioLibrary.scheduleTab}
          </button>
        </div>

        {/* Library tab */}
        {pageTab === "library" && (() => {
          const togglePanel = (panel: "upload" | "youtube") =>
            setAddPanel((p) => (p === panel ? null : panel));
          const showUpload = addPanel === "upload" && !library.isElectron;
          const showYoutube = addPanel === "youtube" || library.downloads.length > 0;
          const hasContentBelow = !!library.directoryImport || showUpload || showYoutube;

          return (
          <>
            {/* Add audio section */}
            <Card compact tip={renderTip(t.audioLibrary.addTip)}>
              {/* Toolbar */}
              <div className={`flex items-center bg-gray-900/50 border border-gray-700/50 rounded-lg overflow-hidden mr-8 ${hasContentBelow ? "mb-4" : ""}`}>
                {library.isElectron && (
                  <>
                    <button
                      onClick={() => library.addLocalAudio()}
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
                        {t.audioLibrary.addLocalFile}
                      </span>
                    </button>
                    <button
                      onClick={() => library.addLocalAudioDirectory()}
                      disabled={!!library.directoryImport}
                      className="px-3 py-2.5 sm:px-4 hover:bg-gray-700 active:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm text-gray-300"
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
                      <span>
                        {t.audioLibrary.addFolder}
                      </span>
                    </button>
                  </>
                )}
                {!library.isElectron && (
                  <button
                    onClick={() => togglePanel("upload")}
                    className={`px-3 py-2.5 sm:px-4 transition-colors flex items-center gap-2 text-sm ${
                      addPanel === "upload"
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
                      {t.audioLibrary.upload}
                    </span>
                  </button>
                )}
                <button
                  onClick={() => togglePanel("youtube")}
                  className={`px-3 py-2.5 sm:px-4 transition-colors flex items-center gap-2 text-sm ${
                    addPanel === "youtube"
                      ? "bg-gray-700 text-red-400"
                      : "text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  <YouTubeIcon />
                  <span>{t.audioLibrary.youtube}</span>
                </button>
              </div>

              {/* Directory import progress */}
              {library.directoryImport && (
                <div className="bg-gray-700 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg
                      className="w-4 h-4 animate-spin text-blue-400"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    <span className="text-sm font-medium">
                      {library.directoryImport.status === "scanning"
                        ? t.audioLibrary.scanningFolder
                        : library.directoryImport.status === "complete"
                          ? t.audioLibrary.importComplete
                          : t.audioLibrary.importingFolder}
                    </span>
                  </div>
                  {library.directoryImport.total > 0 && (
                    <>
                      <div className="text-xs text-gray-400 mb-2">
                        {t.audioLibrary.importProgress
                          .replace(
                            "{current}",
                            String(library.directoryImport.current),
                          )
                          .replace(
                            "{total}",
                            String(library.directoryImport.total),
                          )}
                        {library.directoryImport.currentFile && (
                          <span className="ml-2 truncate">
                            - {library.directoryImport.currentFile}
                          </span>
                        )}
                      </div>
                      <div className="w-full bg-gray-600 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${
                              (library.directoryImport.current /
                                library.directoryImport.total) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                      {library.directoryImport.errors.length > 0 && (
                        <div className="mt-2 text-xs text-red-400">
                          {t.audioLibrary.importErrors.replace(
                            "{count}",
                            String(library.directoryImport.errors.length),
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {library.directoryImport.status === "complete" &&
                    library.directoryImport.total === 0 && (
                      <div className="text-xs text-gray-400">
                        {t.audioLibrary.noAudioFiles}
                      </div>
                    )}
                </div>
              )}

              {/* File uploader (web remote only) */}
              {showUpload && (
                <MediaUploader
                  onUpload={library.uploadAudio}
                  activeUploads={library.uploads}
                  allowedExtensions={[".mp3", ".wav", ".ogg", ".m4a", ".flac"]}
                  maxSizeBytes={500 * 1024 * 1024}
                  uploadUrl="/api/audio/upload"
                  uploadFieldName="audio"
                  labels={{
                    uploading: t.audioLibrary.uploading,
                    uploadDrop: t.audioLibrary.uploadDrop,
                    uploadHint: t.audioLibrary.uploadHint,
                    processing: t.audioLibrary.processing,
                    complete: t.audioLibrary.complete,
                    invalidType: t.audioLibrary.invalidType,
                    tooLarge: t.audioLibrary.tooLarge,
                    uploadFailed: t.audioLibrary.uploadFailed,
                  }}
                />
              )}

              {/* Keep mounted while downloads are in flight so progress
                  survives the user collapsing the panel. */}
              {showYoutube && (
                <YouTubeDownloader
                  onDownload={library.downloadYouTubeAudio}
                  onCancel={library.cancelAudioDownload}
                  activeDownloads={library.downloads}
                  labels={youtubeLabels}
                />
              )}
            </Card>

            {/* Audio library list */}
            <Card compact className="overflow-hidden">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
                {t.audioLibrary.library} ({library.audios.length})
                {library.audios.length > 0 && (
                  <span className="text-xs sm:text-sm font-normal text-gray-500 ml-2">
                    {formatFileSize(library.audios.reduce((sum, a) => sum + a.fileSize, 0))}
                  </span>
                )}
              </h3>
              <AudioLibraryList
                audios={library.audios}
                selectedAudioId={selectedAudioId}
                onSelect={handleSelectAudio}
                onDelete={library.deleteAudio}
                onRename={library.renameAudio}
                onOpenFileLocation={(filePath) =>
                  window.electronAPI?.showItemInFolder(filePath)
                }
                t={t}
              />
            </Card>
          </>
          );
        })()}

        {/* Schedule tab */}
        {pageTab === "schedule" && (
          <AudioScheduleSection
            audios={library.audios}
            schedules={scheduler.schedules}
            presets={scheduler.presets}
            onCreateSchedule={scheduler.createSchedule}
            onCancelSchedule={scheduler.cancelSchedule}
            onCreatePreset={scheduler.createPreset}
            onActivatePreset={scheduler.activatePreset}
            onDeletePreset={scheduler.deletePreset}
            t={t}
          />
        )}
      </div>

      {/* Sticky playback controls */}
      {audioState.src && (
        <StickyPlaybackBar
          trackName={audioState.name || audioState.src.split("/").pop() || ""}
          isPlaying={audioState.playing}
          currentTime={audioState.currentTime}
          duration={audioState.duration}
          volume={audioState.volume}
          onPlay={playAudio}
          onPause={pauseAudio}
          onStop={stopAudio}
          onSeek={seekAudio}
          onVolumeChange={setAudioVolume}
          labels={{
            nowPlaying: t.audioLibrary.nowPlaying,
            play: t.audioLibrary.play,
            pause: t.audioLibrary.pause,
            stop: t.audioLibrary.stop,
            volume: t.audioLibrary.volume,
          }}
        />
      )}
    </div>
  );
}
