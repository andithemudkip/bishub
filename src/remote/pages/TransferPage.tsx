import { useCallback, useEffect, useRef, useState } from "react";
import type { AppSettings } from "../../shared/types";
import {
  libraryAlreadyCopiedTo,
  libraryForExtension,
  type TransferItem,
  type TransferLibrary,
} from "../../shared/transfer.types";
import { useTransfers } from "../useTransfers";
import MediaUploader from "../components/MediaUploader";
import { getTranslations } from "@shared/i18n";
import { formatFileSize, formatDate } from "@shared/utils";
import { Card } from "../components/ui/Card";
import { renderTip } from "../components/ui/renderTip";
import { ToastStack, type ToastItem } from "../components/ui/Toast";
import { CheckIcon } from "../components/icons/ui";

type Translations = ReturnType<typeof getTranslations>;

const SUCCESS_MS = 4000;
const ERROR_MS = 7000;

const buttonBase =
  "px-2 py-1 rounded-md text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

interface Props {
  settings: AppSettings;
  /** Open a library page, from the toast after moving a file into it. */
  onOpenLibrary: (library: TransferLibrary) => void;
}

/**
 * An inbox for files sent from phones and browsers. Media is moved — not
 * copied — into its library, so it leaves here and costs no extra space.
 */
export default function TransferPage({ settings, onOpenLibrary }: Props) {
  const api = useTransfers();
  const t = getTranslations(settings.language);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const toast = (item: ToastItem) => {
    timers.current.set(
      item.id,
      setTimeout(() => dismiss(item.id), item.tone === "error" ? ERROR_MS : SUCCESS_MS)
    );
    setToasts((prev) => [...prev, item].slice(-3));
  };

  const handleMove = async (transfer: TransferItem, library: TransferLibrary) => {
    const moved = await api.moveToLibrary(transfer.id, library).catch(() => false);
    const libraryName = t.transfer.libraries[library];
    toast(
      moved
        ? {
            id: `moved-${transfer.id}`,
            tone: "success",
            title: t.transfer.movedTo.replace("{library}", libraryName),
            detail: transfer.name,
            onSelect: () => onOpenLibrary(library),
          }
        : {
            id: `failed-${transfer.id}-${Date.now()}`,
            tone: "error",
            title: t.transfer.moveFailed.replace("{name}", transfer.name),
          }
    );
  };

  return (
    <div className="min-w-0 max-w-2xl mx-auto w-full space-y-4 sm:space-y-6">
      {/* Upload area — web remotes only */}
      {!api.isElectron && (
        <Card compact>
          <MediaUploader
            onUpload={api.uploadFile}
            activeUploads={api.uploads}
            allowedExtensions={[]}
            maxSizeBytes={2 * 1024 * 1024 * 1024}
            uploadUrl="/api/transfers/upload"
            uploadFieldName="file"
            labels={{
              uploading: t.transfer.uploading,
              uploadDrop: t.transfer.uploadDrop,
              uploadHint: t.transfer.uploadHint,
              processing: t.transfer.uploading,
              complete: t.transfer.complete,
              invalidType: "",
              tooLarge: "",
              uploadFailed: t.transfer.uploadFailed,
            }}
          />
        </Card>
      )}

      {/* Transferred files */}
      <Card compact tip={renderTip(t.transfer.filesTip)}>
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
          {t.transfer.files} ({api.transfers.length})
          {api.transfers.length > 0 && (
            <span className="text-xs sm:text-sm font-normal text-gray-500 ml-2">
              {formatFileSize(api.transfers.reduce((sum, t) => sum + t.fileSize, 0))}
            </span>
          )}
        </h3>

        {api.transfers.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <div className="text-gray-500 text-sm">{t.transfer.noFiles}</div>
            <div className="text-gray-600 text-xs mt-1">
              {t.transfer.noFilesHint}
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] sm:max-h-[500px] overflow-y-auto">
            {api.transfers.map((transfer) => (
              <TransferFileItem
                key={transfer.id}
                transfer={transfer}
                isElectron={api.isElectron}
                onDelete={(item) => api.deleteTransfer(item.id)}
                onMove={handleMove}
                t={t}
              />
            ))}
          </div>
        )}
      </Card>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function TransferFileItem({
  transfer,
  isElectron,
  onDelete,
  onMove,
  t,
}: {
  transfer: TransferItem;
  isElectron: boolean;
  onDelete: (t: TransferItem) => void;
  onMove: (t: TransferItem, library: TransferLibrary) => Promise<void>;
  t: Translations;
}) {
  const [moving, setMoving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Older versions copied instead of moving: this one is a spare.
  const copiedTo = libraryAlreadyCopiedTo(transfer);
  const library = copiedTo ? null : libraryForExtension(transfer.extension);

  const move = async (target: TransferLibrary) => {
    setMoving(true);
    try {
      await onMove(transfer, target);
    } finally {
      // On success the row is gone by now; on failure it's movable again.
      setMoving(false);
    }
  };

  return (
    <div className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-2.5 sm:p-3">
      <div className="flex items-start gap-2 sm:gap-3">
        {/* File info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">
            {transfer.name}
            <span className="text-gray-500">{transfer.extension}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
            <span>{formatFileSize(transfer.fileSize)}</span>
            <span>{formatDate(transfer.dateAdded)}</span>
          </div>
        </div>

        {/* Extension badge */}
        <span className="text-[10px] sm:text-xs font-mono px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 flex-shrink-0 uppercase">
          {transfer.extension.replace(".", "")}
        </span>
      </div>

      {confirmingDelete ? (
        <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs">
          <span className="text-gray-300 mr-1">
            {copiedTo
              ? t.transfer.confirmDeleteSpare
                  .replace("{name}", transfer.name)
                  .replace("{library}", t.transfer.libraries[copiedTo])
              : t.transfer.confirmDelete.replace("{name}", transfer.name)}
          </span>
          <button
            onClick={() => {
              setConfirmingDelete(false);
              onDelete(transfer);
            }}
            className={`${buttonBase} bg-red-600/20 text-red-400 hover:bg-red-600/30 border-red-600/40`}
          >
            {t.transfer.delete}
          </button>
          <button
            onClick={() => setConfirmingDelete(false)}
            className={`${buttonBase} bg-gray-600/20 text-gray-300 hover:bg-gray-600/30 border-gray-600/40`}
          >
            {t.transfer.cancel}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {library && (
            <button
              onClick={() => move(library)}
              disabled={moving}
              className={`${buttonBase} bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border-blue-600/40 disabled:opacity-60 disabled:cursor-wait`}
            >
              {moving
                ? t.transfer.moving
                : t.transfer.moveTo.replace("{library}", t.transfer.libraries[library])}
            </button>
          )}
          {copiedTo && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-green-400/80">
              <CheckIcon className="w-3.5 h-3.5" />
              {t.transfer.alreadyIn.replace("{library}", t.transfer.libraries[copiedTo])}
            </span>
          )}
          {isElectron && (
            <button
              onClick={() => window.electronAPI?.showItemInFolder(transfer.path)}
              className={`${buttonBase} bg-gray-700/50 text-gray-300 hover:bg-gray-700 border-gray-600/40`}
            >
              {t.transfer.openInExplorer}
            </button>
          )}
          <button
            onClick={() => setConfirmingDelete(true)}
            disabled={moving}
            className={`${buttonBase} bg-red-600/20 text-red-400 hover:bg-red-600/30 border-red-600/40 disabled:opacity-60`}
          >
            {t.transfer.delete}
          </button>
        </div>
      )}
    </div>
  );
}
