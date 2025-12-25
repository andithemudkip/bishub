import { app } from "electron";
import { execSync, exec } from "child_process";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import Store from "electron-store";
import type {
  AudioItem,
  AudioSource,
  AudioUploadProgress,
} from "../src/shared/audioLibrary.types";

// Find ffprobe path
function findBinaryPath(name: string): string | null {
  const paths = [
    name,
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/bin/${name}`,
  ];
  for (const p of paths) {
    try {
      execSync(`"${p}" -version`, { stdio: "ignore" });
      return p;
    } catch {
      // Try next
    }
  }
  return null;
}

const ffprobePath = findBinaryPath("ffprobe");

if (ffprobePath) {
  console.log(`[AudioLibrary] ffprobe found at: ${ffprobePath}`);
} else {
  console.warn("[AudioLibrary] ffprobe not found, duration extraction will be disabled");
}

interface AudioLibrarySchema {
  audios: AudioItem[];
  version: number;
}

type AudioLibraryChangeCallback = (audios: AudioItem[]) => void;
type UploadProgressCallback = (progress: AudioUploadProgress) => void;

export class AudioLibraryManager {
  private store: Store<AudioLibrarySchema>;
  private audiosDir: string;
  private changeListeners: AudioLibraryChangeCallback[] = [];
  private uploadProgressListeners: UploadProgressCallback[] = [];

  constructor() {
    this.store = new Store<AudioLibrarySchema>({
      name: "audio-library",
      defaults: {
        audios: [],
        version: 1,
      },
    });

    // Set up directory in userData
    const userDataPath = app.getPath("userData");
    this.audiosDir = path.join(userDataPath, "audios");

    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.audiosDir)) {
      fs.mkdirSync(this.audiosDir, { recursive: true });
    }
  }

  getAudiosDir(): string {
    return this.audiosDir;
  }

  // Event listeners
  onLibraryChange(callback: AudioLibraryChangeCallback): () => void {
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

  private notifyLibraryChange(): void {
    const audios = this.getAll();
    this.changeListeners.forEach((cb) => cb(audios));
  }

  notifyUploadProgress(progress: AudioUploadProgress): void {
    this.uploadProgressListeners.forEach((cb) => cb(progress));
  }

  // CRUD operations
  getAll(): AudioItem[] {
    const audios = this.store.get("audios", []);
    // Sort by date added (newest first)
    return [...audios].sort((a, b) => b.dateAdded - a.dateAdded);
  }

  getById(id: string): AudioItem | null {
    const audios = this.store.get("audios", []);
    return audios.find((a) => a.id === id) || null;
  }

  async addAudio(
    sourcePath: string,
    source: AudioSource,
    options?: {
      name?: string;
      copyToLibrary?: boolean;
    }
  ): Promise<AudioItem> {
    const { name, copyToLibrary = true } = options || {};

    let finalPath = sourcePath;
    let filename = path.basename(sourcePath);

    // Copy file to library directory if needed
    if (copyToLibrary && !sourcePath.startsWith(this.audiosDir)) {
      const ext = path.extname(filename);
      const baseName = path.basename(filename, ext);
      const uniqueFilename = `${baseName}-${Date.now()}${ext}`;
      finalPath = path.join(this.audiosDir, uniqueFilename);
      filename = uniqueFilename;

      await fs.promises.copyFile(sourcePath, finalPath);
    }

    // Get file size
    const stats = await fs.promises.stat(finalPath);
    const fileSize = stats.size;

    // Generate ID and create audio item
    const id = uuidv4();
    const displayName = name || path.basename(filename, path.extname(filename));

    const audio: AudioItem = {
      id,
      name: displayName,
      filename,
      path: finalPath,
      dateAdded: Date.now(),
      duration: null,
      source,
      fileSize,
    };

    // Add to store
    const audios = this.store.get("audios", []);
    audios.push(audio);
    this.store.set("audios", audios);

    // Extract duration asynchronously
    this.extractDuration(audio).catch((err) => {
      console.error("[AudioLibrary] Failed to extract duration:", err);
    });

    this.notifyLibraryChange();
    return audio;
  }

  private async extractDuration(audio: AudioItem): Promise<void> {
    if (!ffprobePath) {
      console.warn("[AudioLibrary] Cannot extract duration: ffprobe not available");
      return;
    }

    return new Promise((resolve) => {
      // Use ffprobe to get duration in seconds
      const cmd = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audio.path}"`;

      exec(cmd, (error, stdout) => {
        if (error) {
          console.error("[AudioLibrary] Duration extraction failed:", error.message);
          resolve();
          return;
        }

        const duration = parseFloat(stdout.trim());
        if (!isNaN(duration) && duration > 0) {
          // Update audio with duration
          const audios = this.store.get("audios", []);
          const index = audios.findIndex((a) => a.id === audio.id);
          if (index !== -1) {
            audios[index].duration = duration;
            this.store.set("audios", audios);
            this.notifyLibraryChange();
          }
        }
        resolve();
      });
    });
  }

  async deleteAudio(id: string): Promise<boolean> {
    const audio = this.getById(id);
    if (!audio) return false;

    // Delete audio file
    if (fs.existsSync(audio.path)) {
      await fs.promises.unlink(audio.path);
    }

    // Remove from store
    const audios = this.store.get("audios", []);
    const filtered = audios.filter((a) => a.id !== id);
    this.store.set("audios", filtered);

    this.notifyLibraryChange();
    return true;
  }

  renameAudio(id: string, newName: string): AudioItem | null {
    const audios = this.store.get("audios", []);
    const index = audios.findIndex((a) => a.id === id);
    if (index === -1) return null;

    audios[index].name = newName;
    this.store.set("audios", audios);

    this.notifyLibraryChange();
    return audios[index];
  }

  // Update duration (called after audio metadata is extracted)
  updateDuration(id: string, duration: number): void {
    const audios = this.store.get("audios", []);
    const index = audios.findIndex((a) => a.id === id);
    if (index !== -1) {
      audios[index].duration = duration;
      this.store.set("audios", audios);
      this.notifyLibraryChange();
    }
  }

  // Search audios by name
  searchAudios(query: string): AudioItem[] {
    const audios = this.getAll();
    const lowerQuery = query.toLowerCase();
    return audios.filter((a) => a.name.toLowerCase().includes(lowerQuery));
  }

  // Validate that audio files still exist and backfill missing metadata
  async validateLibrary(): Promise<void> {
    const audios = this.store.get("audios", []);
    const validAudios: AudioItem[] = [];

    for (const audio of audios) {
      if (fs.existsSync(audio.path)) {
        validAudios.push(audio);

        // Backfill missing duration
        if (audio.duration === null) {
          this.extractDuration(audio).catch((err) => {
            console.error(
              "[AudioLibrary] Failed to extract duration for existing audio:",
              err
            );
          });
        }
      } else {
        console.warn(
          `[AudioLibrary] Audio file missing, removing from library: ${audio.path}`
        );
      }
    }

    if (validAudios.length !== audios.length) {
      this.store.set("audios", validAudios);
      this.notifyLibraryChange();
    }
  }
}

// Singleton instance
let libraryInstance: AudioLibraryManager | null = null;

export function getAudioLibrary(): AudioLibraryManager {
  if (!libraryInstance) {
    libraryInstance = new AudioLibraryManager();
  }
  return libraryInstance;
}
