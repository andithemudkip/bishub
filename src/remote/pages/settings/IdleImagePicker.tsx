import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Translations } from "../../../shared/i18n";
import {
  IMAGE_EXTENSIONS,
  MAX_IMAGE_UPLOAD_BYTES,
  type ImageItem,
} from "../../../shared/imageLibrary.types";
import { libraryImageThumbnailUrl } from "../../hooks/useLibraryImages";
import { CloseIcon, PlusIcon } from "../../components/icons/ui";

/**
 * The Image library as a one-off choice for the idle screen: a centred dialog
 * on desktop, a bottom sheet on phones. Picking, or adding a new image, closes it.
 */
export function IdleImagePicker({
  images,
  selectedId,
  isElectron,
  onPick,
  onChooseFile,
  onUpload,
  onClose,
  t,
}: {
  images: ImageItem[];
  selectedId: string | null;
  isElectron: boolean;
  onPick: (imageId: string) => void;
  /** Main computer: native picker; resolves false when cancelled. */
  onChooseFile: () => Promise<boolean>;
  /** Other devices: upload into the library; resolves to the new image, or null. */
  onUpload: (file: File) => Promise<ImageItem | null>;
  onClose: () => void;
  t: Translations;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "failed">("idle");
  // Why the last pick was refused before uploading, as the library page's uploader says it.
  const [refusal, setRefusal] = useState<string | null>(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Once, on open: focus moves into the dialog so the keyboard doesn't stay on
  // the page behind it, and Escape closes it.
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const addImage = async () => {
    if (!isElectron) {
      fileInputRef.current?.click();
      return;
    }
    // The main process adds the file and sets it as the background itself.
    if (await onChooseFile()) onClose();
  };

  const uploadImage = async (file: File) => {
    // `accept` is only a hint some pickers ignore; the server would refuse these anyway.
    const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
    if (!IMAGE_EXTENSIONS.includes(ext)) {
      setRefusal(t.imageLibrary.invalidType);
      return;
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      setRefusal(t.imageLibrary.tooLarge);
      return;
    }
    setRefusal(null);
    setUploadState("uploading");
    const image = await onUpload(file);
    if (!image) {
      setUploadState("failed");
      return;
    }
    onPick(image.id);
    onClose();
  };

  const error = refusal ?? (uploadState === "failed" ? t.imageLibrary.uploadFailed : null);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t.settings.idleChooseImage}
        className="w-full sm:max-w-2xl max-h-[85vh] flex flex-col bg-gray-900 border border-gray-700/50 rounded-t-xl sm:rounded-xl shadow-2xl focus:outline-none safe-area-pb"
      >
        <header className="flex-shrink-0 flex items-center gap-2 pl-4 pr-2 py-2 border-b border-gray-800">
          <h3 className="flex-1 min-w-0 truncate text-sm font-medium text-gray-100">
            {t.settings.idleChooseImage}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.settings.idleCloseImages}
            title={t.settings.idleCloseImages}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </header>

        <div className="overflow-y-auto p-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={addImage}
              disabled={uploadState === "uploading"}
              className="aspect-video flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              <span className="text-[11px] px-1 truncate max-w-full">
                {uploadState === "uploading" ? t.imageLibrary.uploading : t.settings.selectWallpaper}
              </span>
            </button>
            {images.map((image) => {
              const selected = image.id === selectedId;
              return (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => {
                    onPick(image.id);
                    onClose();
                  }}
                  aria-pressed={selected}
                  aria-label={image.name}
                  title={image.name}
                  className={`aspect-video bg-gray-800 rounded-lg border overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors ${
                    selected
                      ? "border-blue-500/70 ring-2 ring-blue-500/40"
                      : "border-gray-700/50 hover:border-gray-600"
                  }`}
                >
                  <img
                    src={libraryImageThumbnailUrl(image)}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </button>
              );
            })}
          </div>
          {images.length === 0 && (
            <p className="text-sm text-gray-500 mt-3">{t.settings.idleNoImages}</p>
          )}
          {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
        </div>

        {!isElectron && (
          <input
            ref={fileInputRef}
            type="file"
            accept={IMAGE_EXTENSIONS.join(",")}
            className="hidden"
            data-testid="idle-upload"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) uploadImage(file);
            }}
          />
        )}
      </div>
    </div>,
    document.body
  );
}
