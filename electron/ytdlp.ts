import { spawn, execSync, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { app } from "electron";
import { v4 as uuidv4 } from "uuid";
import { getVideoLibrary } from "./videoLibrary";
import type { DownloadProgress } from "../src/shared/videoLibrary.types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if ffmpeg is available - check bundled binary first
// Uses lazy evaluation to ensure app.isPackaged is correctly set
let _ffmpegAvailable: boolean | undefined;

function checkFfmpegAvailable(): boolean {
  const isWindows = process.platform === "win32";
  const binaryName = isWindows ? "ffmpeg.exe" : "ffmpeg";
  const isPackaged = app.isPackaged;

  console.log(`checkFfmpegAvailable: isPackaged=${isPackaged}, platform=${process.platform}`);

  // Check for bundled binary first
  let bundledPath: string;
  if (isPackaged) {
    bundledPath = path.join(process.resourcesPath, "bin", binaryName);
  } else {
    const osDir = isWindows ? "win32" : process.platform === "darwin" ? "darwin" : "linux";
    bundledPath = path.join(__dirname, "..", "bin", osDir, binaryName);
  }

  console.log(`checkFfmpegAvailable: checking bundled path: ${bundledPath}`);

  if (fs.existsSync(bundledPath)) {
    console.log(`Found bundled ffmpeg at: ${bundledPath}`);
    return true;
  }

  console.log(`checkFfmpegAvailable: bundled not found, checking system paths`);

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
      "ffmpeg",
      "/opt/homebrew/bin/ffmpeg",
      "/usr/local/bin/ffmpeg",
      "/usr/bin/ffmpeg"
    );
  }

  for (const ffmpegPath of paths) {
    try {
      execSync(`"${ffmpegPath}" -version`, { stdio: "ignore", shell: true });
      console.log(`Found system ffmpeg at: ${ffmpegPath}`);
      return true;
    } catch {
      // Try next path
    }
  }

  console.log(`checkFfmpegAvailable: ffmpeg not found anywhere`);
  return false;
}

function isFfmpegAvailable(): boolean {
  if (_ffmpegAvailable === undefined) {
    _ffmpegAvailable = checkFfmpegAvailable();
    console.log(`ffmpeg available: ${_ffmpegAvailable}`);
  }
  return _ffmpegAvailable;
}

// Active downloads map
const activeDownloads = new Map<
  string,
  { process: ChildProcess; progress: DownloadProgress }
>();

function getYtdlpPath(): string {
  const platform = process.platform;
  const isPackaged = app.isPackaged;

  let binaryName: string;
  switch (platform) {
    case "win32":
      binaryName = "yt-dlp.exe";
      break;
    case "darwin":
    case "linux":
    default:
      binaryName = "yt-dlp";
      break;
  }

  if (isPackaged) {
    // In packaged app, binary is in resources/bin/
    return path.join(process.resourcesPath, "bin", binaryName);
  } else {
    // In development, binary is in project bin/{os}/
    const osDir =
      platform === "darwin"
        ? "darwin"
        : platform === "win32"
        ? "win32"
        : "linux";
    return path.join(__dirname, "..", "bin", osDir, binaryName);
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
