import { useState } from "react";
import { isValidYouTubeUrl } from "../../shared/utils";
import { CloseIcon } from "./icons/ui";
import type { DownloadProgress } from "../../shared/videoLibrary.types";
import type { AudioDownloadProgress } from "../../shared/audioLibrary.types";

export interface YouTubeDownloaderLabels {
  urlPlaceholder: string;
  downloadButton: string;
  enterUrl: string;
  invalidUrl: string;
  processing: string;
  complete: string;
  cancel: string;
  stages: {
    preparing: string;
    fetching: string;
    downloading: string;
    extracting: string;
    merging: string;
  };
}

interface Props {
  onDownload: (url: string) => void;
  onCancel: (downloadId: string) => void;
  activeDownloads: (DownloadProgress | AudioDownloadProgress)[];
  labels: YouTubeDownloaderLabels;
}

export default function YouTubeDownloader({
  onDownload,
  onCancel,
  activeDownloads,
  labels,
}: Props) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError(labels.enterUrl);
      return;
    }

    if (!isValidYouTubeUrl(url.trim())) {
      setError(labels.invalidUrl);
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
          placeholder={labels.urlPlaceholder}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 sm:px-4 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/40 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm sm:text-base font-medium"
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
          {labels.downloadButton}
        </button>
      </form>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {/* Active downloads */}
      {activeDownloads.length > 0 && (
        <div className="space-y-2">
          {activeDownloads.map((download) => {
            const isActive =
              download.status === "downloading" ||
              download.status === "pending";
            const isProcessing = download.status === "processing";
            // Speed/ETA are valid only during the actual download stage.
            // They linger on the progress object afterward, so gate on stage
            // or the user never sees "Extracting audio..." / "Merging streams...".
            const showSpeed =
              isActive && download.stage === "downloading" && download.speed;
            const showStage = isActive && !showSpeed && download.stage;
            const isIndeterminate =
              isActive && download.stage !== "downloading";
            return (
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
                      {showSpeed && (
                        <>
                          <span>{download.speed}</span>
                          {download.eta && <span> - ETA: {download.eta}</span>}
                        </>
                      )}
                      {showStage && (
                        <span>{labels.stages[download.stage!]}</span>
                      )}
                      {isProcessing && labels.processing}
                      {download.status === "complete" && (
                        <span className="text-green-400">
                          {labels.complete}
                        </span>
                      )}
                      {download.status === "error" && (
                        <span className="text-red-400">{download.error}</span>
                      )}
                    </div>
                  </div>
                  {isActive && (
                    <button
                      onClick={() => onCancel(download.id)}
                      className="p-1 hover:bg-gray-600 rounded text-gray-400"
                      title={labels.cancel}
                    >
                      <CloseIcon />
                    </button>
                  )}
                </div>

                {/* Progress bar — indeterminate (pulsing) during non-downloading
                    stages where yt-dlp isn't emitting a percentage. */}
                {(isActive || isProcessing) && (
                  <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isProcessing || isIndeterminate
                          ? "bg-yellow-500 animate-pulse"
                          : "bg-red-500"
                      }`}
                      style={{
                        width:
                          isIndeterminate ? "100%" : `${download.progress}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
