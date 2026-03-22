import { useState } from "react";
import type { AppSettings, AudioState } from "../../shared/types";
import type { AudioItem } from "../../shared/audioLibrary.types";
import { useAudioLibrary } from "../useAudioLibrary";
import { useAudioScheduler } from "../useAudioScheduler";
import AudioLibraryList from "../components/AudioLibraryList";
import MediaUploader from "../components/MediaUploader";
import AudioScheduleSection from "../components/AudioScheduleSection";
import { getTranslations } from "@shared/i18n";
import { formatDuration } from "@shared/utils";
import { Card } from "../components/ui/Card";

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
  const [activeTab, setActiveTab] = useState<"library" | "upload">("library");

  const t = getTranslations(settings.language);

  const handleSelectAudio = (audio: AudioItem) => {
    setSelectedAudioId(audio.id);
    library.loadAudioToDisplay(audio);
    playAudio();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seekAudio(Number(e.target.value));
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAudioVolume(Number(e.target.value));
  };

  return (
    <div className="space-y-6 min-w-0 max-w-full">
      {/* Add audio section */}
      <Card compact>
        {/* Tabs */}
        <div className="flex items-center bg-gray-900/50 border border-gray-700/50 rounded-lg overflow-hidden mb-4">
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
                <span className="hidden sm:inline">
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
                <span className="hidden sm:inline">
                  {t.audioLibrary.addFolder}
                </span>
              </button>
            </>
          )}
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
              <span className="hidden xs:inline">{t.audioLibrary.upload}</span>
            </button>
          )}
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
                    .replace("{total}", String(library.directoryImport.total))}
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
        {activeTab === "upload" && !library.isElectron && (
          <MediaUploader
            onUpload={library.uploadAudio}
            activeUploads={library.uploads}
            allowedExtensions={[".mp3", ".wav", ".ogg", ".m4a", ".flac"]}
            maxSizeBytes={500 * 1024 * 1024}
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
      </Card>

      {/* Audio library */}
      <Card compact className="overflow-hidden">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
          {t.audioLibrary.library} ({library.audios.length})
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

      {/* Audio controls - only show when audio is loaded */}
      {audioState.src && (
        <Card className="space-y-4 sm:space-y-6">
          {/* Current audio */}
          <div>
            <div className="text-xs sm:text-sm text-gray-400 mb-1">
              {t.audioLibrary.nowPlaying}
            </div>
            <div className="font-semibold truncate text-sm sm:text-base">
              {audioState.name || audioState.src.split("/").pop()}
            </div>
          </div>

          {/* Playback controls */}
          <div className="flex gap-2 sm:gap-3">
            <div className="flex-1 flex items-center bg-gray-900/50 border border-gray-700/50 rounded-lg overflow-hidden">
              {audioState.playing ? (
                <button
                  onClick={pauseAudio}
                  className="flex-1 py-3 sm:py-3.5 hover:bg-gray-700 active:bg-gray-600 transition-colors flex items-center justify-center gap-2 text-yellow-400"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                  <span className="hidden xs:inline text-sm font-medium">{t.audioLibrary.pause}</span>
                </button>
              ) : (
                <button
                  onClick={playAudio}
                  className="flex-1 py-3 sm:py-3.5 hover:bg-gray-700 active:bg-gray-600 transition-colors flex items-center justify-center gap-2 text-green-400"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span className="hidden xs:inline text-sm font-medium">{t.audioLibrary.play}</span>
                </button>
              )}
            </div>
            <button
              onClick={stopAudio}
              className="px-4 py-3 sm:py-3.5 rounded-lg flex items-center gap-2 flex-shrink-0 bg-red-600/20 text-red-400 hover:bg-red-600/30 active:bg-red-600/40 border border-red-600/40 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h12v12H6z" />
              </svg>
              <span className="hidden xs:inline text-sm font-medium">{t.audioLibrary.stop}</span>
            </button>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs sm:text-sm text-gray-400 mb-2">
              <span>{formatDuration(audioState.currentTime)}</span>
              <span>{formatDuration(audioState.duration)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={audioState.duration || 100}
              value={audioState.currentTime}
              onChange={handleSeek}
              className="w-full h-2 sm:h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Volume control */}
          <div>
            <div className="text-xs sm:text-sm text-gray-400 mb-2">
              {t.audioLibrary.volume}
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
                value={audioState.volume}
                onChange={handleVolume}
                className="flex-1 h-2 sm:h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="w-10 sm:w-12 text-right text-gray-400 text-xs sm:text-sm">
                {Math.round(audioState.volume * 100)}%
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Audio Scheduling Section */}
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
    </div>
  );
}
