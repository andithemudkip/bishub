import { app } from "electron";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import Store from "electron-store";
import type { TransferItem } from "../src/shared/transfer.types";

interface TransferSchema {
  transfers: TransferItem[];
  version: number;
}

type TransferChangeCallback = (transfers: TransferItem[]) => void;

export class TransferManager {
  private store: Store<TransferSchema>;
  private transfersDir: string;
  private changeListeners: TransferChangeCallback[] = [];

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

  addTransfer(
    filePath: string,
    originalName: string,
    fileSize: number
  ): TransferItem {
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

  markAddedToLibrary(id: string, library: "video" | "audio"): boolean {
    const transfers = this.store.get("transfers", []);
    const transfer = transfers.find((t) => t.id === id);
    if (!transfer) return false;

    if (library === "video") transfer.addedToVideo = true;
    else transfer.addedToAudio = true;

    this.store.set("transfers", transfers);
    this.notifyChange();
    return true;
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
