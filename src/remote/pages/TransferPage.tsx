import type { AppSettings } from "../../shared/types";
import type { TransferItem } from "../../shared/transfer.types";
import { useTransfers } from "../useTransfers";
import MediaUploader from "../components/MediaUploader";
import { getTranslations } from "@shared/i18n";
import { formatFileSize, formatDate } from "@shared/utils";
import { Card } from "../components/ui/Card";

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".avi", ".mkv"];
const AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".m4a", ".flac"];

interface Props {
  settings: AppSettings;
}

export default function TransferPage({ settings }: Props) {
  const api = useTransfers();
  const t = getTranslations(settings.language);

  const handleDelete = async (transfer: TransferItem) => {
    if (!confirm(t.transfer.confirmDelete)) return;
    await api.deleteTransfer(transfer.id);
  };

  const handleAddToVideo = async (transfer: TransferItem) => {
    await api.addToVideoLibrary(transfer.id);
  };

  const handleAddToAudio = async (transfer: TransferItem) => {
    await api.addToAudioLibrary(transfer.id);
  };

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      {/* Upload area — web remotes only */}
      {!api.isElectron && (
        <Card compact>
          <MediaUploader
            onUpload={api.uploadFile}
            activeUploads={api.uploads}
            allowedExtensions={[]}
            maxSizeBytes={2 * 1024 * 1024 * 1024}
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
      <Card compact>
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
                onDelete={handleDelete}
                onAddToVideo={handleAddToVideo}
                onAddToAudio={handleAddToAudio}
                t={t}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function TransferFileItem({
  transfer,
  isElectron,
  onDelete,
  onAddToVideo,
  onAddToAudio,
  t,
}: {
  transfer: TransferItem;
  isElectron: boolean;
  onDelete: (t: TransferItem) => void;
  onAddToVideo: (t: TransferItem) => void;
  onAddToAudio: (t: TransferItem) => void;
  t: ReturnType<typeof getTranslations>;
}) {
  const isVideo = VIDEO_EXTENSIONS.includes(transfer.extension);
  const isAudio = AUDIO_EXTENSIONS.includes(transfer.extension);

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

      {/* Actions */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {isVideo && (
          <button
            onClick={() => onAddToVideo(transfer)}
            disabled={transfer.addedToVideo}
            className={`px-2 py-1 rounded-md text-xs font-medium border transition-colors ${
              transfer.addedToVideo
                ? "bg-green-600/10 text-green-500/60 border-green-600/30 cursor-default"
                : "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border-blue-600/40"
            }`}
          >
            {transfer.addedToVideo ? t.transfer.addedToVideo : t.transfer.addToVideo}
          </button>
        )}
        {isAudio && (
          <button
            onClick={() => onAddToAudio(transfer)}
            disabled={transfer.addedToAudio}
            className={`px-2 py-1 rounded-md text-xs font-medium border transition-colors ${
              transfer.addedToAudio
                ? "bg-green-600/10 text-green-500/60 border-green-600/30 cursor-default"
                : "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border-blue-600/40"
            }`}
          >
            {transfer.addedToAudio ? t.transfer.addedToAudio : t.transfer.addToAudio}
          </button>
        )}
        {isElectron && (
          <button
            onClick={() =>
              window.electronAPI?.showItemInFolder(transfer.path)
            }
            className="px-2 py-1 rounded-md text-xs font-medium bg-gray-700/50 text-gray-300 hover:bg-gray-700 border border-gray-600/40 transition-colors"
          >
            {t.transfer.openInExplorer}
          </button>
        )}
        <button
          onClick={() => onDelete(transfer)}
          className="px-2 py-1 rounded-md text-xs font-medium bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/40 transition-colors"
        >
          {t.transfer.delete}
        </button>
      </div>
    </div>
  );
}
