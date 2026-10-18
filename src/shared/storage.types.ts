export interface StorageUsage {
  count: number;
  bytes: number;
}

/** What BisHub's media takes up on the main computer, for Settings → Storage. */
export interface StorageStats {
  videos: StorageUsage;
  audio: StorageUsage;
  images: StorageUsage;
  /** Everything waiting in Transfers, spares included. */
  transfers: StorageUsage;
  /** Transfers an older version copied into a library: safe to delete. */
  spareTransfers: StorageUsage;
}
