import type { Hymn } from "./types";

/**
 * Convert a local file path to a file:// URL (handles Windows backslashes)
 */
export function getFileUrl(filePath: string): string {
  if (filePath.startsWith("file://")) return filePath;
  const normalizedPath = filePath.replace(/\\/g, "/");
  const prefix = normalizedPath.startsWith("/") ? "file://" : "file:///";
  return `${prefix}${normalizedPath}`;
}

/**
 * Format seconds as M:SS (e.g. 3:07). Returns "--:--" for null.
 */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "--:--";
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format bytes as human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Format a timestamp as a localized date string
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Remove diacritics from text (ă→a, â→a, î→i, ș→s, ț→t, etc.)
 */
export function removeDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normalize text for search: remove diacritics, lowercase, trim
 */
export function normalizeForSearch(text: string): string {
  return removeDiacritics(text.toLowerCase().trim());
}

/**
 * Binary search for the largest font size (in px) that passes a fit test.
 */
export function findOptimalFontSize(
  min: number,
  max: number,
  testFit: (size: number) => boolean,
): number {
  let optimalSize = min;
  while (min <= max) {
    const mid = Math.floor((min + max) / 2);
    if (testFit(mid)) {
      optimalSize = mid;
      min = mid + 1;
    } else {
      max = mid - 1;
    }
  }
  return optimalSize;
}

/**
 * Format a timestamp as a relative time string (e.g. "just now", "5m ago", "2h ago").
 * Requires the `common` translations object with justNow, minutesAgo, hoursAgo, daysAgo keys.
 * Templates use {n} as the number placeholder.
 */
export function formatTimeAgo(
  timestamp: number,
  common: { justNow: string; minutesAgo: string; hoursAgo: string; daysAgo: string }
): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return common.justNow;
  if (mins < 60) return common.minutesAgo.replace("{n}", String(mins));
  const hours = Math.floor(mins / 60);
  if (hours < 24) return common.hoursAgo.replace("{n}", String(hours));
  const days = Math.floor(hours / 24);
  return common.daysAgo.replace("{n}", String(days));
}

/**
 * Extract pairing key from URL query parameter (only present on first-time pairing)
 */
export function getSecurityKeyFromURL(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("key");
}

const DEVICE_TOKEN_STORAGE_KEY = "bishub_device_token";

export function getDeviceToken(): string | null {
  try {
    return window.localStorage.getItem(DEVICE_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setDeviceToken(token: string): void {
  try {
    window.localStorage.setItem(DEVICE_TOKEN_STORAGE_KEY, token);
  } catch {
    // localStorage unavailable (private mode, etc.) — non-fatal
  }
}

export function clearDeviceToken(): void {
  try {
    window.localStorage.removeItem(DEVICE_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Build an authenticated API URL. Prefers the stored device token; falls back
 * to the URL pairing key (used only before pairing completes).
 */
export function getApiUrl(path: string): string {
  const token = getDeviceToken();
  if (token) {
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}token=${token}`;
  }
  const key = getSecurityKeyFromURL();
  if (!key) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}key=${key}`;
}

/**
 * Upload a file with progress tracking via XMLHttpRequest.
 * Returns a promise that resolves when the upload completes.
 */
export function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error("Upload failed"));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

    xhr.send(formData);
  });
}

// yt-dlp handles every one of these forms natively (they all resolve to the same
// video id), so we pass the URL through untouched — this list only exists to give
// the user an error before a download starts. Keep it in sync with what yt-dlp's
// YouTube extractor accepts rather than rewriting URLs ourselves.
const YOUTUBE_URL_PATTERNS = [
  /^https?:\/\/(www\.|m\.|music\.)?youtube\.com\/(watch\?|shorts\/|live\/|embed\/|v\/)/,
  /^https?:\/\/youtu\.be\/[\w-]+/,
];

export function isValidYouTubeUrl(url: string): boolean {
  return YOUTUBE_URL_PATTERNS.some((p) => p.test(url));
}

function shallowEqual<T extends object>(a: T, b: T): boolean {
  const ak = Object.keys(a) as (keyof T)[];
  const bk = Object.keys(b) as (keyof T)[];
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (a[k] !== b[k]) return false;
  return true;
}

const TERMINAL_PROGRESS_STATUSES = ["complete", "error", "cancelled"];

/**
 * Update a progress list: upsert by id, auto-remove finished items after a delay.
 * Returns `prev` unchanged when the incoming progress is field-equal to the existing entry,
 * so high-frequency tick events (yt-dlp emits many per second) don't trigger pointless renders.
 */
export function updateProgressList<T extends { id: string; status: string }>(
  prev: T[],
  progress: T,
  setter: (updater: (prev: T[]) => T[]) => void,
  delay = 3000,
): T[] {
  if (TERMINAL_PROGRESS_STATUSES.includes(progress.status)) {
    setTimeout(() => {
      setter((p) => p.filter((item) => item.id !== progress.id));
    }, delay);
  }
  const index = prev.findIndex((item) => item.id === progress.id);
  if (index === -1) return [...prev, progress];
  if (shallowEqual(prev[index], progress)) return prev;
  const updated = [...prev];
  updated[index] = progress;
  return updated;
}

/**
 * Verse count and chorus presence for a hymn, derived from its blocks.
 * Counts distinct blocks rather than sequence entries, so a chorus that recurs
 * after every verse still reports as one chorus.
 */
export function summarizeHymn(hymn: Hymn): {
  verseCount: number;
  hasChorus: boolean;
} {
  let verseCount = 0;
  let hasChorus = false;
  for (const block of hymn.blocks) {
    if (block.kind === "verse") verseCount++;
    else if (block.kind === "chorus") hasChorus = true;
  }
  return { verseCount, hasChorus };
}
