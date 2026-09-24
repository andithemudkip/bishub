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
  ChromeSizeKey,
} from "../src/shared/types";
import type { Language } from "../src/shared/i18n";
import {
  loadHymns,
  searchAllHymns,
  getBibleBooks,
  getBibleChapter,
  formatBibleChapterForDisplay,
  searchBibleVerses,
} from "./dataLoader";
import { presentHymn, resolveHymnalSlug } from "./hymnPresenter";
import {
  commitHymn,
  deleteCustomHymn,
  parseDeckBuffer,
  MAX_IMPORT_FILES,
} from "./hymnImporter";
import { MAX_PPTX_BYTES } from "./pptxParser";
import {
  getHymnals,
  isValidHymnalSlug,
  onHymnalsChange,
} from "./hymnalRegistry";
import {
  downloadMP3,
  downloadAllMissingMP3s,
  cancelMP3Download,
  cancelAllMP3Downloads,
  clearMP3Cache,
  getMP3CacheStats,
  getActiveMP3Downloads,
  onMP3DownloadProgress,
  onHymnAssetsUpdated,
} from "./hymnAssets";
import {
  ensureTranslationDownloaded,
  getDownloadedTranslationIds,
  onTranslationStatus,
} from "./bibleManager";
import { getTranslationById } from "../src/shared/bibleTranslations";
import { getVideoLibrary } from "./videoLibrary";
import { getAudioLibrary } from "./audioLibrary";
import { getAudioPlaylists } from "./audioPlaylists";
import { getImageLibrary } from "./imageLibrary";
import { IMAGE_EXTENSIONS } from "../src/shared/imageLibrary.types";
import { getAudioScheduler } from "./audioScheduler";
import { getTransferManager } from "./transferManager";
import { quickSearch } from "./quickSearch";
import {
  startDownload,
  startAudioDownload,
  cancelDownload,
  getActiveDownloads,
  getActiveAudioDownloads,
} from "./ytdlp";
import { getDeviceRegistry } from "./deviceRegistry";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VITE_DEV_SERVER_URL =
  process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";

interface BishubSocketData {
  deviceId?: string;
}

// Track server instances for cleanup
let httpServerInstance: ReturnType<typeof createHttpServer> | null = null;
let ioInstance: Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  BishubSocketData
> | null = null;

export function createServer(
  stateManager: StateManager,
  windowManager: WindowManager
) {
  const app = express();
  app.use(express.json());
  const httpServer = createHttpServer(app);
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    BishubSocketData
  >(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Store references for cleanup
  httpServerInstance = httpServer;
  ioInstance = io;

  const isDev = !electronApp.isPackaged;
  const securityKey = stateManager.getSecurityKey();
  const deviceRegistry = getDeviceRegistry();

  // Accepts either a valid device token or the rotating pairing key.
  // Used for all /api/* routes (except /api/pair, which requires the pairing key).
  const validateAuth = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const token = req.query.token as string | undefined;
    if (token && deviceRegistry.getByToken(token)) {
      next();
      return;
    }
    const key = req.query.key as string | undefined;
    if (key === securityKey) {
      next();
      return;
    }
    return res.status(403).send("Access denied");
  };

  // Pairing-key-only middleware — prevents tokens from bootstrapping new tokens.
  const validatePairingKey = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const key = req.query.key as string | undefined;
    if (key !== securityKey) {
      return res.status(403).send("Access denied: Invalid pairing key");
    }
    next();
  };

  // Socket.io authentication middleware — device tokens only.
  // Web remotes exchange the pairing key for a token via POST /api/pair first.
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (token) {
      const device = deviceRegistry.getByToken(token);
      if (device) {
        socket.data.deviceId = device.id;
        deviceRegistry.updateLastSeen(device.id);
        socket.join(`device:${device.id}`);
        next();
        return;
      }
    }
    console.log("Socket.io connection rejected: invalid token");
    next(new Error("Invalid token"));
  });

  if (isDev) {
    // In development, proxy to Vite dev server
    const viteProxy = createProxyMiddleware({
      target: VITE_DEV_SERVER_URL,
      changeOrigin: true,
      ws: true,
      // With `ws`, the proxy subscribes to *every* upgrade on this server —
      // the `app.use` paths below don't apply to upgrades. Socket.io's own
      // upgrades must stay here: forwarded to Vite, they come straight back
      // through Vite's /socket.io proxy, and loop until connect() fails with
      // EAGAIN.
      pathFilter: (pathname) => !pathname.startsWith("/socket.io"),
    });

    // /remote is unauthenticated — the HTML shell is inert without a valid
    // device token. The client JS runs the pairing handshake against
    // /api/pair (which validates the pairing key) and falls back to the
    // AccessDenied page when no credentials are present.
    app.use("/remote", (req, res, next) => {
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
    app.get("/remote", (_req, res) => {
      res.sendFile(path.join(__dirname, "../dist/remote.html"));
    });
  }

  // Pairing: exchange the rotating pairing key for a long-lived device token.
  app.post("/api/pair", validatePairingKey, (req, res) => {
    const userAgentHeader = req.headers["user-agent"] || "";
    const bodyUserAgent =
      typeof req.body?.userAgent === "string" ? req.body.userAgent : "";
    const userAgent = bodyUserAgent || userAgentHeader;
    const { device, token } = deviceRegistry.createDevice(userAgent);
    res.json({ token, deviceId: device.id, name: device.name });
  });

  // Apply auth validation to all other API routes (token or pairing key).
  app.use("/api", validateAuth);

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

  /**
   * Upload byte progress, reported by the server so every device — not just
   * the one sending — sees an upload, and it survives navigation on the
   * sender. Rides the library's existing upload-progress channel, which
   * already fans out to both transports.
   *
   * The client passes its own `uploadId` and the `filename` in the query
   * string: multer hasn't parsed the multipart body when this runs, and the
   * matching id lets the sender hide the server's row while its own, more
   * immediate progress bar is still showing.
   */
  interface TrackedUpload {
    id: string;
    filename: string;
    status: "uploading" | "processing" | "complete" | "error";
    progress: number;
    error?: string;
  }
  type UploadEvent =
    | "uploadProgress"
    | "audioUploadProgress"
    | "imageUploadProgress"
    | "transferUploadProgress";
  /** In-flight uploads, replayed to sockets that connect mid-upload. */
  const activeUploads = new Map<string, { upload: TrackedUpload; event: UploadEvent }>();

  const trackUploadProgress =
    (event: UploadEvent, notify: (upload: TrackedUpload) => void): express.RequestHandler =>
    (req, res, next) => {
      const id =
        typeof req.query.uploadId === "string" && req.query.uploadId
          ? req.query.uploadId
          : uuidv4();
      const filename = typeof req.query.filename === "string" ? req.query.filename : "";
      const total = Number(req.headers["content-length"]) || 0;
      const upload: TrackedUpload = { id, filename, status: "uploading", progress: 0 };
      activeUploads.set(id, { upload, event });

      const emit = (patch: Partial<TrackedUpload>) => {
        Object.assign(upload, patch);
        notify({ ...upload });
      };
      let settled = false;
      const settle = (patch: Partial<TrackedUpload>) => {
        if (settled) return;
        settled = true;
        activeUploads.delete(id);
        emit(patch);
      };

      emit({});
      // multer pipes `req` synchronously inside next(); counting bytes only
      // after that means this listener can never start the stream flowing
      // before the parser is attached.
      next();
      let received = 0;
      req.on("data", (chunk: Buffer) => {
        received += chunk.length;
        const percent = total > 0 ? Math.min(99, Math.floor((received / total) * 100)) : 0;
        if (percent !== upload.progress) emit({ progress: percent });
      });
      req.on("end", () => {
        if (!settled) emit({ status: "processing", progress: 100 });
      });
      res.on("finish", () =>
        settle(
          res.statusCode < 400
            ? { status: "complete", progress: 100 }
            : { status: "error", error: "Upload failed" }
        )
      );
      // Fires after "finish" on success (no-op then); alone, it means the
      // sender disconnected mid-upload.
      res.on("close", () => settle({ status: "error", error: "Upload aborted" }));
    };

  // Video Library setup
  const videoLibrary = getVideoLibrary();
  const upload = createUploadMiddleware(
    videoLibrary.getVideosDir(),
    [".mp4", ".webm", ".mov", ".avi", ".mkv"],
    1024 * 1024 * 1024, // 1GB
  );

  // Video upload endpoint
  app.post(
    "/api/videos/upload",
    trackUploadProgress("uploadProgress", (u) => videoLibrary.notifyUploadProgress(u)),
    upload.single("video"),
    async (req, res) => {
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
    }
  );

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

  // The book list changes whenever a user book is created, filled or removed.
  onHymnalsChange((hymnals, slug) => {
    io.emit("hymnals", hymnals);
    // The book's contents changed too, not just its songCount — a client with
    // that book open would otherwise keep showing the pre-import list.
    io.emit("hymns", slug, loadHymns(slug));
  });

  /**
   * Hymn import — the web half of the native picker in main.ts.
   *
   * Bytes are held in memory and never written to disk: we keep the extracted
   * text, never the .pptx, and a buffer cannot leave a stray file behind when
   * parsing throws. The cap is the parser's own, so nothing is accepted here
   * that parsePptx would then refuse.
   */
  const deckUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PPTX_BYTES, files: MAX_IMPORT_FILES },
    fileFilter: (_req, file, cb) => {
      // Extension only. The client-sent MIME type is not evidence and is never
      // consulted — what the bytes actually are is settled by parsePptx, which
      // reads the magic number and tells a .pptx, a legacy binary .ppt and
      // "not a zip at all" apart, each with its own reason code.
      cb(null, path.extname(file.originalname).toLowerCase() === ".pptx");
    },
  });

  app.post("/api/hymns/import", (req, res) => {
    deckUpload.array("decks", MAX_IMPORT_FILES)(req, res, (err: unknown) => {
      if (err) {
        // Multer reports an oversized file as an error rather than as a
        // rejected file, so it lands here rather than in fileFilter.
        const tooLarge =
          err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE";
        return res
          .status(400)
          .json({ error: "Upload failed", reason: tooLarge ? "too-large" : "not-a-pptx" });
      }

      const files = Array.isArray(req.files) ? req.files : [];
      if (files.length === 0) {
        // Either nothing was sent, or fileFilter dropped everything for not
        // being a .pptx — same message, since the client knows what it sent.
        return res.status(400).json({ error: "No .pptx file uploaded" });
      }

      res.json({
        results: files.map((file) =>
          parseDeckBuffer(file.originalname, file.buffer)
        ),
      });
    });
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
    const slug = resolveHymnalSlug(stateManager);
    io.emit("hymns", slug, loadHymns(slug));
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
    trackUploadProgress("audioUploadProgress", (u) => audioLibrary.notifyUploadProgress(u)),
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

  // Audio Playlists + Up Next queue — broadcast only; the sync-live-queue
  // side effect is wired once in electron/main.ts to avoid double-firing.
  const audioPlaylists = getAudioPlaylists();

  audioPlaylists.onPlaylistsChange((playlists) => {
    io.emit("audioPlaylists", playlists);
  });

  audioPlaylists.onQueueChange((audioIds) => {
    io.emit("audioQueue", audioIds);
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
    trackUploadProgress("imageUploadProgress", (u) => imageLibrary.notifyUploadProgress(u)),
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
    trackUploadProgress("transferUploadProgress", (u) => transferManager.notifyUploadProgress(u)),
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

  transferManager.onUploadProgress((progress) => {
    io.emit("transferUploadProgress", progress);
  });

  onTranslationStatus((status) => {
    io.emit("bibleTranslationStatus", status);
  });

  transferManager.onTransfersChange((transfers) => {
    io.emit("transfers", transfers);
  });

  windowManager.onMonitorsChange((monitors) => {
    io.emit("monitors", monitors);
  });

  windowManager.onDisplayWindowChange((open) => {
    io.emit("displayWindowState", open);
  });

  const broadcastConnectedDeviceIds = () => {
    const ids = new Set<string>();
    for (const sock of io.sockets.sockets.values()) {
      if (sock.data.deviceId) ids.add(sock.data.deviceId);
    }
    const list = [...ids];
    io.emit("connectedDeviceIds", list);
    windowManager.broadcastToAll("connected-devices-update", list);
  };

  deviceRegistry.onDevicesChange((devices) => {
    io.emit("devices", devices);
    windowManager.broadcastToAll("devices-update", devices);
  });

  deviceRegistry.onRevoke((deviceId) => {
    io.in(`device:${deviceId}`).disconnectSockets(true);
  });

  // Socket.io connection handling
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id, "device:", socket.data.deviceId);
    broadcastConnectedDeviceIds();

    // Hooks share one socket per tab and can mount after it connected, so
    // anything a client needs on arrival is a request, not a push here — a
    // push would reach only the handlers attached at the moment of connect.
    socket.on("getState", () => {
      socket.emit("stateUpdate", stateManager.getState());
      socket.emit("settingsUpdate", stateManager.getSettings());
    });

    socket.on("getDisplayWindowState", () => {
      socket.emit("displayWindowState", windowManager.isDisplayWindowOpen());
    });

    // In-flight work, so a remote that connects (or reloads) mid-operation
    // sees it. The Electron remote fetches the same via getActive*Downloads.
    socket.on("getInFlight", () => {
      for (const p of getActiveDownloads()) socket.emit("downloadProgress", p);
      for (const p of getActiveAudioDownloads()) socket.emit("audioDownloadProgress", p);
      for (const p of getActiveMP3Downloads()) socket.emit("mp3DownloadProgress", p);
      for (const { upload, event } of activeUploads.values()) {
        socket.emit(event, { ...upload });
      }
    });

    // Devices
    socket.on("getDevices", () => {
      socket.emit("devices", deviceRegistry.getAll());
    });
    socket.on("renameDevice", (deviceId, name) => {
      deviceRegistry.rename(deviceId, name);
    });
    socket.on("revokeDevice", (deviceId) => {
      deviceRegistry.revoke(deviceId);
    });

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

    socket.on("clearLayer", (kind) => {
      stateManager.clearLayer(kind);
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

    socket.on("getHymnals", () => {
      socket.emit("hymnals", getHymnals());
    });

    socket.on("setLanguage", (language: Language) => {
      stateManager.setLanguage(language);
    });

    socket.on("setSyncedLyrics", (enabled: boolean) => {
      stateManager.setSyncedLyrics(enabled);
    });

    socket.on("setInstrumentals", (enabled: boolean) => {
      stateManager.setInstrumentals(enabled);
    });

    socket.on("setChromeSize", (key: ChromeSizeKey, size: number) => {
      stateManager.setChromeSize(key, size);
    });

    socket.on("setSlideBackground", (from: string, to: string) => {
      stateManager.setSlideBackground(from, to);
    });

    socket.on(
      "setBibleBackground",
      (enabled: boolean, from: string, to: string) => {
        stateManager.setBibleBackground(enabled, from, to);
      },
    );

    // Hymns
    socket.on("getHymns", (slug) => {
      const resolved = resolveHymnalSlug(stateManager, slug);
      socket.emit("hymns", resolved, loadHymns(resolved));
    });

    socket.on("loadHymn", (slug, hymnNumber, playbackMode?) => {
      presentHymn(
        stateManager,
        resolveHymnalSlug(stateManager, slug),
        hymnNumber,
        playbackMode,
      );
    });

    socket.on("searchAllHymns", (query) => {
      socket.emit("hymnSearchResults", searchAllHymns(query));
    });

    socket.on("quickSearch", (query) => {
      const settings = stateManager.getSettings();
      socket.emit(
        "quickSearchResults",
        quickSearch(query, settings.language, settings.bibleTranslation, settings.hymnal)
      );
    });

    socket.on("setHymnal", (slug) => {
      if (isValidHymnalSlug(slug)) stateManager.setHymnal(slug);
    });

    // Import commit/delete. Parsing is not here — a deck arrives over HTTP at
    // /api/hymns/import above. Both call the same hymnImporter functions the
    // IPC handlers in main.ts do; the updated book list and hymns reach every
    // client through onHymnalsChange, so only the outcome goes back to the
    // socket that asked.
    socket.on("commitHymnImport", (hymn, fileName) => {
      socket.emit(
        "hymnImportCommitted",
        commitHymn(hymn, stateManager.getSettings().language, fileName),
      );
    });

    socket.on("deleteCustomHymn", (slug, hymnNumber) => {
      socket.emit(
        "customHymnDeleted",
        slug,
        hymnNumber,
        deleteCustomHymn(slug, hymnNumber),
      );
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

      // Download progress (and failure) is broadcast to everyone by
      // `onTranslationStatus` below.
      try {
        await ensureTranslationDownloaded(translationId);
      } catch {
        return;
      }

      stateManager.setBibleTranslation(translationId);
      // Already-downloaded translations broadcast nothing, so the requester
      // still needs its own "ready".
      socket.emit("bibleTranslationStatus", {
        translationId,
        status: "ready",
      });
      // Send updated books for the new translation
      socket.emit("bibleBooks", getBibleBooks(translationId));
      // Every device's downloaded list may have changed
      io.emit("downloadedTranslations", getDownloadedTranslationIds());
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

    // Audio Playlists
    socket.on("getAudioPlaylists", () => {
      socket.emit("audioPlaylists", audioPlaylists.getAll());
    });

    socket.on("createAudioPlaylist", (name, audioIds) => {
      audioPlaylists.create(name, audioIds);
    });

    socket.on("renameAudioPlaylist", (playlistId, name) => {
      audioPlaylists.rename(playlistId, name);
    });

    socket.on("deleteAudioPlaylist", (playlistId) => {
      audioPlaylists.delete(playlistId);
    });

    socket.on("setAudioPlaylistLoop", (playlistId, loop) => {
      const queue = stateManager.getState().audio.queue;
      if (queue.source === "playlist" && queue.playlistId === playlistId) {
        stateManager.setQueueLoop(loop);
      } else {
        audioPlaylists.setLoop(playlistId, loop);
      }
    });

    socket.on("addTracksToPlaylist", (playlistId, audioIds) => {
      audioPlaylists.addTracks(playlistId, audioIds);
    });

    socket.on("removeTrackFromPlaylist", (playlistId, audioId) => {
      audioPlaylists.removeTrack(playlistId, audioId);
    });

    socket.on("reorderPlaylist", (playlistId, orderedAudioIds) => {
      audioPlaylists.reorder(playlistId, orderedAudioIds);
    });

    // Up Next (ephemeral queue)
    socket.on("getAudioQueue", () => {
      socket.emit("audioQueue", audioPlaylists.getQueue());
    });

    socket.on("addToQueue", (audioIds) => {
      audioPlaylists.addToQueue(audioIds);
    });

    socket.on("playNextInQueue", (audioIds) => {
      const queue = stateManager.getState().audio.queue;
      const afterIndex = queue.source === "ephemeral" ? queue.index : -1;
      audioPlaylists.playNext(audioIds, afterIndex);
    });

    socket.on("removeFromQueue", (audioId) => {
      audioPlaylists.removeFromQueue(audioId);
    });

    socket.on("reorderQueue", (orderedAudioIds) => {
      audioPlaylists.reorderQueue(orderedAudioIds);
    });

    socket.on("clearQueue", () => {
      audioPlaylists.clearQueue();
    });

    // Queue transport
    socket.on("playAudioPlaylist", (playlistId, startIndex) => {
      stateManager.playPlaylist(playlistId, startIndex);
    });

    socket.on("playAudioQueue", (startIndex) => {
      stateManager.playQueue(startIndex);
    });

    socket.on("nextTrack", () => {
      stateManager.nextTrack();
    });

    socket.on("previousTrack", () => {
      stateManager.previousTrack();
    });

    socket.on("setQueueLoop", (loop) => {
      stateManager.setQueueLoop(loop);
    });

    // Audio Scheduling
    socket.on("getAudioSchedules", () => {
      socket.emit("audioSchedules", getAudioScheduler()?.getSchedules() || []);
    });

    socket.on("createAudioSchedule", (params) => {
      getAudioScheduler()?.createSchedule(params);
    });

    socket.on("updateAudioSchedule", (params) => {
      getAudioScheduler()?.updateSchedule(params);
    });

    socket.on("deleteAudioSchedule", (scheduleId) => {
      getAudioScheduler()?.deleteSchedule(scheduleId);
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
      broadcastConnectedDeviceIds();
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
