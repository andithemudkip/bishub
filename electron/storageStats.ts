import type { StorageStats, StorageUsage } from "../src/shared/storage.types";
import { libraryAlreadyCopiedTo } from "../src/shared/transfer.types";
import { getVideoLibrary } from "./videoLibrary";
import { getAudioLibrary } from "./audioLibrary";
import { getImageLibrary } from "./imageLibrary";
import { getTransferManager } from "./transferManager";

function usage(items: { fileSize: number }[]): StorageUsage {
  return {
    count: items.length,
    bytes: items.reduce((sum, item) => sum + (item.fileSize || 0), 0),
  };
}

/** Sizes as recorded when each file was added, so nothing is read from disk. */
export function getStorageStats(): StorageStats {
  const transfers = getTransferManager().getAll();
  return {
    videos: usage(getVideoLibrary().getAll()),
    audio: usage(getAudioLibrary().getAll()),
    images: usage(getImageLibrary().getAll()),
    transfers: usage(transfers),
    spareTransfers: usage(transfers.filter((t) => libraryAlreadyCopiedTo(t))),
  };
}
