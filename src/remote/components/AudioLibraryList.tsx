import { useState } from "react";
import type { AudioItem } from "../../shared/audioLibrary.types";
import type { Translations } from "../../shared/i18n";

interface Props {
  audios: AudioItem[];
  selectedAudioId: string | null;
  onSelect: (audio: AudioItem) => void;
  onDelete: (audioId: string) => void;
  onRename: (audioId: string, newName: string) => void;
  t: Translations;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString();
}

function SourceIcon({ source }: { source: AudioItem["source"] }) {
  switch (source) {
    case "upload":
      return (
        <svg
          className="w-4 h-4"
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
      );
    case "local":
    default:
      return (
        <svg
          className="w-4 h-4"
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
      );
  }
}

export default function AudioLibraryList({
  audios,
  selectedAudioId,
  onSelect,
  onDelete,
  onRename,
  t,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredAudios = audios.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartRename = (audio: AudioItem) => {
    setEditingId(audio.id);
    setEditName(audio.name);
  };

  const handleSaveRename = (audioId: string) => {
    if (editName.trim()) {
      onRename(audioId, editName.trim());
    }
    setEditingId(null);
  };

  const handleConfirmDelete = (audioId: string) => {
    onDelete(audioId);
    setConfirmDeleteId(null);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Search bar */}
      <div className="relative">
        <input
          type="text"
          placeholder={t.audioLibrary.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 pl-9 sm:px-4 sm:pl-10 text-sm sm:text-base focus:outline-none focus:border-blue-500"
        />
        <svg
          className="absolute left-2.5 sm:left-3 top-2.5 w-4 h-4 sm:w-5 sm:h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Audio list */}
      <div className="space-y-2 max-h-[350px] sm:max-h-[400px] overflow-y-auto p-1">
        {filteredAudios.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {audios.length === 0 ? (
              <>
                <svg
                  className="w-12 h-12 mx-auto mb-2 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
                <p>{t.audioLibrary.noAudios}</p>
                <p className="text-sm mt-1">{t.audioLibrary.noAudiosHint}</p>
              </>
            ) : (
              <>
                <p>{t.audioLibrary.noResults}</p>
              </>
            )}
          </div>
        ) : (
          filteredAudios.map((audio) => (
            <div
              key={audio.id}
              className={`bg-gray-700 rounded-lg p-2 sm:p-3 cursor-pointer transition-colors ${
                selectedAudioId === audio.id
                  ? "ring-2 ring-blue-500"
                  : "hover:bg-gray-600"
              }`}
              onClick={() => onSelect(audio)}
            >
              <div className="flex gap-2 sm:gap-3">
                {/* Music icon */}
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-800 rounded flex-shrink-0 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                    />
                  </svg>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {editingId === audio.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleSaveRename(audio.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveRename(audio.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-xs sm:text-sm focus:outline-none focus:border-blue-500"
                      autoFocus
                    />
                  ) : (
                    <div className="font-medium truncate text-sm sm:text-base">
                      {audio.name}
                    </div>
                  )}
                  <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1">
                    <span title={audio.source} className="flex-shrink-0">
                      <SourceIcon source={audio.source} />
                    </span>
                    <span className="flex-shrink-0">
                      {formatDuration(audio.duration)}
                    </span>
                    <span className="flex-shrink-0">
                      {formatFileSize(audio.fileSize)}
                    </span>
                    <span className="hidden sm:inline flex-shrink-0">
                      {formatDate(audio.dateAdded)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div
                  className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleStartRename(audio)}
                    className="p-1.5 sm:p-2 hover:bg-gray-500 rounded transition-colors"
                    title={t.audioLibrary.rename}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  {confirmDeleteId === audio.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleConfirmDelete(audio.id)}
                        className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs"
                      >
                        {t.audioLibrary.confirmDelete}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs"
                      >
                        {t.audioLibrary.cancel}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(audio.id)}
                      className="p-1.5 sm:p-2 hover:bg-gray-500 rounded transition-colors text-red-400"
                      title={t.audioLibrary.delete}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
