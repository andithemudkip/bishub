// Minimal stand-in for the `electron` module, swapped in by the alias in
// vitest.config.ts. It covers what main-process modules touch at import and
// construction time; anything a test actually exercises (network, dialogs,
// windows) should be mocked explicitly in that test with vi.mock / vi.spyOn.

import fs from "fs";
import os from "os";
import path from "path";

const userData = fs.mkdtempSync(path.join(os.tmpdir(), "bishub-test-"));

export const app = {
  isPackaged: false,
  getPath(name: string): string {
    const dir = path.join(userData, name === "userData" ? "" : name);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  },
  getVersion: () => "0.0.0-test",
  getLocale: () => "ro",
  whenReady: () => Promise.resolve(),
  on: () => app,
  quit: () => {},
};

export const net = {
  request(): never {
    throw new Error("electron.net.request is not available in tests — mock it with vi.mock");
  },
};

export const ipcMain = { handle: () => {}, on: () => {}, removeHandler: () => {} };
export const shell = { openPath: async () => "", showItemInFolder: () => {} };
export const dialog = { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) };
export const screen = { getAllDisplays: () => [], getPrimaryDisplay: () => ({}) };
export class BrowserWindow {
  static getAllWindows(): BrowserWindow[] {
    return [];
  }
}

export default { app, net, ipcMain, shell, dialog, screen, BrowserWindow };
