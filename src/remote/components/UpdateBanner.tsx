import type { UpdateStatus } from "../../shared/types";
import type { Translations } from "../../shared/i18n";
import { CloseIcon } from "./icons/ui";

interface Props {
  status: UpdateStatus;
  t: Translations;
  onInstall: () => void;
  onDismiss: () => void;
}

const stateStyles = {
  available:
    "bg-blue-950/40 border-blue-800/50 text-blue-200",
  downloading:
    "bg-blue-950/40 border-blue-800/50 text-blue-200",
  ready:
    "bg-green-950/40 border-green-800/50 text-green-200",
};

export default function UpdateBanner({
  status,
  t,
  onInstall,
  onDismiss,
}: Props) {
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
  const styles = stateStyles[status.state];

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm border-b ${styles}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {isDownloading && (
          <>
            <div className="flex-shrink-0 w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="truncate">
              {t.updates.updateDownloading} {status.progress}%
            </span>
            <div className="hidden sm:block flex-1 max-w-32 h-1.5 bg-blue-900/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full transition-all duration-300"
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
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-600/40 transition-colors"
          >
            {t.updates.restartToUpdate}
          </button>
        )}

        {!isDownloading && (
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Dismiss"
          >
            <CloseIcon />
          </button>
        )}
      </div>
    </div>
  );
}
