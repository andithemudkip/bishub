import { useState, useRef } from "react";
import type { AudioUploadProgress } from "../../shared/audioLibrary.types";
import type { Translations } from "../../shared/i18n";

interface Props {
  onUpload: (file: File) => Promise<void>;
  activeUploads: AudioUploadProgress[];
  t: Translations;
}

const ALLOWED_EXTENSIONS = [".mp3", ".wav", ".ogg", ".m4a", ".flac"];

export default function AudioUploader({ onUpload, activeUploads, t }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`);
      return false;
    }
    // 500MB limit
    if (file.size > 500 * 1024 * 1024) {
      setError("File too large. Maximum size is 500MB.");
      return false;
    }
    return true;
  };

  const handleFile = async (file: File) => {
    setError("");
    if (!validateFile(file)) return;

    setIsUploading(true);
    try {
      await onUpload(file);
    } catch (err) {
      setError("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = ""; // Reset input
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 sm:p-6 text-center transition-colors cursor-pointer ${
          isDragging
            ? "border-blue-500 bg-blue-500/10"
            : "border-gray-600 hover:border-gray-500"
        } ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(",")}
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
          {isUploading ? t.audioLibrary.uploading : t.audioLibrary.uploadDrop}
        </div>
        <div className="text-xs sm:text-sm text-gray-500 mt-1">
          {t.audioLibrary.uploadHint}
        </div>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {/* Active uploads */}
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
                    {upload.status === "uploading" && t.audioLibrary.uploading}
                    {upload.status === "processing" && "Processing..."}
                    {upload.status === "complete" && (
                      <span className="text-green-400">Complete!</span>
                    )}
                    {upload.status === "error" && (
                      <span className="text-red-400">{upload.error}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
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
