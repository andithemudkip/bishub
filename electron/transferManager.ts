import { app } from "electron";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import Store from "electron-store";
import {
  libraryAlreadyCopiedTo,
  libraryForExtension,
  type TransferItem,
  type TransferLibrary,
  type TransferUploadProgress,
} from "../src/shared/transfer.types";
import type { VideoItem } from "../src/shared/videoLibrary.types";
import type { AudioItem } from "../src/shared/audioLibrary.types";
import type { ImageItem } from "../src/shared/imageLibrary.types";
import { moveToOriginalName } from "./uploadFilename";
import { getVideoLibrary } from "./videoLibrary";
import { getAudioLibrary } from "./audioLibrary";
import { getImageLibrary } from "./imageLibrary";

interface TransferSchema {
  transfers: TransferItem[];
  version: number;
}

type TransferChangeCallback = (transfers: TransferItem[]) => void;
type UploadProgressCallback = (progress: TransferUploadProgress) => void;

export class TransferManager {
  private store: Store<TransferSchema>;
  private transfersDir: string;
  private changeListeners: TransferChangeCallback[] = [];
  private uploadProgressListeners: UploadProgressCallback[] = [];

  constructor() {
    this.store = new Store<TransferSchema>({
      name: "transfers",
      defaults: {
        transfers: [],
        version: 1,
      },
    });

    const userDataPath = app.getPath("userData");
    this.transfersDir = path.join(userDataPath, "transfers");
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.transfersDir)) {
      fs.mkdirSync(this.transfersDir, { recursive: true });
    }
  }

  getTransfersDir(): string {
    return this.transfersDir;
  }

  onTransfersChange(callback: TransferChangeCallback): () => void {
    this.changeListeners.push(callback);
    return () => {
      this.changeListeners = this.changeListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  onUploadProgress(callback: UploadProgressCallback): () => void {
    this.uploadProgressListeners.push(callback);
    return () => {
      this.uploadProgressListeners = this.uploadProgressListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  notifyUploadProgress(progress: TransferUploadProgress): void {
    this.uploadProgressListeners.forEach((cb) => cb(progress));
  }

  private notifyChange(): void {
    const transfers = this.getAll();
    this.changeListeners.forEach((cb) => cb(transfers));
  }

  getAll(): TransferItem[] {
    const transfers = this.store.get("transfers", []);
    return [...transfers].sort((a, b) => b.dateAdded - a.dateAdded);
  }

  getById(id: string): TransferItem | null {
    const transfers = this.store.get("transfers", []);
    return transfers.find((t) => t.id === id) || null;
  }

  /**
   * Record an upload sitting at `tempPath` (in the transfers folder) and move
   * it to its original name, so it's recognisable when revealed in the file
   * manager.
   */
  addTransfer(
    tempPath: string,
    originalName: string,
    fileSize: number
  ): TransferItem {
    const filePath = moveToOriginalName(tempPath, originalName);

    const ext = path.extname(originalName).toLowerCase();
    const transfer: TransferItem = {
      id: uuidv4(),
      name: path.basename(originalName, ext),
      filename: path.basename(filePath),
      path: filePath,
      dateAdded: Date.now(),
      fileSize,
      extension: ext,
    };

    const transfers = this.store.get("transfers", []);
    transfers.push(transfer);
    this.store.set("transfers", transfers);
    this.notifyChange();
    return transfer;
  }

  deleteTransfer(id: string): boolean {
    const transfers = this.store.get("transfers", []);
    const transfer = transfers.find((t) => t.id === id);
    if (!transfer) return false;

    // Remove file from disk
    if (fs.existsSync(transfer.path)) {
      fs.unlinkSync(transfer.path);
    }

    this.store.set(
      "transfers",
      transfers.filter((t) => t.id !== id)
    );
    this.notifyChange();
    return true;
  }

  /**
   * Delete the spare copies older versions left behind: transfers they copied
   * into a library rather than moving. Returns how many went.
   */
  deleteSpareCopies(): number {
    const transfers = this.store.get("transfers", []);
    const spares = transfers.filter((t) => libraryAlreadyCopiedTo(t));
    if (spares.length === 0) return 0;

    for (const spare of spares) {
      fs.rmSync(spare.path, { force: true });
    }
    this.store.set(
      "transfers",
      transfers.filter((t) => !libraryAlreadyCopiedTo(t))
    );
    this.notifyChange();
    return spares.length;
  }

  /** Drop a transfer whose file now belongs to a library, leaving the file. */
  private forget(id: string): void {
    const transfers = this.store.get("transfers", []);
    this.store.set(
      "transfers",
      transfers.filter((t) => t.id !== id)
    );
    this.notifyChange();
  }

  /**
   * Move a transfer into the library its type belongs to. The file changes
   * hands rather than being copied, so it leaves Transfers and costs no extra
   * space. Returns the new library item, or null if there's nothing to move
   * or the file doesn't belong in `library`.
   */
  async moveToLibrary(
    id: string,
    library: TransferLibrary
  ): Promise<VideoItem | AudioItem | ImageItem | null> {
    const transfer = this.getById(id);
    if (!transfer || libraryForExtension(transfer.extension) !== library) return null;

    const options = { name: transfer.name, move: true };
    const item =
      library === "video"
        ? await getVideoLibrary().addVideo(transfer.path, "upload", options)
        : library === "audio"
          ? await getAudioLibrary().addAudio(transfer.path, "upload", options)
          : await getImageLibrary().addImage(transfer.path, "upload", options);
    this.forget(id);
    return item;
  }
}

// Singleton
let instance: TransferManager | null = null;

export function getTransferManager(): TransferManager {
  if (!instance) {
    instance = new TransferManager();
  }
  return instance;
}
