import { app, BrowserWindow, screen } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import type { MonitorInfo } from "../src/shared/types";
import type { StateManager } from "./state";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const VITE_DEV_SERVER_URL =
  process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";

export class WindowManager {
  private displayWindow: BrowserWindow | null = null;
  private remoteWindow: BrowserWindow | null = null;
  private stateManager: StateManager;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;

    // Subscribe to state changes to notify windows
    this.stateManager.onStateChange((state) => {
      this.displayWindow?.webContents.send("state-update", state);
      this.remoteWindow?.webContents.send("state-update", state);
    });

    this.stateManager.onSettingsChange((settings) => {
      this.remoteWindow?.webContents.send("settings-update", settings);
    });
  }

  getMonitors(): MonitorInfo[] {
    const displays = screen.getAllDisplays();
    return displays.map((display, index) => ({
      id: display.id,
      name: `Display ${index + 1}${
        display.bounds.x === 0 && display.bounds.y === 0 ? " (Primary)" : ""
      }`,
      bounds: display.bounds,
      isPrimary: display.bounds.x === 0 && display.bounds.y === 0,
    }));
  }

  private getSecondaryMonitor() {
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();

    // Find a non-primary display, or use primary if only one monitor
    const secondary = displays.find((d) => d.id !== primaryDisplay.id);
    return secondary || primaryDisplay;
  }

  private getDisplayMonitor() {
    const settings = this.stateManager.getSettings();
    const displays = screen.getAllDisplays();

    if (settings.displayMonitor === -1) {
      // Auto-detect: use secondary monitor
      return this.getSecondaryMonitor();
    }

    // Find specific monitor by ID
    const monitor = displays.find((d) => d.id === settings.displayMonitor);
    return monitor || this.getSecondaryMonitor();
  }

  async createDisplayWindow() {
    const monitor = this.getDisplayMonitor();

    this.displayWindow = new BrowserWindow({
      x: monitor.bounds.x,
      y: monitor.bounds.y,
      width: monitor.bounds.width,
      height: monitor.bounds.height,
      fullscreen: true,
      frame: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: false, // Allow loading local video files
      },
    });

    if (isDev && VITE_DEV_SERVER_URL) {
      await this.displayWindow.loadURL(`${VITE_DEV_SERVER_URL}/display.html`);
    } else {
      await this.displayWindow.loadFile(
        path.join(__dirname, "../dist/display.html")
      );
    }

    this.displayWindow.on("closed", () => {
      this.displayWindow = null;
    });
  }

  async createRemoteWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();

    this.remoteWindow = new BrowserWindow({
      x: primaryDisplay.bounds.x + 50,
      y: primaryDisplay.bounds.y + 50,
      width: 1024,
      height: 768,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    if (isDev && VITE_DEV_SERVER_URL) {
      await this.remoteWindow.loadURL(`${VITE_DEV_SERVER_URL}/remote.html`);
      this.remoteWindow.webContents.openDevTools();
    } else {
      await this.remoteWindow.loadFile(
        path.join(__dirname, "../dist/remote.html")
      );
    }

    this.remoteWindow.on("closed", () => {
      this.remoteWindow = null;
      // Close display window when remote is closed
      if (this.displayWindow) {
        this.displayWindow.close();
      }
    });
  }

  async moveDisplayToMonitor(monitorId: number) {
    const displays = screen.getAllDisplays();
    const monitor = displays.find((d) => d.id === monitorId);

    if (!monitor || !this.displayWindow) return;

    this.stateManager.setDisplayMonitor(monitorId);

    const displayWindow = this.displayWindow;
    const isFullScreen = displayWindow.isFullScreen();

    if (isFullScreen) {
      // Wait for fullscreen exit to complete before moving
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 1000);
        displayWindow.once("leave-full-screen", () => {
          clearTimeout(timeout);
          resolve();
        });
        displayWindow.setFullScreen(false);
      });

      // macOS needs time to settle after exiting fullscreen
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Move window to new monitor
    displayWindow.setBounds({
      x: monitor.bounds.x,
      y: monitor.bounds.y,
      width: monitor.bounds.width,
      height: monitor.bounds.height,
    });

    // Wait for bounds to be applied before going fullscreen
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Re-enter fullscreen on new monitor
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 1000);
      displayWindow.once("enter-full-screen", () => {
        clearTimeout(timeout);
        resolve();
      });
      displayWindow.setFullScreen(true);
    });
  }

  getDisplayWindow() {
    return this.displayWindow;
  }

  getRemoteWindow() {
    return this.remoteWindow;
  }

  broadcastToAll(channel: string, ...args: unknown[]) {
    this.displayWindow?.webContents.send(channel, ...args);
    this.remoteWindow?.webContents.send(channel, ...args);
  }
}
