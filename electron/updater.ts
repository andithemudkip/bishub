import { autoUpdater } from "electron-updater";
import type { UpdateStatus } from "../src/shared/types";

type BroadcastFn = (channel: string, data: UpdateStatus) => void;

let broadcast: BroadcastFn | null = null;

export function initUpdater(broadcastFn: BroadcastFn) {
  broadcast = broadcastFn;

  // Configure auto-updater
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    broadcast?.("update-status", {
      state: "checking",
    });
  });

  autoUpdater.on("update-available", (info) => {
    broadcast?.("update-status", {
      state: "available",
      version: info.version,
      releaseNotes:
        typeof info.releaseNotes === "string"
          ? info.releaseNotes
          : Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map((n) => n.note).join("\n")
          : undefined,
    });
  });

  autoUpdater.on("update-not-available", () => {
    broadcast?.("update-status", {
      state: "idle",
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    broadcast?.("update-status", {
      state: "downloading",
      progress: Math.round(progress.percent),
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    broadcast?.("update-status", {
      state: "ready",
      version: info.version,
      releaseNotes:
        typeof info.releaseNotes === "string"
          ? info.releaseNotes
          : Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map((n) => n.note).join("\n")
          : undefined,
    });
  });

  autoUpdater.on("error", (error) => {
    broadcast?.("update-status", {
      state: "error",
      error: error.message,
    });
  });
}

export function checkForUpdates() {
  autoUpdater.checkForUpdates().catch((error) => {
    broadcast?.("update-status", {
      state: "error",
      error: error.message,
    });
  });
}

export function quitAndInstall() {
  autoUpdater.quitAndInstall();
}
