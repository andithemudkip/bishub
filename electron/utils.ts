import { execSync, exec } from "child_process";
import path from "path";
import fs from "fs";
import { app } from "electron";
import { fileURLToPath } from "url";

// __filename and __dirname replacement for ES modules
// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find ffmpeg/ffprobe path - check bundled binary first, then system paths
// Uses lazy evaluation to ensure app.isPackaged is correctly set
let _ffmpegPath: string | null | undefined;
let _ffprobePath: string | null | undefined;

export function findBinaryPath(name: string): string | null {
  const isWindows = process.platform === "win32";
  const binaryName = isWindows ? `${name}.exe` : name;
  const isPackaged = app.isPackaged;

  console.log(
    `findBinaryPath(${name}): isPackaged=${isPackaged}, platform=${process.platform}`
  );

  // Check for bundled binary first
  let bundledPath: string;
  if (isPackaged) {
    bundledPath = path.join(process.resourcesPath, "bin", binaryName);
  } else {
    const osDir = isWindows
      ? "win32"
      : process.platform === "darwin"
      ? "darwin"
      : "linux";
    bundledPath = path.join(__dirname, "..", "bin", osDir, binaryName);
  }

  console.log(`findBinaryPath(${name}): checking bundled path: ${bundledPath}`);

  if (fs.existsSync(bundledPath)) {
    console.log(`Found bundled ${name} at: ${bundledPath}`);
    return bundledPath;
  }

  console.log(
    `findBinaryPath(${name}): bundled not found, checking system paths`
  );

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
      paths.push(
        path.join(localAppData, "Microsoft", "WinGet", "Links", binaryName)
      );
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
      execSync(`"${p}" -version`, { stdio: "ignore" });
      console.log(`Found system ${name} at: ${p}`);
      return p;
    } catch {
      // Try next
    }
  }

  console.log(`findBinaryPath(${name}): not found anywhere`);
  return null;
}

export function getFfmpegPath(): string | null {
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

export function getFfprobePath(): string | null {
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
