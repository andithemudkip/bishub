import { useState } from "react";
import type { VideoItem } from "../../shared/videoLibrary.types";
import type { Translations } from "../../shared/i18n";

interface Props {
  videos: VideoItem[];
  selectedVideoId: string | null;
  onSelect: (video: VideoItem) => void;
  onDelete: (videoId: string) => void;
  onRename: (videoId: string, newName: string) => void;
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

function SourceIcon({ source }: { source: VideoItem["source"] }) {
  switch (source) {
    case "youtube":
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
        </svg>
      );
    case "upload":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      );
    case "local":
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      );
  }
}

export default function VideoLibraryList({
  videos,
  selectedVideoId,
  onSelect,
  onDelete,
  onRename,
  t,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredVideos = videos.filter((v) =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartRename = (video: VideoItem) => {
    setEditingId(video.id);
    setEditName(video.name);
  };

  const handleSaveRename = (videoId: string) => {
    if (editName.trim()) {
      onRename(videoId, editName.trim());
    }
    setEditingId(null);
  };

  const handleConfirmDelete = (videoId: string) => {
    onDelete(videoId);
    setConfirmDeleteId(null);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Search bar */}
      <div className="relative">
        <input
          type="text"
          placeholder={t.videoLibrary.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 pl-9 sm:px-4 sm:pl-10 text-sm sm:text-base focus:outline-none focus:border-blue-500"
        />
        <svg className="absolute left-2.5 sm:left-3 top-2.5 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Video list */}
      <div className="space-y-2 max-h-[350px] sm:max-h-[400px] overflow-y-auto overflow-x-hidden p-1">
        {filteredVideos.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {videos.length === 0 ? (
              <>
                <svg className="w-12 h-12 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p>{t.videoLibrary.noVideos}</p>
                <p className="text-sm mt-1">{t.videoLibrary.noVideosHint}</p>
              </>
            ) : (
              <>
                <p>{t.videoLibrary.noResults}</p>
              </>
            )}
          </div>
        ) : (
          filteredVideos.map((video) => (
            <div
              key={video.id}
              className={`bg-gray-700 rounded-lg p-2 sm:p-3 cursor-pointer transition-colors overflow-hidden ${
                selectedVideoId === video.id
                  ? "ring-2 ring-blue-500"
                  : "hover:bg-gray-600"
              }`}
              onClick={() => onSelect(video)}
            >
              <div className="flex gap-2 sm:gap-3 min-w-0">
                {/* Thumbnail */}
                <div className="w-16 h-10 sm:w-24 sm:h-14 bg-gray-800 rounded flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {video.thumbnailPath ? (
                    <img
                      src={`/api/videos/thumbnail/${video.id}`}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {editingId === video.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleSaveRename(video.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveRename(video.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-xs sm:text-sm focus:outline-none focus:border-blue-500"
                      autoFocus
                    />
                  ) : (
                    <div className="font-medium truncate text-sm sm:text-base">{video.name}</div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1">
                    <span title={video.source} className="flex-shrink-0">
                      <SourceIcon source={video.source} />
                    </span>
                    <span className="flex-shrink-0">{formatDuration(video.duration)}</span>
                    <span className="flex-shrink-0">{formatFileSize(video.fileSize)}</span>
                    <span className="hidden sm:inline flex-shrink-0">{formatDate(video.dateAdded)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div
                  className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleStartRename(video)}
                    className="p-1.5 sm:p-2 hover:bg-gray-500 rounded transition-colors"
                    title={t.videoLibrary.rename}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  {confirmDeleteId === video.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleConfirmDelete(video.id)}
                        className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs"
                      >
                        {t.videoLibrary.confirmDelete}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs"
                      >
                        {t.videoLibrary.cancel}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(video.id)}
                      className="p-1.5 sm:p-2 hover:bg-gray-500 rounded transition-colors text-red-400"
                      title={t.videoLibrary.delete}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
