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
  resolveHymnDisplay,
  getBibleBooks,
  getBibleChapter,
  formatBibleChapterForDisplay,
  searchBibleVerses,
} from "./dataLoader";
import {
  downloadMP3,
  downloadAllMissingMP3s,
  cancelMP3Download,
  cancelAllMP3Downloads,
  clearMP3Cache,
  getMP3CacheStats,
  onMP3DownloadProgress,
  onHymnAssetsUpdated,
} from "./hymnAssets";
import {
  isTranslationDownloaded,
  downloadTranslation,
  getDownloadedTranslationIds,
} from "./bibleManager";
import { getTranslationById } from "../src/shared/bibleTranslations";
import { getVideoLibrary } from "./videoLibrary";
import { getAudioLibrary } from "./audioLibrary";
import { getImageLibrary } from "./imageLibrary";
import { IMAGE_EXTENSIONS } from "../src/shared/imageLibrary.types";
import { getAudioScheduler } from "./audioScheduler";
import { getTransferManager } from "./transferManager";
import { startDownload, startAudioDownload, cancelDownload } from "./ytdlp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VITE_DEV_SERVER_URL =
  process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";

// Track server instances for cleanup
let httpServerInstance: ReturnType<typeof createHttpServer> | null = null;
let ioInstance: Server<ClientToServerEvents, ServerToClientEvents> | null = null;

export function createServer(
  stateManager: StateManager,
  windowManager: WindowManager
) {
  const app = express();
  app.use(express.json());
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

  // Store references for cleanup
  httpServerInstance = httpServer;
  ioInstance = io;

  const isDev = !electronApp.isPackaged;
  const securityKey = stateManager.getSecurityKey();

  // Middleware to validate security key for web remote access
  const validateSecurityKey = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const key = req.query.key as string;
    if (key !== securityKey) {
      return res.status(403).send("Access denied: Invalid security key");
    }
    next();
  };

  // Socket.io authentication middleware
  io.use((socket, next) => {
    const key = socket.handshake.auth.key || socket.handshake.query.key;
    if (key === securityKey) {
      next();
    } else {
      console.log("Socket.io connection rejected: invalid security key");
      next(new Error("Invalid security key"));
    }
  });

  if (isDev) {
    // In development, proxy to Vite dev server
    const viteProxy = createProxyMiddleware({
      target: VITE_DEV_SERVER_URL,
      changeOrigin: true,
      ws: true,
    });

    // Rewrite /remote to /remote.html (with security key validation)
    app.use("/remote", validateSecurityKey, (req, res, next) => {
      if (req.path === "/" || req.path === "") {
        req.url = "/remote.html";
      }
      viteProxy(req, res, next);
    });

    // Proxy all Vite-related paths and static assets
    app.use(
      [
        "/@vite",
        "/@react-refresh",
        "/@fs",
        "/src",
        "/node_modules",
        "/.vite",
        "/assets",
      ],
      viteProxy
    );
  } else {
    // Serve static files for mobile remote in production
    app.use(express.static(path.join(__dirname, "../dist")));
    app.get("/remote", validateSecurityKey, (_req, res) => {
      res.sendFile(path.join(__dirname, "../dist/remote.html"));
    });
  }

  // Apply security key validation to all API routes
  app.use("/api", validateSecurityKey);

  // API endpoint to get local IP addresses
  app.get("/api/ip", (_req, res) => {
    const ips = getLocalIPs();
    res.json({ ips, port: stateManager.getSettings().serverPort });
  });

  app.get("/api/version", (_req, res) => {
    res.json({ version: electronApp.getVersion() });
  });

  // Helper to create multer upload middleware
  const createUploadMiddleware = (
    destDir: string,
    allowedTypes: string[],
    maxSizeBytes: number,
  ) =>
    multer({
      storage: multer.diskStorage({
        destination: destDir,
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, `${uuidv4()}${ext}`);
        },
      }),
      limits: { fileSize: maxSizeBytes },
      fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowedTypes.includes(ext));
      },
    });

  // Video Library setup
  const videoLibrary = getVideoLibrary();
  const upload = createUploadMiddleware(
    videoLibrary.getVideosDir(),
    [".mp4", ".webm", ".mov", ".avi", ".mkv"],
    1024 * 1024 * 1024, // 1GB
  );

  // Video upload endpoint
  app.post("/api/videos/upload", upload.single("video"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No video file uploaded" });
      }

      const originalName =
        req.body.name ||
        path.basename(
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

  onMP3DownloadProgress((progress) => {
    io.emit("mp3DownloadProgress", progress);
  });
  onHymnAssetsUpdated(() => {
    const language = stateManager.getSettings().language;
    io.emit("hymns", loadHymns(language));
    io.emit("mp3CacheStats", getMP3CacheStats());
  });

  // Audio Library setup
  const audioLibrary = getAudioLibrary();

  const audioUpload = createUploadMiddleware(
    audioLibrary.getAudiosDir(),
    [".mp3", ".wav", ".ogg", ".m4a", ".flac"],
    500 * 1024 * 1024, // 500MB
  );

  // Audio upload endpoint
  app.post(
    "/api/audio/upload",
    audioUpload.single("audio"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No audio file uploaded" });
        }

        const originalName =
          req.body.name ||
          path.basename(
            req.file.originalname,
            path.extname(req.file.originalname)
          );

        const audio = await audioLibrary.addAudio(req.file.path, "upload", {
          name: originalName,
          copyToLibrary: false, // Already in audios directory
        });

        res.json({ audio, status: "complete" });
      } catch (error) {
        console.error("Audio upload error:", error);
        res.status(500).json({ error: "Upload failed" });
      }
    }
  );

  // Stream audio file (for web remote)
  app.get("/api/audio/file/:id", (req, res) => {
    const audio = audioLibrary.getById(req.params.id);
    if (audio && fs.existsSync(audio.path)) {
      res.sendFile(audio.path);
    } else {
      res.status(404).send("Audio not found");
    }
  });

  // Broadcast audio library changes to all Socket.io clients
  audioLibrary.onLibraryChange((audios) => {
    io.emit("audioLibrary", audios);
  });

  audioLibrary.onUploadProgress((progress) => {
    io.emit("audioUploadProgress", progress);
  });

  audioLibrary.onDownloadProgress((progress) => {
    io.emit("audioDownloadProgress", progress);
  });

  // Image Library setup
  const imageLibrary = getImageLibrary();

  const imageUpload = createUploadMiddleware(
    imageLibrary.getImagesDir(),
    IMAGE_EXTENSIONS,
    100 * 1024 * 1024, // 100MB
  );

  app.post(
    "/api/images/upload",
    imageUpload.single("image"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No image file uploaded" });
        }

        const originalName =
          req.body.name ||
          path.basename(
            req.file.originalname,
            path.extname(req.file.originalname)
          );

        const image = await imageLibrary.addImage(req.file.path, "upload", {
          name: originalName,
          copyToLibrary: false,
        });

        res.json({ image, status: "complete" });
      } catch (error) {
        console.error("Image upload error:", error);
        res.status(500).json({ error: "Upload failed" });
      }
    }
  );

  app.get("/api/images/thumbnail/:id", (req, res) => {
    const image = imageLibrary.getById(req.params.id);
    if (image?.thumbnailPath && fs.existsSync(image.thumbnailPath)) {
      res.sendFile(image.thumbnailPath);
    } else {
      res.status(404).send("Thumbnail not found");
    }
  });

  app.get("/api/images/file/:id", (req, res) => {
    const image = imageLibrary.getById(req.params.id);
    if (image && fs.existsSync(image.path)) {
      res.sendFile(image.path);
    } else {
      res.status(404).send("Image not found");
    }
  });

  imageLibrary.onLibraryChange((images) => {
    io.emit("imageLibrary", images);
  });

  imageLibrary.onSlideshowsChange((slideshows) => {
    io.emit("slideshows", slideshows);
  });

  imageLibrary.onUploadProgress((progress) => {
    io.emit("imageUploadProgress", progress);
  });

  // File Transfers setup
  const transferManager = getTransferManager();

  const transferUpload = multer({
    storage: multer.diskStorage({
      destination: transferManager.getTransfersDir(),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
      },
    }),
    limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB
  });

  app.post(
    "/api/transfers/upload",
    transferUpload.single("file"),
    (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        const originalName = req.file.originalname;
        const transfer = transferManager.addTransfer(
          req.file.path,
          originalName,
          req.file.size
        );

        res.json({ transfer, status: "complete" });
      } catch (error) {
        console.error("Transfer upload error:", error);
        res.status(500).json({ error: "Upload failed" });
      }
    }
  );

  app.post("/api/transfers/delete", (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "Missing id" });
    const ok = transferManager.deleteTransfer(id);
    res.json({ success: ok });
  });

  app.post("/api/transfers/add-to-video", async (req, res) => {
    try {
      const { id } = req.body;
      const transfer = transferManager.getById(id);
      if (!transfer) return res.status(404).json({ error: "Transfer not found" });

      const video = await videoLibrary.addVideo(transfer.path, "upload", {
        name: transfer.name,
        copyToLibrary: true,
      });
      transferManager.markAddedToLibrary(id, "video");
      res.json({ video });
    } catch (error) {
      console.error("Add to video error:", error);
      res.status(500).json({ error: "Failed to add to video library" });
    }
  });

  app.post("/api/transfers/add-to-audio", async (req, res) => {
    try {
      const { id } = req.body;
      const transfer = transferManager.getById(id);
      if (!transfer) return res.status(404).json({ error: "Transfer not found" });

      const audio = await audioLibrary.addAudio(transfer.path, "upload", {
        name: transfer.name,
        copyToLibrary: true,
      });
      transferManager.markAddedToLibrary(id, "audio");
      res.json({ audio });
    } catch (error) {
      console.error("Add to audio error:", error);
      res.status(500).json({ error: "Failed to add to audio library" });
    }
  });

  app.post("/api/transfers/add-to-image", async (req, res) => {
    try {
      const { id } = req.body;
      const transfer = transferManager.getById(id);
      if (!transfer) return res.status(404).json({ error: "Transfer not found" });

      const image = await imageLibrary.addImage(transfer.path, "upload", {
        name: transfer.name,
        copyToLibrary: true,
      });
      transferManager.markAddedToLibrary(id, "image");
      res.json({ image });
    } catch (error) {
      console.error("Add to image error:", error);
      res.status(500).json({ error: "Failed to add to image library" });
    }
  });

  transferManager.onTransfersChange((transfers) => {
    io.emit("transfers", transfers);
  });

  windowManager.onMonitorsChange((monitors) => {
    io.emit("monitors", monitors);
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
    socket.on("loadVideo", (src, videoId) => {
      stateManager.loadVideo(src, videoId);
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

    socket.on("setSyncedLyrics", (enabled: boolean) => {
      stateManager.setSyncedLyrics(enabled);
    });

    // Hymns
    socket.on("getHymns", () => {
      socket.emit("hymns", loadHymns());
    });

    socket.on("loadHymn", (hymnNumber, synced?) => {
      const useSynced = synced ?? stateManager.getSettings().syncedLyrics;
      const language = stateManager.getSettings().language;
      const resolved = resolveHymnDisplay(hymnNumber, useSynced, language);
      if (!resolved) return;
      if (resolved.kind === "synced") {
        stateManager.loadSyncedHymn(
          resolved.title,
          resolved.slides,
          resolved.ttml,
          resolved.audioPath,
        );
      } else {
        stateManager.loadText(
          resolved.title,
          resolved.slides.join("\n\n"),
          "hymn",
        );
      }
    });

    socket.on("downloadHymnMP3", (hymnNumber) => {
      downloadMP3(hymnNumber).catch(() => {});
    });
    socket.on("downloadAllHymnMP3s", () => {
      downloadAllMissingMP3s().catch(() => {});
    });
    socket.on("cancelHymnMP3Download", (hymnNumber) => {
      cancelMP3Download(hymnNumber);
    });
    socket.on("cancelAllHymnMP3Downloads", () => {
      cancelAllMP3Downloads();
    });
    socket.on("clearHymnMP3Cache", () => {
      clearMP3Cache();
    });
    socket.on("getHymnMP3CacheStats", () => {
      socket.emit("mp3CacheStats", getMP3CacheStats());
    });
    socket.on("setKaraokeBannerDismissed", (dismissed) => {
      stateManager.setKaraokeBannerDismissed(dismissed);
    });

    // Bible
    socket.on("getBibleBooks", () => {
      const translationId = stateManager.getSettings().bibleTranslation;
      socket.emit("bibleBooks", getBibleBooks(translationId));
    });

    socket.on("getBibleChapter", (bookId, chapter) => {
      const translationId = stateManager.getSettings().bibleTranslation;
      socket.emit("bibleChapter", getBibleChapter(bookId, chapter, translationId));
    });

    socket.on(
      "loadBibleVerses",
      (bookId, bookName, chapter, startVerse, _endVerse) => {
        const translationId = stateManager.getSettings().bibleTranslation;
        const allVerses = getBibleChapter(bookId, chapter, translationId);
        if (allVerses.length > 0) {
          const { title, slides, startIndex, bibleContext } =
            formatBibleChapterForDisplay(
              bookId,
              bookName,
              chapter,
              allVerses,
              startVerse,
              translationId
            );
          stateManager.loadBibleChapter(
            title,
            slides,
            startIndex,
            bibleContext
          );
        }
      }
    );

    socket.on("searchBibleVerses", (query) => {
      const translationId = stateManager.getSettings().bibleTranslation;
      const results = searchBibleVerses(query, translationId);
      socket.emit("bibleSearchResults", results);
    });

    socket.on("setBibleTranslation", async (translationId) => {
      const info = getTranslationById(translationId);
      if (!info) return;

      if (!isTranslationDownloaded(translationId)) {
        socket.emit("bibleTranslationStatus", {
          translationId,
          status: "downloading",
          progress: 0,
        });
        try {
          await downloadTranslation(translationId, (progress) => {
            socket.emit("bibleTranslationStatus", {
              translationId,
              status: "downloading",
              progress,
            });
          });
        } catch (err) {
          socket.emit("bibleTranslationStatus", {
            translationId,
            status: "error",
            error: String(err),
          });
          return;
        }
      }

      stateManager.setBibleTranslation(translationId);
      socket.emit("bibleTranslationStatus", {
        translationId,
        status: "ready",
      });
      // Send updated books for the new translation
      socket.emit("bibleBooks", getBibleBooks(translationId));
      // Send updated downloaded list
      socket.emit("downloadedTranslations", getDownloadedTranslationIds());
    });

    socket.on("getDownloadedTranslations", () => {
      socket.emit("downloadedTranslations", getDownloadedTranslationIds());
    });

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

    // Audio Library
    socket.on("getAudioLibrary", () => {
      socket.emit("audioLibrary", audioLibrary.getAll());
    });

    socket.on("deleteAudio", async (audioId) => {
      await audioLibrary.deleteAudio(audioId);
    });

    socket.on("renameAudio", (audioId, newName) => {
      audioLibrary.renameAudio(audioId, newName);
    });

    socket.on("downloadYouTubeAudio", (url) => {
      startAudioDownload(url);
    });

    socket.on("cancelAudioDownload", (downloadId) => {
      cancelDownload(downloadId);
    });

    // Audio playback
    socket.on("loadAudio", (src, name) => {
      stateManager.loadAudio(src, name);
    });

    socket.on("playAudio", () => {
      stateManager.playAudio();
    });

    socket.on("pauseAudio", () => {
      stateManager.pauseAudio();
    });

    socket.on("stopAudio", () => {
      stateManager.stopAudio();
    });

    socket.on("seekAudio", (time) => {
      stateManager.seekAudio(time);
    });

    socket.on("setAudioVolume", (volume) => {
      stateManager.setAudioVolume(volume);
    });

    // Audio Scheduling
    socket.on("getAudioSchedules", () => {
      socket.emit("audioSchedules", getAudioScheduler()?.getSchedules() || []);
    });

    socket.on("getAudioPresets", () => {
      socket.emit("audioPresets", getAudioScheduler()?.getPresets() || []);
    });

    socket.on("createAudioSchedule", (params) => {
      getAudioScheduler()?.createSchedule({
        ...params,
        absoluteTime: params.absoluteTime
          ? new Date(params.absoluteTime)
          : undefined,
      });
    });

    socket.on("cancelAudioSchedule", (scheduleId) => {
      getAudioScheduler()?.cancelSchedule(scheduleId);
    });

    socket.on("createAudioPreset", (params) => {
      getAudioScheduler()?.createPreset(params);
    });

    socket.on("activateAudioPreset", (presetId, audioPath) => {
      getAudioScheduler()?.activatePreset(presetId, audioPath);
    });

    socket.on("deleteAudioPreset", (presetId) => {
      getAudioScheduler()?.deletePreset(presetId);
    });

    // Image Library
    socket.on("getImageLibrary", () => {
      socket.emit("imageLibrary", imageLibrary.getAll());
    });

    socket.on("getSlideshows", () => {
      socket.emit("slideshows", imageLibrary.getAllSlideshows());
    });

    socket.on("deleteImage", async (imageId) => {
      await imageLibrary.deleteImage(imageId);
    });

    socket.on("renameImage", (imageId, newName) => {
      imageLibrary.renameImage(imageId, newName);
    });

    socket.on("createSlideshow", (name, imageIds) => {
      imageLibrary.createSlideshow(name, imageIds);
    });

    socket.on("updateSlideshow", (slideshowId, updates) => {
      imageLibrary.updateSlideshow(slideshowId, updates);
    });

    socket.on("deleteSlideshow", (slideshowId) => {
      imageLibrary.deleteSlideshow(slideshowId);
    });

    socket.on("addImagesToSlideshow", (slideshowId, imageIds) => {
      imageLibrary.addImagesToSlideshow(slideshowId, imageIds);
    });

    socket.on("removeImageFromSlideshow", (imageId) => {
      imageLibrary.removeImageFromSlideshow(imageId);
    });

    socket.on("reorderSlideshowImages", (slideshowId, orderedImageIds) => {
      imageLibrary.reorderSlideshowImages(slideshowId, orderedImageIds);
    });

    // Image presentation
    socket.on("loadImage", (src, imageId) => {
      stateManager.loadImage(src, imageId);
    });

    socket.on("loadSlideshow", (slideshowId) => {
      const data = imageLibrary.getSlideshowPresentationData(slideshowId);
      if (data) stateManager.loadSlideshow(data.images, data.slideshowId, data.settings);
    });

    socket.on("nextImage", () => {
      stateManager.nextImage();
    });

    socket.on("prevImage", () => {
      stateManager.prevImage();
    });

    socket.on("goToImage", (index) => {
      stateManager.goToImage(index);
    });

    socket.on("setImageAutoAdvance", (enabled) => {
      stateManager.setImageAutoAdvance(enabled);
    });

    socket.on("setImageFit", (fit) => {
      stateManager.setImageFit(fit);
    });

    socket.on("setImageLoop", (loop) => {
      stateManager.setImageLoop(loop);
    });

    socket.on("setImageAutoAdvanceInterval", (intervalMs) => {
      stateManager.setImageAutoAdvanceInterval(intervalMs);
    });

    // File Transfers
    socket.on("getTransfers", () => {
      socket.emit("transfers", transferManager.getAll());
    });

    // Idle
    socket.on("setClockFontSize", (size) => {
      stateManager.setClockFontSize(size);
    });

    socket.on("setClockPosition", (position) => {
      stateManager.setClockPosition(position);
    });

    socket.on("setAudioWidgetPosition", (position) => {
      stateManager.setAudioWidgetPosition(position);
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

  // Subscribe to audio scheduler changes
  const scheduler = getAudioScheduler();
  if (scheduler) {
    scheduler.onScheduleChange((schedules) => {
      io.emit("audioSchedules", schedules);
    });
    scheduler.onPresetChange((presets) => {
      io.emit("audioPresets", presets);
    });
    scheduler.onScheduleEvent((event) => {
      io.emit("audioScheduleEvent", event);
    });
  }

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

export function closeServer(): Promise<void> {
  return new Promise((resolve) => {
    if (ioInstance) {
      ioInstance.disconnectSockets(true);
      ioInstance.close();
      ioInstance = null;
    }
    if (httpServerInstance) {
      httpServerInstance.close(() => {
        httpServerInstance = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}
