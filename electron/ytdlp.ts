import { spawn, execSync, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { app } from "electron";
import { v4 as uuidv4 } from "uuid";
import { getVideoLibrary } from "./videoLibrary";
import { getFfmpegPath } from "./utils";
import { fetchJSON, downloadFile } from "./otaUtils";
import type { DownloadProgress } from "../src/shared/videoLibrary.types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isFfmpegAvailable(): boolean {
  return getFfmpegPath() !== null;
}

// Active downloads map
const activeDownloads = new Map<
  string,
  { process: ChildProcess; progress: DownloadProgress }
>();

// --- Binary resolution: prefer updated binaries in userData, fall back to bundled ---

function getUpdatedBinDir(): string {
  return path.join(app.getPath("userData"), "bin");
}

function getBundledBinaryPath(name: string): string {
  const platform = process.platform;
  const isWindows = platform === "win32";
  const binaryName = isWindows ? `${name}.exe` : name;

  if (app.isPackaged) {
    return path.join(process.resourcesPath, "bin", binaryName);
  } else {
    const osDir = isWindows ? "win32" : platform === "darwin" ? "darwin" : "linux";
    return path.join(__dirname, "..", "bin", osDir, binaryName);
  }
}

function getBinaryPath(name: string): string {
  const isWindows = process.platform === "win32";
  const binaryName = isWindows ? `${name}.exe` : name;
  const updatedPath = path.join(getUpdatedBinDir(), binaryName);

  // Prefer OTA-updated binary if it exists
  if (fs.existsSync(updatedPath)) {
    return updatedPath;
  }
  return getBundledBinaryPath(name);
}

function getYtdlpPath(): string {
  return getBinaryPath("yt-dlp");
}

function getQjsPath(): string {
  return getBinaryPath("qjs");
}

// --- OTA binary updater ---

interface GitHubRelease {
  tag_name: string;
  assets: { name: string; browser_download_url: string }[];
}

function getVersionFile(): string {
  return path.join(getUpdatedBinDir(), "versions.json");
}

function getSavedVersions(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(getVersionFile(), "utf-8"));
  } catch {
    return {};
  }
}

function saveVersions(versions: Record<string, string>): void {
  fs.writeFileSync(getVersionFile(), JSON.stringify(versions, null, 2));
}

async function updateYtdlp(): Promise<boolean> {
  try {
    const release: GitHubRelease = await fetchJSON(
      "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest",
    );
    const versions = getSavedVersions();
    if (versions["yt-dlp"] === release.tag_name) return false;

    const platform = process.platform;
    const arch = process.arch;
    let assetName: string;
    if (platform === "win32") {
      assetName = arch === "arm64" ? "yt-dlp_arm64.exe" : "yt-dlp.exe";
    } else if (platform === "darwin") {
      assetName = "yt-dlp_macos";
    } else {
      assetName = arch === "arm64" ? "yt-dlp_linux_aarch64" : "yt-dlp_linux";
    }

    const asset = release.assets.find((a) => a.name === assetName);
    if (!asset) return false;

    const isWindows = platform === "win32";
    const destName = isWindows ? "yt-dlp.exe" : "yt-dlp";
    const destPath = path.join(getUpdatedBinDir(), destName);

    console.log(`[OTA] Updating yt-dlp to ${release.tag_name}...`);
    await downloadFile(asset.browser_download_url, destPath, { executable: true });

    versions["yt-dlp"] = release.tag_name;
    saveVersions(versions);
    console.log(`[OTA] yt-dlp updated to ${release.tag_name}`);
    return true;
  } catch (err) {
    console.warn("[OTA] Failed to update yt-dlp:", err);
    return false;
  }
}

async function updateQjs(): Promise<boolean> {
  try {
    const release: GitHubRelease = await fetchJSON(
      "https://api.github.com/repos/quickjs-ng/quickjs/releases/latest",
    );
    const versions = getSavedVersions();
    if (versions["qjs"] === release.tag_name) return false;

    const platform = process.platform;
    const arch = process.arch; // "x64", "arm64", etc.
    let assetName: string;
    if (platform === "win32") {
      assetName = arch === "ia32" ? "qjs-windows-x86.exe" : "qjs-windows-x86_64.exe";
    } else if (platform === "darwin") {
      assetName = "qjs-darwin";
    } else {
      assetName = arch === "arm64" ? "qjs-linux-aarch64" : "qjs-linux-x86_64";
    }

    const asset = release.assets.find((a) => a.name === assetName);
    if (!asset) return false;

    const isWindows = platform === "win32";
    const destName = isWindows ? "qjs.exe" : "qjs";
    const destPath = path.join(getUpdatedBinDir(), destName);

    console.log(`[OTA] Updating qjs to ${release.tag_name}...`);
    await downloadFile(asset.browser_download_url, destPath, { executable: true });

    versions["qjs"] = release.tag_name;
    saveVersions(versions);
    console.log(`[OTA] qjs updated to ${release.tag_name}`);
    return true;
  } catch (err) {
    console.warn("[OTA] Failed to update qjs:", err);
    return false;
  }
}

/**
 * Check for and download updated yt-dlp and quickjs binaries.
 * Safe to call on startup — runs in background, never throws.
 */
export async function checkForBinaryUpdates(): Promise<void> {
  try {
    // Ensure the updated bin directory exists
    const binDir = getUpdatedBinDir();
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    await Promise.all([updateYtdlp(), updateQjs()]);
  } catch (err) {
    console.warn("[OTA] Binary update check failed:", err);
  }
}

function isValidYouTubeUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^https?:\/\/youtu\.be\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/,
  ];
  return patterns.some((p) => p.test(url));
}

export function startDownload(url: string): DownloadProgress {
  const library = getVideoLibrary();
  const downloadId = uuidv4();

  const progress: DownloadProgress = {
    id: downloadId,
    url,
    status: "pending",
    progress: 0,
  };

  // Validate URL
  if (!isValidYouTubeUrl(url)) {
    progress.status = "error";
    progress.error = "Invalid YouTube URL";
    library.notifyDownloadProgress(progress);
    return progress;
  }

  const ytdlpPath = getYtdlpPath();

  // Check if yt-dlp binary exists
  if (!fs.existsSync(ytdlpPath)) {
    progress.status = "error";
    progress.error = `yt-dlp binary not found at ${ytdlpPath}. Please install yt-dlp.`;
    library.notifyDownloadProgress(progress);
    return progress;
  }

  const outputDir = library.getVideosDir();
  const outputTemplate = path.join(outputDir, "%(title)s.%(ext)s");

  // Format selection based on ffmpeg availability
  // Prefer H.264 (avc1) which plays in Electron, fallback to any format
  const ffmpegAvailable = isFfmpegAvailable();
  const args = [
    url,
    "-o",
    outputTemplate,
    "-f",
    ffmpegAvailable
      ? "bestvideo[vcodec^=avc1]+bestaudio/best[vcodec^=avc1]/best"
      : "best[ext=mp4]/best",
    ...(ffmpegAvailable ? ["--merge-output-format", "mp4"] : []),
    "--newline",
    "--progress",
    "--no-playlist",
    "--restrict-filenames",
    "--no-js-runtimes",
    "--js-runtimes",
    `quickjs:${getQjsPath()}`,
  ];

  progress.status = "downloading";
  library.notifyDownloadProgress(progress);

  const proc = spawn(ytdlpPath, args);
  activeDownloads.set(downloadId, { process: proc, progress });

  let outputFilePath: string | null = null;
  let videoTitle: string | null = null;

  proc.stdout?.on("data", (data: Buffer) => {
    const output = data.toString();

    // Parse progress line: [download]  50.0% of 100.00MiB at 10.00MiB/s ETA 00:05
    const progressMatch = output.match(
      /\[download\]\s+([\d.]+)%\s+of\s+([\d.]+\w+)\s+at\s+([\d.]+\w+\/s)\s+ETA\s+(\S+)/
    );
    if (progressMatch) {
      progress.progress = parseFloat(progressMatch[1]);
      progress.speed = progressMatch[3];
      progress.eta = progressMatch[4];
      library.notifyDownloadProgress(progress);
    }

    // Parse destination line: [download] Destination: /path/to/video.mp4
    const destMatch = output.match(/\[download\] Destination: (.+)/);
    if (destMatch) {
      outputFilePath = destMatch[1].trim();
    }

    // Parse merger line for final output: [Merger] Merging formats into "/path/to/video.mp4"
    const mergerMatch = output.match(/\[Merger\] Merging formats into "(.+)"/);
    if (mergerMatch) {
      outputFilePath = mergerMatch[1];
    }

    // Parse ExtractAudio/Fixup output: [ExtractAudio] or [FixupM4a] output path
    const extractMatch = output.match(
      /\[(ExtractAudio|FixupM4a|Fixup)\][^"]*"?([^"]+\.(mp4|m4a|webm|mkv))"?/i
    );
    if (extractMatch) {
      outputFilePath = extractMatch[2];
    }

    // Also catch: [download] /path/to/file has already been downloaded
    const alreadyMatch = output.match(
      /\[download\] (.+) has already been downloaded/
    );
    if (alreadyMatch) {
      outputFilePath = alreadyMatch[1].trim();
    }
  });

  proc.stderr?.on("data", (data: Buffer) => {
    console.error("yt-dlp stderr:", data.toString());
  });

  proc.on("close", async (code) => {
    activeDownloads.delete(downloadId);

    // Fallback: if outputFilePath wasn't captured, find most recent video in output dir
    if (code === 0 && !outputFilePath) {
      const files = fs
        .readdirSync(outputDir)
        .filter((f) => /\.(mp4|webm|mkv|mov)$/i.test(f))
        .map((f) => ({
          name: f,
          path: path.join(outputDir, f),
          mtime: fs.statSync(path.join(outputDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (files.length > 0) {
        outputFilePath = files[0].path;
        console.log("Found output file via fallback:", outputFilePath);
      }
    }

    if (code === 0 && outputFilePath && fs.existsSync(outputFilePath)) {
      progress.status = "processing";
      progress.progress = 100;
      library.notifyDownloadProgress(progress);

      // Extract title from filename
      // yt-dlp uses the video title as filename (with --restrict-filenames which replaces spaces with underscores)
      const filename = path.basename(
        outputFilePath,
        path.extname(outputFilePath)
      );
      // Convert underscores back to spaces
      videoTitle = filename.replace(/_/g, " ");

      try {
        // Add video to library
        const video = await library.addVideo(outputFilePath, "youtube", {
          name: videoTitle,
          sourceUrl: url,
          copyToLibrary: false, // Already in videos directory
        });

        progress.status = "complete";
        progress.videoId = video.id;
        progress.filename = video.filename;
      } catch (err) {
        progress.status = "error";
        progress.error = `Failed to add to library: ${err}`;
      }
    } else if (code !== 0) {
      progress.status = "error";
      progress.error = `Download failed with exit code ${code}`;
    } else {
      progress.status = "error";
      progress.error = "Download completed but output file not found";
    }

    library.notifyDownloadProgress(progress);
  });

  proc.on("error", (err) => {
    activeDownloads.delete(downloadId);
    progress.status = "error";
    progress.error = `Process error: ${err.message}`;
    library.notifyDownloadProgress(progress);
  });

  return progress;
}

export function cancelDownload(downloadId: string): boolean {
  const download = activeDownloads.get(downloadId);
  if (!download) return false;

  download.process.kill();
  activeDownloads.delete(downloadId);

  const library = getVideoLibrary();
  download.progress.status = "error";
  download.progress.error = "Cancelled by user";
  library.notifyDownloadProgress(download.progress);

  return true;
}

export function getActiveDownloads(): DownloadProgress[] {
  return Array.from(activeDownloads.values()).map((d) => d.progress);
}

export function getDownloadProgress(
  downloadId: string
): DownloadProgress | null {
  return activeDownloads.get(downloadId)?.progress || null;
}

export function killAllDownloads(): void {
  for (const [id, download] of activeDownloads) {
    try {
      download.process.kill();
    } catch (e) {
      console.error(`Failed to kill download ${id}:`, e);
    }
  }
  activeDownloads.clear();
}
