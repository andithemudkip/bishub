import { app as electronApp } from "electron";
import express from "express";
import { createServer as createHttpServer } from "http";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { networkInterfaces } from "os";
import { createProxyMiddleware } from "http-proxy-middleware";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import type { StateManager } from "./state";
import type { WindowManager } from "./windowManager";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "../src/shared/types";
import type { Language } from "../src/shared/i18n";
import {
  loadHymns,
  getHymnByNumber,
  formatHymnForDisplay,
  getBibleBooks,
  getBibleChapter,
  getBibleVerses,
  formatBibleVersesForDisplay,
} from "./dataLoader";
import { getVideoLibrary } from "./videoLibrary";
import { startDownload, cancelDownload } from "./ytdlp";

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

  // Video Library setup
  const videoLibrary = getVideoLibrary();

  // Configure multer for video uploads (1GB limit)
  const upload = multer({
    storage: multer.diskStorage({
      destination: videoLibrary.getVideosDir(),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
      },
    }),
    limits: {
      fileSize: 1024 * 1024 * 1024, // 1GB
    },
    fileFilter: (_req, file, cb) => {
      const allowedTypes = [".mp4", ".webm", ".mov", ".avi", ".mkv"];
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, allowedTypes.includes(ext));
    },
  });

  // Video upload endpoint
  app.post("/api/videos/upload", upload.single("video"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No video file uploaded" });
      }

      const originalName = req.body.name || path.basename(
        req.file.originalname,
        path.extname(req.file.originalname)
      );

      const video = await videoLibrary.addVideo(req.file.path, "upload", {
        name: originalName,
        copyToLibrary: false, // Already in videos directory
      });

      res.json({ video, status: "complete" });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // Serve video thumbnails
  app.get("/api/videos/thumbnail/:id", (req, res) => {
    const video = videoLibrary.getById(req.params.id);
    if (video?.thumbnailPath && fs.existsSync(video.thumbnailPath)) {
      res.sendFile(video.thumbnailPath);
    } else {
      res.status(404).send("Thumbnail not found");
    }
  });

  // Stream video file (for web remote preview)
  app.get("/api/videos/file/:id", (req, res) => {
    const video = videoLibrary.getById(req.params.id);
    if (video && fs.existsSync(video.path)) {
      res.sendFile(video.path);
    } else {
      res.status(404).send("Video not found");
    }
  });

  // Broadcast video library changes to all Socket.io clients
  videoLibrary.onLibraryChange((videos) => {
    io.emit("videoLibrary", videos);
  });

  videoLibrary.onDownloadProgress((progress) => {
    io.emit("downloadProgress", progress);
  });

  videoLibrary.onUploadProgress((progress) => {
    io.emit("uploadProgress", progress);
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

    socket.on("setLanguage", (language: Language) => {
      stateManager.setLanguage(language);
    });

    // Hymns
    socket.on("getHymns", () => {
      socket.emit("hymns", loadHymns());
    });

    socket.on("loadHymn", (hymnNumber) => {
      const hymn = getHymnByNumber(hymnNumber);
      if (hymn) {
        const { title, slides } = formatHymnForDisplay(hymn);
        stateManager.loadText(title, slides.join("\n\n"), "hymn");
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
          stateManager.loadText(title, slides.join("\n\n"), "bible");
        }
      }
    );

    // Video Library
    socket.on("getVideoLibrary", () => {
      socket.emit("videoLibrary", videoLibrary.getAll());
    });

    socket.on("deleteVideo", async (videoId) => {
      await videoLibrary.deleteVideo(videoId);
    });

    socket.on("renameVideo", (videoId, newName) => {
      videoLibrary.renameVideo(videoId, newName);
    });

    socket.on("downloadYouTubeVideo", (url) => {
      startDownload(url);
    });

    socket.on("cancelDownload", (downloadId) => {
      cancelDownload(downloadId);
    });

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
