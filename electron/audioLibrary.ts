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
  DirectoryImportProgress,
} from "../src/shared/audioLibrary.types";

import { getFfprobePath } from "./utils";
interface AudioLibrarySchema {
  audios: AudioItem[];
  version: number;
}

type AudioLibraryChangeCallback = (audios: AudioItem[]) => void;
type UploadProgressCallback = (progress: AudioUploadProgress) => void;
type DirectoryImportProgressCallback = (
  progress: DirectoryImportProgress
) => void;

const SUPPORTED_AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".m4a", ".flac"];

export class AudioLibraryManager {
  private store: Store<AudioLibrarySchema>;
  private audiosDir: string;
  private changeListeners: AudioLibraryChangeCallback[] = [];
  private uploadProgressListeners: UploadProgressCallback[] = [];
  private directoryImportListeners: DirectoryImportProgressCallback[] = [];

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

  onDirectoryImportProgress(
    callback: DirectoryImportProgressCallback
  ): () => void {
    this.directoryImportListeners.push(callback);
    return () => {
      this.directoryImportListeners = this.directoryImportListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  private notifyDirectoryImportProgress(
    progress: DirectoryImportProgress
  ): void {
    this.directoryImportListeners.forEach((cb) => cb(progress));
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

  async addAudiosFromDirectory(directoryPath: string): Promise<{
    completed: AudioItem[];
    errors: { file: string; error: string }[];
  }> {
    const importId = uuidv4();
    const completed: AudioItem[] = [];
    const errors: { file: string; error: string }[] = [];

    // Notify scanning status
    this.notifyDirectoryImportProgress({
      id: importId,
      directory: directoryPath,
      current: 0,
      total: 0,
      currentFile: "",
      completed: [],
      errors: [],
      status: "scanning",
    });

    // Read directory and filter audio files
    let files: string[];
    try {
      const entries = await fs.promises.readdir(directoryPath);
      files = entries.filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return SUPPORTED_AUDIO_EXTENSIONS.includes(ext);
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.notifyDirectoryImportProgress({
        id: importId,
        directory: directoryPath,
        current: 0,
        total: 0,
        currentFile: "",
        completed: [],
        errors: [{ file: directoryPath, error: errorMsg }],
        status: "error",
      });
      return {
        completed: [],
        errors: [{ file: directoryPath, error: errorMsg }],
      };
    }

    if (files.length === 0) {
      this.notifyDirectoryImportProgress({
        id: importId,
        directory: directoryPath,
        current: 0,
        total: 0,
        currentFile: "",
        completed: [],
        errors: [],
        status: "complete",
      });
      return { completed: [], errors: [] };
    }

    // Import files sequentially
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(directoryPath, file);

      this.notifyDirectoryImportProgress({
        id: importId,
        directory: directoryPath,
        current: i + 1,
        total: files.length,
        currentFile: file,
        completed: [...completed],
        errors: [...errors],
        status: "importing",
      });

      try {
        const audio = await this.addAudio(filePath, "local");
        completed.push(audio);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        errors.push({ file, error: errorMsg });
        console.error(`[AudioLibrary] Failed to import ${file}:`, errorMsg);
      }
    }

    // Final notification
    this.notifyDirectoryImportProgress({
      id: importId,
      directory: directoryPath,
      current: files.length,
      total: files.length,
      currentFile: "",
      completed: [...completed],
      errors: [...errors],
      status: "complete",
    });

    return { completed, errors };
  }

  private async extractDuration(audio: AudioItem): Promise<void> {
    const ffprobePath = getFfprobePath();

    if (!ffprobePath) {
      console.warn(
        "[AudioLibrary] Cannot extract duration: ffprobe not available"
      );
      return;
    }

    return new Promise((resolve) => {
      // Use ffprobe to get duration in seconds
      const cmd = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audio.path}"`;

      exec(cmd, (error, stdout) => {
        if (error) {
          console.error(
            "[AudioLibrary] Duration extraction failed:",
            error.message
          );
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
