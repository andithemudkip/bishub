import { spawn, execFile, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { app } from "electron";
import { v4 as uuidv4 } from "uuid";
import { getVideoLibrary } from "./videoLibrary";
import { getAudioLibrary } from "./audioLibrary";
import { getFfmpegPath, getFfprobePath } from "./utils";
import { fetchJSON, downloadFile } from "./otaUtils";
import { isValidYouTubeUrl } from "../src/shared/utils";
import type { DownloadProgress, DownloadStage } from "../src/shared/videoLibrary.types";
import type { AudioDownloadProgress } from "../src/shared/audioLibrary.types";
import type { BinaryInfo } from "../src/shared/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type DownloadMode = "video" | "audio";

// DownloadProgress and AudioDownloadProgress differ only in which of
// videoId/audioId they carry — the internal shape supports both.
interface InternalProgress {
  id: string;
  url: string;
  status: "pending" | "downloading" | "processing" | "complete" | "error";
  stage?: DownloadStage;
  progress: number;
  speed?: string;
  eta?: string;
  error?: string;
  filename?: string;
  videoId?: string;
  audioId?: string;
}

const activeDownloads = new Map<
  string,
  { process: ChildProcess; progress: InternalProgress; mode: DownloadMode }
>();

function notify(mode: DownloadMode, progress: InternalProgress): void {
  if (mode === "video") {
    getVideoLibrary().notifyDownloadProgress(progress as DownloadProgress);
  } else {
    getAudioLibrary().notifyDownloadProgress(progress as AudioDownloadProgress);
  }
}

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
    const release = await fetchJSON<GitHubRelease>(
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
    const release = await fetchJSON<GitHubRelease>(
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

function probeVersion(binPath: string, args: string[]): Promise<string | null> {
  // yt-dlp is a PyInstaller bundle that re-extracts itself on every run
  // (~8–12s on macOS), so the timeout has to be generous. Non-zero exits still
  // produce useful stdout (e.g. qjs prints its version banner on `-h` and exits 1),
  // so we key on output rather than the exit code.
  return new Promise((resolve) => {
    execFile(binPath, args, { timeout: 30000, encoding: "utf-8" }, (_err, stdout) => {
      const firstLine = (stdout || "").split("\n")[0].trim();
      resolve(firstLine || null);
    });
  });
}

function parseFfmpegVersion(line: string | null): string | null {
  // "ffmpeg version 6.0 Copyright ..." → "6.0"
  if (!line) return null;
  const m = line.match(/version\s+(\S+)/);
  return m ? m[1] : line;
}

function resolveOtaOrBundled(name: string): {
  path: string;
  source: "ota" | "bundled";
  available: boolean;
} {
  const isWindows = process.platform === "win32";
  const binaryName = isWindows ? `${name}.exe` : name;
  const otaPath = path.join(getUpdatedBinDir(), binaryName);
  if (fs.existsSync(otaPath)) {
    return { path: otaPath, source: "ota", available: true };
  }
  const bundled = getBundledBinaryPath(name);
  return { path: bundled, source: "bundled", available: fs.existsSync(bundled) };
}

function resolveSystemOrBundled(
  resolved: string | null,
  name: string,
): { path: string | null; source: "bundled" | "system" | null; available: boolean } {
  if (!resolved) return { path: null, source: null, available: false };
  const bundled = getBundledBinaryPath(name);
  const source = resolved === bundled ? "bundled" : "system";
  return { path: resolved, source, available: true };
}

// Cache the binary info for the process lifetime. Probing yt-dlp takes ~8s
// on every invocation because the macOS release is a PyInstaller one-file
// bundle that re-extracts into a fresh temp dir each time — there's no
// cheaper way to get its version. Binaries don't change at runtime (OTA
// completes at startup before the user opens Settings), so a single probe
// per session is safe.
let cachedBinaryInfo: Promise<BinaryInfo[]> | null = null;

/**
 * Diagnostic snapshot of all bundled/OTA/system binaries the app relies on.
 * Used by the Settings page for troubleshooting. Cached for the process lifetime.
 */
export function getBinaryInfo(): Promise<BinaryInfo[]> {
  if (!cachedBinaryInfo) {
    cachedBinaryInfo = probeBinaries().then((info) => {
      // If any available binary failed to report a version (likely a timeout),
      // clear the cache so the next call retries rather than serving bad data.
      const hasFailure = info.some((b) => b.available && b.version === null);
      if (hasFailure) cachedBinaryInfo = null;
      return info;
    });
  }
  return cachedBinaryInfo;
}

async function probeBinaries(): Promise<BinaryInfo[]> {
  const ytdlp = resolveOtaOrBundled("yt-dlp");
  const qjs = resolveOtaOrBundled("qjs");
  const ffmpeg = resolveSystemOrBundled(getFfmpegPath(), "ffmpeg");
  const ffprobe = resolveSystemOrBundled(getFfprobePath(), "ffprobe");

  const [ytdlpVersion, qjsVersion, ffmpegVersion, ffprobeVersion] =
    await Promise.all([
      ytdlp.available ? probeVersion(ytdlp.path, ["--version"]) : null,
      qjs.available ? probeVersion(qjs.path, ["-h"]) : null,
      ffmpeg.available && ffmpeg.path
        ? probeVersion(ffmpeg.path, ["-version"]).then(parseFfmpegVersion)
        : null,
      ffprobe.available && ffprobe.path
        ? probeVersion(ffprobe.path, ["-version"]).then(parseFfmpegVersion)
        : null,
    ]);

  return [
    {
      name: "yt-dlp",
      available: ytdlp.available,
      path: ytdlp.path,
      version: ytdlpVersion,
      source: ytdlp.available ? ytdlp.source : null,
    },
    {
      name: "qjs",
      available: qjs.available,
      path: qjs.path,
      version: qjsVersion,
      source: qjs.available ? qjs.source : null,
    },
    {
      name: "ffmpeg",
      available: ffmpeg.available,
      path: ffmpeg.path,
      version: ffmpegVersion,
      source: ffmpeg.source,
    },
    {
      name: "ffprobe",
      available: ffprobe.available,
      path: ffprobe.path,
      version: ffprobeVersion,
      source: ffprobe.source,
    },
  ];
}

function startYoutubeDownload(url: string, mode: DownloadMode): InternalProgress {
  const downloadId = uuidv4();

  const progress: InternalProgress = {
    id: downloadId,
    url,
    status: "pending",
    stage: "preparing",
    progress: 0,
  };

  if (!isValidYouTubeUrl(url)) {
    progress.status = "error";
    progress.error = "Invalid YouTube URL";
    notify(mode, progress);
    return progress;
  }

  const ytdlpPath = getYtdlpPath();
  if (!fs.existsSync(ytdlpPath)) {
    progress.status = "error";
    progress.error = `yt-dlp binary not found at ${ytdlpPath}. Please install yt-dlp.`;
    notify(mode, progress);
    return progress;
  }

  const ffmpegPath = getFfmpegPath();
  const ffmpegAvailable = ffmpegPath !== null;

  // Audio extraction requires ffmpeg for the re-mux to mp3.
  if (mode === "audio" && !ffmpegAvailable) {
    progress.status = "error";
    progress.error = "ffmpeg is required to extract audio. Install ffmpeg or use the bundled build.";
    notify(mode, progress);
    return progress;
  }

  const outputDir =
    mode === "video"
      ? getVideoLibrary().getVideosDir()
      : getAudioLibrary().getAudiosDir();
  const outputTemplate = path.join(outputDir, "%(title)s.%(ext)s");

  // Mode-specific format / post-processing. Video prefers H.264 (avc1) so it
  // plays in Electron; audio extracts to mp3 via ffmpeg at best quality.
  const modeArgs =
    mode === "video"
      ? [
          "-f",
          ffmpegAvailable
            ? "bestvideo[vcodec^=avc1]+bestaudio/best[vcodec^=avc1]/best"
            : "best[ext=mp4]/best",
          ...(ffmpegAvailable ? ["--merge-output-format", "mp4"] : []),
        ]
      : [
          "-f",
          "bestaudio/best",
          "-x",
          "--audio-format",
          "mp3",
          "--audio-quality",
          "0",
        ];

  const args = [
    url,
    "-o",
    outputTemplate,
    ...modeArgs,
    ...(ffmpegAvailable
      ? ["--ffmpeg-location", path.dirname(ffmpegPath!)]
      : []),
    "--newline",
    "--progress",
    "--no-playlist",
    "--restrict-filenames",
    "--no-js-runtimes",
    "--js-runtimes",
    `quickjs:${getQjsPath()}`,
  ];

  progress.status = "downloading";
  notify(mode, progress);

  const proc = spawn(ytdlpPath, args);
  activeDownloads.set(downloadId, { process: proc, progress, mode });

  let outputFilePath: string | null = null;

  const setStage = (stage: DownloadStage) => {
    if (progress.stage === stage) return;
    progress.stage = stage;
    notify(mode, progress);
  };

  proc.stdout?.on("data", (data: Buffer) => {
    const output = data.toString();

    // yt-dlp's first stdout is the `[youtube] Extracting URL:` / `[info]` block —
    // switch "preparing" → "fetching" so the UI shows progress past cold-start.
    if ((/\[youtube\]|\[info\]/.test(output)) && progress.stage === "preparing") {
      setStage("fetching");
    }

    // [download]  50.0% of 100.00MiB at 10.00MiB/s ETA 00:05
    const progressMatch = output.match(
      /\[download\]\s+([\d.]+)%\s+of\s+([\d.]+\w+)\s+at\s+([\d.]+\w+\/s)\s+ETA\s+(\S+)/
    );
    if (progressMatch) {
      progress.progress = parseFloat(progressMatch[1]);
      progress.speed = progressMatch[3];
      progress.eta = progressMatch[4];
      progress.stage = "downloading";
      notify(mode, progress);
    }

    // [download] Destination: /path/to/file.ext
    const destMatch = output.match(/\[download\] Destination: (.+)/);
    if (destMatch) {
      outputFilePath = destMatch[1].trim();
      // Expose the title (from the filename yt-dlp chose) so the UI can
      // switch from URL to title as soon as the download starts.
      const basename = path.basename(
        outputFilePath,
        path.extname(outputFilePath),
      );
      progress.filename = basename.replace(/_/g, " ");
      setStage("downloading");
    }

    // [Merger] Merging formats into "/path/to/video.mp4"
    const mergerMatch = output.match(/\[Merger\] Merging formats into "(.+)"/);
    if (mergerMatch) {
      outputFilePath = mergerMatch[1];
      setStage("merging");
    }

    // [ExtractAudio] Destination: /path/to/file.mp3   (also FixupM4a, etc.)
    const extractMatch = output.match(
      /\[(?:ExtractAudio|FixupM4a|Fixup)\][^\n]*?Destination:\s*"?([^"\n]+?\.(?:mp4|m4a|mp3|webm|mkv|opus|ogg))"?/i
    );
    if (extractMatch) {
      outputFilePath = extractMatch[1];
      setStage("extracting");
    }

    // [download] /path/to/file has already been downloaded
    const alreadyMatch = output.match(
      /\[download\] (.+) has already been downloaded/
    );
    if (alreadyMatch) {
      outputFilePath = alreadyMatch[1].trim();
      const basename = path.basename(
        outputFilePath,
        path.extname(outputFilePath),
      );
      progress.filename = basename.replace(/_/g, " ");
    }
  });

  proc.stderr?.on("data", (data: Buffer) => {
    console.error("yt-dlp stderr:", data.toString());
  });

  proc.on("close", async (code) => {
    activeDownloads.delete(downloadId);

    // Fallback: if we missed the destination line, or if the captured path
    // no longer exists (yt-dlp deletes the intermediate after audio extract),
    // find the most recent file in the output dir.
    const fallbackExt =
      mode === "video"
        ? /\.(mp4|webm|mkv|mov)$/i
        : /\.(mp3|m4a|opus|ogg)$/i;
    if (code === 0 && (!outputFilePath || !fs.existsSync(outputFilePath))) {
      const files = fs
        .readdirSync(outputDir)
        .filter((f) => fallbackExt.test(f))
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
      notify(mode, progress);

      // yt-dlp uses the video title as filename (with --restrict-filenames
      // which replaces spaces with underscores), so convert back for display.
      const basename = path.basename(
        outputFilePath,
        path.extname(outputFilePath)
      );
      const title = basename.replace(/_/g, " ");

      try {
        if (mode === "video") {
          const video = await getVideoLibrary().addVideo(outputFilePath, "youtube", {
            name: title,
            sourceUrl: url,
            copyToLibrary: false,
          });
          progress.videoId = video.id;
          progress.filename = video.filename;
        } else {
          const audio = await getAudioLibrary().addAudio(outputFilePath, "youtube", {
            name: title,
            copyToLibrary: false,
          });
          progress.audioId = audio.id;
          progress.filename = audio.filename;
        }
        progress.status = "complete";
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

    notify(mode, progress);
  });

  proc.on("error", (err) => {
    activeDownloads.delete(downloadId);
    progress.status = "error";
    progress.error = `Process error: ${err.message}`;
    notify(mode, progress);
  });

  return progress;
}

export function startDownload(url: string): DownloadProgress {
  return startYoutubeDownload(url, "video") as DownloadProgress;
}

export function startAudioDownload(url: string): AudioDownloadProgress {
  return startYoutubeDownload(url, "audio") as AudioDownloadProgress;
}

export function cancelDownload(downloadId: string): boolean {
  const download = activeDownloads.get(downloadId);
  if (!download) return false;

  download.process.kill();
  activeDownloads.delete(downloadId);

  download.progress.status = "error";
  download.progress.error = "Cancelled by user";
  notify(download.mode, download.progress);

  return true;
}

export function getActiveDownloads(): DownloadProgress[] {
  return Array.from(activeDownloads.values())
    .filter((d) => d.mode === "video")
    .map((d) => d.progress as DownloadProgress);
}

export function getActiveAudioDownloads(): AudioDownloadProgress[] {
  return Array.from(activeDownloads.values())
    .filter((d) => d.mode === "audio")
    .map((d) => d.progress as AudioDownloadProgress);
}

export function getDownloadProgress(
  downloadId: string
): DownloadProgress | null {
  return (activeDownloads.get(downloadId)?.progress as DownloadProgress) || null;
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
