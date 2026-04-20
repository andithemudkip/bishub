import { useState, useRef } from "react";
import { uploadWithProgress, getApiUrl } from "@shared/utils";

interface UploadItem {
  id: string;
  filename: string;
  status: "uploading" | "processing" | "complete" | "error";
  progress: number;
  error?: string;
}

interface ClientUpload {
  id: string;
  filename: string;
  progress: number;
  status: "uploading" | "error";
  error?: string;
}

interface Props {
  onUpload: (file: File) => Promise<void>;
  activeUploads: UploadItem[];
  allowedExtensions: string[];
  maxSizeBytes: number;
  /** The API endpoint to POST the file to (enables upload progress tracking) */
  uploadUrl?: string;
  /** The form field name for the file (default: "file") */
  uploadFieldName?: string;
  /** Extra form fields to include in the upload */
  uploadExtraFields?: Record<string, string>;
  labels: {
    uploading: string;
    uploadDrop: string;
    uploadHint: string;
    processing: string;
    complete: string;
    invalidType: string;
    tooLarge: string;
    uploadFailed: string;
  };
}

export default function MediaUploader({
  onUpload,
  activeUploads,
  allowedExtensions,
  maxSizeBytes,
  uploadUrl,
  uploadFieldName = "file",
  uploadExtraFields,
  labels,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [clientUploads, setClientUploads] = useState<ClientUpload[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (allowedExtensions.length > 0) {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!allowedExtensions.includes(ext)) return labels.invalidType;
    }
    if (file.size > maxSizeBytes) return labels.tooLarge;
    return null;
  };

  const makeId = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const updateClientUpload = (id: string, patch: Partial<ClientUpload>) => {
    setClientUploads((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...patch } : u))
    );
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setClientUploads((prev) => prev.filter((u) => u.status === "error"));
    setIsBusy(true);

    try {
      for (const file of files) {
        const id = makeId();
        const validationError = validateFile(file);
        if (validationError) {
          setClientUploads((prev) => [
            ...prev,
            {
              id,
              filename: file.name,
              progress: 0,
              status: "error",
              error: validationError,
            },
          ]);
          continue;
        }

        setClientUploads((prev) => [
          ...prev,
          { id, filename: file.name, progress: 0, status: "uploading" },
        ]);

        try {
          if (uploadUrl) {
            const formData = new FormData();
            formData.append(uploadFieldName, file);
            if (uploadExtraFields) {
              for (const [key, value] of Object.entries(uploadExtraFields)) {
                formData.append(key, value);
              }
            }
            if (!uploadExtraFields?.name) {
              formData.append("name", file.name.replace(/\.[^.]+$/, ""));
            }
            await uploadWithProgress(
              getApiUrl(uploadUrl),
              formData,
              (percent) => updateClientUpload(id, { progress: percent })
            );
          } else {
            await onUpload(file);
          }
          // Remove from client list on success; parent's activeUploads takes over.
          setClientUploads((prev) => prev.filter((u) => u.id !== id));
        } catch {
          updateClientUpload(id, {
            status: "error",
            error: labels.uploadFailed,
          });
        }
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) handleFiles(files);
    e.target.value = "";
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 sm:p-6 text-center transition-colors cursor-pointer ${
          isDragging
            ? "border-blue-500 bg-blue-500/10"
            : "border-gray-600 hover:border-gray-500"
        } ${isBusy ? "opacity-50 pointer-events-none" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={allowedExtensions.join(",")}
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <svg
          className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 text-gray-400"
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
        <div className="text-gray-300 text-sm sm:text-base">
          {isBusy ? labels.uploading : labels.uploadDrop}
        </div>
        <div className="text-xs sm:text-sm text-gray-500 mt-1">
          {labels.uploadHint}
        </div>
      </div>

      {/* Client-side upload progress (one entry per file) */}
      {clientUploads.length > 0 && (
        <div className="space-y-2">
          {clientUploads.map((upload) => (
            <div
              key={upload.id}
              className="bg-gray-700 rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{upload.filename}</div>
                  <div className="text-xs text-gray-400">
                    {upload.status === "uploading" && (
                      <>
                        {labels.uploading} {upload.progress}%
                      </>
                    )}
                    {upload.status === "error" && (
                      <span className="text-red-400">{upload.error}</span>
                    )}
                  </div>
                </div>
              </div>
              {upload.status === "uploading" && (
                <div className="h-1.5 bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${upload.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Server-side processing progress */}
      {activeUploads.length > 0 && (
        <div className="space-y-2">
          {activeUploads.map((upload) => (
            <div
              key={upload.id}
              className="bg-gray-700 rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{upload.filename}</div>
                  <div className="text-xs text-gray-400">
                    {upload.status === "uploading" && labels.uploading}
                    {upload.status === "processing" && labels.processing}
                    {upload.status === "complete" && (
                      <span className="text-green-400">{labels.complete}</span>
                    )}
                    {upload.status === "error" && (
                      <span className="text-red-400">{upload.error}</span>
                    )}
                  </div>
                </div>
              </div>

              {(upload.status === "uploading" ||
                upload.status === "processing") && (
                <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      upload.status === "processing"
                        ? "bg-yellow-500 animate-pulse w-full"
                        : "bg-blue-500"
                    }`}
                    style={
                      upload.status === "uploading"
                        ? { width: `${upload.progress}%` }
                        : undefined
                    }
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
