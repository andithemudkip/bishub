import type { UpdateStatus } from "../../shared/types";
import type { Translations } from "../../shared/i18n";

interface Props {
  status: UpdateStatus;
  t: Translations;
  onInstall: () => void;
  onDismiss: () => void;
}

export default function UpdateBanner({
  status,
  t,
  onInstall,
  onDismiss,
}: Props) {
  // Don't show banner for idle, checking, or error states
  if (
    status.state === "idle" ||
    status.state === "checking" ||
    status.state === "error"
  ) {
    return null;
  }

  const isReady = status.state === "ready";
  const isDownloading = status.state === "downloading";
  const isAvailable = status.state === "available";

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2 text-sm ${
        isReady
          ? "bg-green-600"
          : isDownloading
          ? "bg-blue-600"
          : "bg-purple-600"
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {isDownloading && (
          <>
            <div className="flex-shrink-0 w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="truncate">
              {t.updates.updateDownloading} {status.progress}%
            </span>
            <div className="hidden sm:block flex-1 max-w-32 h-1.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: `${status.progress || 0}%` }}
              />
            </div>
          </>
        )}

        {isAvailable && (
          <span className="truncate">
            {t.updates.updateAvailable}: v{status.version}
          </span>
        )}

        {isReady && (
          <span className="truncate">
            {t.updates.updateReady}: v{status.version}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {isReady && (
          <button
            onClick={onInstall}
            className="px-3 py-1 bg-white text-green-700 font-medium rounded hover:bg-green-100 transition-colors"
          >
            {t.updates.restartToUpdate}
          </button>
        )}

        {!isDownloading && (
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
