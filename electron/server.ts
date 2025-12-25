import { app as electronApp } from "electron";
import express from "express";
import { createServer as createHttpServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { networkInterfaces } from "os";
import { createProxyMiddleware } from "http-proxy-middleware";
import type { StateManager } from "./state";
import type { WindowManager } from "./windowManager";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "../src/shared/types";
import {
  loadHymns,
  getHymnByNumber,
  formatHymnForDisplay,
  getBibleBooks,
  getBibleChapter,
  getBibleVerses,
  formatBibleVersesForDisplay,
} from "./dataLoader";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VITE_DEV_SERVER_URL =
  process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";

export function createServer(
  stateManager: StateManager,
  windowManager: WindowManager
) {
  const app = express();
  const httpServer = createHttpServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(
    httpServer,
    {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    }
  );

  const isDev = !electronApp.isPackaged;

  if (isDev) {
    // In development, proxy to Vite dev server
    const viteProxy = createProxyMiddleware({
      target: VITE_DEV_SERVER_URL,
      changeOrigin: true,
      ws: true,
    });

    // Rewrite /remote to /remote.html
    app.use("/remote", (req, res, next) => {
      if (req.path === "/" || req.path === "") {
        req.url = "/remote.html";
      }
      viteProxy(req, res, next);
    });

    // Proxy all Vite-related paths and static assets
    app.use(
      ["/@vite", "/@react-refresh", "/@fs", "/src", "/node_modules", "/.vite", "/assets"],
      viteProxy
    );
  } else {
    // Serve static files for mobile remote in production
    app.use(express.static(path.join(__dirname, "../dist")));
    app.get("/remote", (_req, res) => {
      res.sendFile(path.join(__dirname, "../dist/remote.html"));
    });
  }

  // API endpoint to get local IP addresses
  app.get("/api/ip", (_req, res) => {
    const ips = getLocalIPs();
    res.json({ ips, port: stateManager.getSettings().serverPort });
  });

  // Socket.io connection handling
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Send current state to new client
    socket.emit("stateUpdate", stateManager.getState());
    socket.emit("settingsUpdate", stateManager.getSettings());
    socket.emit("monitors", windowManager.getMonitors());

    // Mode control
    socket.on("setMode", (mode) => {
      stateManager.setMode(mode);
    });

    socket.on("goIdle", () => {
      stateManager.goIdle();
    });

    // Text mode
    socket.on("loadText", (title, content) => {
      stateManager.loadText(title, content);
    });

    socket.on("nextSlide", () => {
      stateManager.nextSlide();
    });

    socket.on("prevSlide", () => {
      stateManager.prevSlide();
    });

    socket.on("goToSlide", (index) => {
      stateManager.goToSlide(index);
    });

    // Video mode
    socket.on("loadVideo", (src) => {
      stateManager.loadVideo(src);
    });

    socket.on("playVideo", () => {
      stateManager.playVideo();
    });

    socket.on("pauseVideo", () => {
      stateManager.pauseVideo();
    });

    socket.on("stopVideo", () => {
      stateManager.stopVideo();
    });

    socket.on("seekVideo", (time) => {
      stateManager.seekVideo(time);
    });

    socket.on("setVolume", (volume) => {
      stateManager.setVolume(volume);
    });

    // Settings
    socket.on("setDisplayMonitor", (monitorId) => {
      windowManager.moveDisplayToMonitor(monitorId);
    });

    socket.on("getMonitors", () => {
      socket.emit("monitors", windowManager.getMonitors());
    });

    // Hymns
    socket.on("getHymns", () => {
      socket.emit("hymns", loadHymns());
    });

    socket.on("loadHymn", (hymnNumber) => {
      const hymn = getHymnByNumber(hymnNumber);
      if (hymn) {
        const { title, slides } = formatHymnForDisplay(hymn);
        stateManager.loadText(title, slides.join("\n\n"));
      }
    });

    // Bible
    socket.on("getBibleBooks", () => {
      socket.emit("bibleBooks", getBibleBooks());
    });

    socket.on("getBibleChapter", (bookId, chapter) => {
      socket.emit("bibleChapter", getBibleChapter(bookId, chapter));
    });

    socket.on(
      "loadBibleVerses",
      (bookId, bookName, chapter, startVerse, endVerse) => {
        const verses = getBibleVerses(bookId, chapter, startVerse, endVerse);
        if (verses.length > 0) {
          const { title, slides } = formatBibleVersesForDisplay(
            bookName,
            chapter,
            verses
          );
          stateManager.loadText(title, slides.join("\n\n"));
        }
      }
    );

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // Subscribe to state changes and broadcast to all clients
  stateManager.onStateChange((state) => {
    io.emit("stateUpdate", state);
  });

  stateManager.onSettingsChange((settings) => {
    io.emit("settingsUpdate", settings);
  });

  return httpServer;
}

function getLocalIPs(): string[] {
  const nets = networkInterfaces();
  const ips: string[] = [];

  for (const name of Object.keys(nets)) {
    const netInterfaces = nets[name];
    if (!netInterfaces) continue;

    for (const net of netInterfaces) {
      // Skip internal and non-IPv4 addresses
      if (net.family === "IPv4" && !net.internal) {
        ips.push(net.address);
      }
    }
  }

  return ips;
}
