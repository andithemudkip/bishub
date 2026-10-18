import { IMAGE_EXTENSIONS } from "./imageLibrary.types";

export interface TransferItem {
  id: string;
  name: string;
  filename: string;
  path: string;
  dateAdded: number;
  fileSize: number;
  extension: string;
  /**
   * Set by older versions, which copied a transfer into a library instead of
   * moving it: the file is in that library too, so this one is a spare.
   */
  addedToVideo?: boolean;
  addedToAudio?: boolean;
  addedToImage?: boolean;
}

export interface TransferUploadProgress {
  id: string;
  filename: string;
  status: "uploading" | "processing" | "complete" | "error";
  progress: number;
  error?: string;
}

export const TRANSFER_LIBRARIES = ["video", "audio", "image"] as const;
export type TransferLibrary = (typeof TRANSFER_LIBRARIES)[number];

const LIBRARY_EXTENSIONS: Record<TransferLibrary, readonly string[]> = {
  video: [".mp4", ".webm", ".mov", ".avi", ".mkv"],
  audio: [".mp3", ".wav", ".ogg", ".m4a", ".flac"],
  image: IMAGE_EXTENSIONS,
};

/** The one library a transferred file can be moved into, if any. */
export function libraryForExtension(extension: string): TransferLibrary | null {
  const ext = extension.toLowerCase();
  for (const library of TRANSFER_LIBRARIES) {
    if (LIBRARY_EXTENSIONS[library].includes(ext)) return library;
  }
  return null;
}

/** The library an older version already copied this transfer into, if any. */
export function libraryAlreadyCopiedTo(transfer: TransferItem): TransferLibrary | null {
  if (transfer.addedToVideo) return "video";
  if (transfer.addedToAudio) return "audio";
  if (transfer.addedToImage) return "image";
  return null;
}
