import { app } from "electron";
import { execSync, exec } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import Store from "electron-store";
import type {
  VideoItem,
  VideoSource,
  DownloadProgress,
  UploadProgress,
} from "../src/shared/videoLibrary.types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find ffmpeg/ffprobe path - check bundled binary first, then system paths
// Uses lazy evaluation to ensure app.isPackaged is correctly set
let _ffmpegPath: string | null | undefined;
let _ffprobePath: string | null | undefined;

function findBinaryPath(name: string): string | null {
  const isWindows = process.platform === "win32";
  const binaryName = isWindows ? `${name}.exe` : name;
  const isPackaged = app.isPackaged;

  console.log(`findBinaryPath(${name}): isPackaged=${isPackaged}, platform=${process.platform}`);

  // Check for bundled binary first
  let bundledPath: string;
  if (isPackaged) {
    bundledPath = path.join(process.resourcesPath, "bin", binaryName);
  } else {
    const osDir = isWindows ? "win32" : process.platform === "darwin" ? "darwin" : "linux";
    bundledPath = path.join(__dirname, "..", "bin", osDir, binaryName);
  }

  console.log(`findBinaryPath(${name}): checking bundled path: ${bundledPath}`);

  if (fs.existsSync(bundledPath)) {
    console.log(`Found bundled ${name} at: ${bundledPath}`);
    return bundledPath;
  }

  console.log(`findBinaryPath(${name}): bundled not found, checking system paths`);

  // Fall back to system paths
  const paths: string[] = [];

  if (isWindows) {
    paths.push(
      binaryName,
      `C:\\ffmpeg\\bin\\${binaryName}`,
      `C:\\Program Files\\ffmpeg\\bin\\${binaryName}`,
      `C:\\Program Files (x86)\\ffmpeg\\bin\\${binaryName}`
    );
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      paths.push(path.join(localAppData, "Microsoft", "WinGet", "Links", binaryName));
    }
  } else {
    paths.push(
      name,
      `/opt/homebrew/bin/${name}`,
      `/usr/local/bin/${name}`,
      `/usr/bin/${name}`
    );
  }

  for (const p of paths) {
    try {
      execSync(`"${p}" -version`, { stdio: "ignore", shell: true });
      console.log(`Found system ${name} at: ${p}`);
      return p;
    } catch {
      // Try next
    }
  }

  console.log(`findBinaryPath(${name}): not found anywhere`);
  return null;
}

function getFfmpegPath(): string | null {
  if (_ffmpegPath === undefined) {
    _ffmpegPath = findBinaryPath("ffmpeg");
    if (_ffmpegPath) {
      console.log(`ffmpeg found at: ${_ffmpegPath}`);
    } else {
      console.warn("ffmpeg not found, thumbnails will be disabled");
    }
  }
  return _ffmpegPath;
}

function getFfprobePath(): string | null {
  if (_ffprobePath === undefined) {
    _ffprobePath = findBinaryPath("ffprobe");
    if (_ffprobePath) {
      console.log(`ffprobe found at: ${_ffprobePath}`);
    } else {
      console.warn("ffprobe not found, duration extraction will be disabled");
    }
  }
  return _ffprobePath;
}

interface VideoLibrarySchema {
  videos: VideoItem[];
  version: number;
}

type VideoLibraryChangeCallback = (videos: VideoItem[]) => void;
type DownloadProgressCallback = (progress: DownloadProgress) => void;
type UploadProgressCallback = (progress: UploadProgress) => void;

export class VideoLibraryManager {
  private store: Store<VideoLibrarySchema>;
  private videosDir: string;
  private thumbnailsDir: string;
  private changeListeners: VideoLibraryChangeCallback[] = [];
  private downloadProgressListeners: DownloadProgressCallback[] = [];
  private uploadProgressListeners: UploadProgressCallback[] = [];

  constructor() {
    this.store = new Store<VideoLibrarySchema>({
      name: "video-library",
      defaults: {
        videos: [],
        version: 1,
      },
    });

    // Set up directories in userData
    const userDataPath = app.getPath("userData");
    this.videosDir = path.join(userDataPath, "videos");
    this.thumbnailsDir = path.join(userDataPath, "thumbnails");

    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.videosDir)) {
      fs.mkdirSync(this.videosDir, { recursive: true });
    }
    if (!fs.existsSync(this.thumbnailsDir)) {
      fs.mkdirSync(this.thumbnailsDir, { recursive: true });
    }
  }

  getVideosDir(): string {
    return this.videosDir;
  }

  getThumbnailsDir(): string {
    return this.thumbnailsDir;
  }

  // Event listeners
  onLibraryChange(callback: VideoLibraryChangeCallback): () => void {
    this.changeListeners.push(callback);
    return () => {
      this.changeListeners = this.changeListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  onDownloadProgress(callback: DownloadProgressCallback): () => void {
    this.downloadProgressListeners.push(callback);
    return () => {
      this.downloadProgressListeners = this.downloadProgressListeners.filter(
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

  private notifyLibraryChange(): void {
    const videos = this.getAll();
    this.changeListeners.forEach((cb) => cb(videos));
  }

  notifyDownloadProgress(progress: DownloadProgress): void {
    this.downloadProgressListeners.forEach((cb) => cb(progress));
  }

  notifyUploadProgress(progress: UploadProgress): void {
    this.uploadProgressListeners.forEach((cb) => cb(progress));
  }

  // CRUD operations
  getAll(): VideoItem[] {
    const videos = this.store.get("videos", []);
    // Sort by date added (newest first)
    return [...videos].sort((a, b) => b.dateAdded - a.dateAdded);
  }

  getById(id: string): VideoItem | null {
    const videos = this.store.get("videos", []);
    return videos.find((v) => v.id === id) || null;
  }

  async addVideo(
    sourcePath: string,
    source: VideoSource,
    options?: {
      name?: string;
      sourceUrl?: string;
      copyToLibrary?: boolean;
    }
  ): Promise<VideoItem> {
    const { name, sourceUrl, copyToLibrary = true } = options || {};

    let finalPath = sourcePath;
    let filename = path.basename(sourcePath);

    // Copy file to library directory if needed
    if (copyToLibrary && !sourcePath.startsWith(this.videosDir)) {
      const ext = path.extname(filename);
      const baseName = path.basename(filename, ext);
      const uniqueFilename = `${baseName}-${Date.now()}${ext}`;
      finalPath = path.join(this.videosDir, uniqueFilename);
      filename = uniqueFilename;

      await fs.promises.copyFile(sourcePath, finalPath);
    }

    // Get file size
    const stats = await fs.promises.stat(finalPath);
    const fileSize = stats.size;

    // Generate ID and create video item
    const id = uuidv4();
    const displayName = name || path.basename(filename, path.extname(filename));

    const video: VideoItem = {
      id,
      name: displayName,
      filename,
      path: finalPath,
      thumbnailPath: null,
      dateAdded: Date.now(),
      duration: null,
      source,
      sourceUrl,
      fileSize,
    };

    // Add to store
    const videos = this.store.get("videos", []);
    videos.push(video);
    this.store.set("videos", videos);

    // Generate thumbnail and extract duration asynchronously
    this.generateThumbnail(video).catch((err) => {
      console.error("Failed to generate thumbnail:", err);
    });
    this.extractDuration(video).catch((err) => {
      console.error("Failed to extract duration:", err);
    });

    this.notifyLibraryChange();
    return video;
  }

  private async extractDuration(video: VideoItem): Promise<void> {
    const ffprobePath = getFfprobePath();
    if (!ffprobePath) {
      console.warn("Cannot extract duration: ffprobe not available");
      return;
    }

    return new Promise((resolve) => {
      // Use ffprobe to get duration in seconds
      const cmd = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${video.path}"`;

      exec(cmd, (error, stdout) => {
        if (error) {
          console.error("Duration extraction failed:", error.message);
          resolve();
          return;
        }

        const duration = parseFloat(stdout.trim());
        if (!isNaN(duration) && duration > 0) {
          // Update video with duration
          const videos = this.store.get("videos", []);
          const index = videos.findIndex((v) => v.id === video.id);
          if (index !== -1) {
            videos[index].duration = duration;
            this.store.set("videos", videos);
            this.notifyLibraryChange();
          }
        }
        resolve();
      });
    });
  }

  async deleteVideo(id: string): Promise<boolean> {
    const video = this.getById(id);
    if (!video) return false;

    // Delete video file
    if (fs.existsSync(video.path)) {
      await fs.promises.unlink(video.path);
    }

    // Delete thumbnail if exists
    if (video.thumbnailPath && fs.existsSync(video.thumbnailPath)) {
      await fs.promises.unlink(video.thumbnailPath);
    }

    // Remove from store
    const videos = this.store.get("videos", []);
    const filtered = videos.filter((v) => v.id !== id);
    this.store.set("videos", filtered);

    this.notifyLibraryChange();
    return true;
  }

  renameVideo(id: string, newName: string): VideoItem | null {
    const videos = this.store.get("videos", []);
    const index = videos.findIndex((v) => v.id === id);
    if (index === -1) return null;

    videos[index].name = newName;
    this.store.set("videos", videos);

    this.notifyLibraryChange();
    return videos[index];
  }

  private async generateThumbnail(video: VideoItem): Promise<void> {
    const ffmpegPath = getFfmpegPath();
    if (!ffmpegPath) {
      console.warn("Cannot generate thumbnail: ffmpeg not available");
      return;
    }

    const thumbnailFilename = `${video.id}.jpg`;
    const thumbnailPath = path.join(this.thumbnailsDir, thumbnailFilename);

    return new Promise((resolve, reject) => {
      // Use ffmpeg to extract a frame at 50% of video duration
      // -ss 00:00:01 seeks to 1 second (fallback if duration unknown)
      // -vframes 1 extracts one frame
      // -vf scale=320:180 resizes to thumbnail size
      const cmd = `"${ffmpegPath}" -y -i "${video.path}" -ss 00:00:01 -vframes 1 -vf "scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2" "${thumbnailPath}"`;

      exec(cmd, (error) => {
        if (error) {
          console.error("Thumbnail generation failed:", error.message);
          reject(error);
          return;
        }

        // Update video with thumbnail path
        const videos = this.store.get("videos", []);
        const index = videos.findIndex((v) => v.id === video.id);
        if (index !== -1) {
          videos[index].thumbnailPath = thumbnailPath;
          this.store.set("videos", videos);
          this.notifyLibraryChange();
        }
        resolve();
      });
    });
  }

  // Update duration (called after video metadata is extracted)
  updateDuration(id: string, duration: number): void {
    const videos = this.store.get("videos", []);
    const index = videos.findIndex((v) => v.id === id);
    if (index !== -1) {
      videos[index].duration = duration;
      this.store.set("videos", videos);
      this.notifyLibraryChange();
    }
  }

  // Search videos by name
  searchVideos(query: string): VideoItem[] {
    const videos = this.getAll();
    const lowerQuery = query.toLowerCase();
    return videos.filter((v) => v.name.toLowerCase().includes(lowerQuery));
  }

  // Validate that video files still exist and backfill missing metadata
  async validateLibrary(): Promise<void> {
    const videos = this.store.get("videos", []);
    const validVideos: VideoItem[] = [];

    for (const video of videos) {
      if (fs.existsSync(video.path)) {
        validVideos.push(video);

        // Backfill missing duration
        if (video.duration === null) {
          this.extractDuration(video).catch((err) => {
            console.error(
              "Failed to extract duration for existing video:",
              err
            );
          });
        }

        // Backfill missing thumbnail
        if (!video.thumbnailPath || !fs.existsSync(video.thumbnailPath)) {
          this.generateThumbnail(video).catch((err) => {
            console.error(
              "Failed to generate thumbnail for existing video:",
              err
            );
          });
        }
      } else {
        console.warn(
          `Video file missing, removing from library: ${video.path}`
        );
        // Clean up orphaned thumbnail
        if (video.thumbnailPath && fs.existsSync(video.thumbnailPath)) {
          await fs.promises.unlink(video.thumbnailPath);
        }
      }
    }

    if (validVideos.length !== videos.length) {
      this.store.set("videos", validVideos);
      this.notifyLibraryChange();
    }
  }
}

// Singleton instance
let libraryInstance: VideoLibraryManager | null = null;

export function getVideoLibrary(): VideoLibraryManager {
  if (!libraryInstance) {
    libraryInstance = new VideoLibraryManager();
  }
  return libraryInstance;
}
