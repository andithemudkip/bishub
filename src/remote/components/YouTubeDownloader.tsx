import { useState } from "react";
import type { DownloadProgress } from "../../shared/videoLibrary.types";
import type { Translations } from "../../shared/i18n";

interface Props {
  onDownload: (url: string) => void;
  onCancel: (downloadId: string) => void;
  activeDownloads: DownloadProgress[];
  t: Translations;
}

function isValidYouTubeUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^https?:\/\/youtu\.be\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/,
  ];
  return patterns.some((p) => p.test(url));
}

export default function YouTubeDownloader({
  onDownload,
  onCancel,
  activeDownloads,
  t,
}: Props) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError(t.videoLibrary.enterUrl);
      return;
    }

    if (!isValidYouTubeUrl(url.trim())) {
      setError(t.videoLibrary.invalidUrl);
      return;
    }

    onDownload(url.trim());
    setUrl("");
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder={t.videoLibrary.youtubeUrl}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 sm:px-4 text-sm sm:text-base focus:outline-none focus:border-red-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
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
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          {t.videoLibrary.download}
        </button>
      </form>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {/* Active downloads */}
      {activeDownloads.length > 0 && (
        <div className="space-y-2">
          {activeDownloads.map((download) => (
            <div
              key={download.id}
              className="bg-gray-700 rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">
                    {download.filename || download.url}
                  </div>
                  <div className="text-xs text-gray-400">
                    {download.status === "downloading" && (
                      <>
                        {download.speed && <span>{download.speed}</span>}
                        {download.eta && <span> - ETA: {download.eta}</span>}
                      </>
                    )}
                    {download.status === "processing" &&
                      t.videoLibrary.processing}
                    {download.status === "complete" && (
                      <span className="text-green-400">
                        {t.videoLibrary.complete}
                      </span>
                    )}
                    {download.status === "error" && (
                      <span className="text-red-400">{download.error}</span>
                    )}
                  </div>
                </div>
                {(download.status === "downloading" ||
                  download.status === "pending") && (
                  <button
                    onClick={() => onCancel(download.id)}
                    className="p-1 hover:bg-gray-600 rounded text-gray-400"
                    title="Cancel"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {/* Progress bar */}
              {(download.status === "downloading" ||
                download.status === "processing") && (
                <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      download.status === "processing"
                        ? "bg-yellow-500 animate-pulse"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${download.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
