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
 * Extract security key from URL query parameter for web remote authentication
 */
export function getSecurityKeyFromURL(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("key");
}

/**
 * Update a progress list: upsert by id, auto-remove completed/errored items after a delay.
 */
export function updateProgressList<T extends { id: string; status: string }>(
  prev: T[],
  progress: T,
  setter: (updater: (prev: T[]) => T[]) => void,
  delay = 3000,
): T[] {
  if (progress.status === "complete" || progress.status === "error") {
    setTimeout(() => {
      setter((p) => p.filter((item) => item.id !== progress.id));
    }, delay);
  }
  const index = prev.findIndex((item) => item.id === progress.id);
  if (index === -1) return [...prev, progress];
  const updated = [...prev];
  updated[index] = progress;
  return updated;
}
