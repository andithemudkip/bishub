import { app } from "electron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  downloadFile,
  fetchJSON,
  fetchWithEtag,
} from "./otaUtils";
import type {
  MP3CacheStats,
  MP3DownloadProgress,
  MP3DownloadStatus,
  SyncedAvailability,
} from "../src/shared/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Public S3 endpoint. Add CloudFront in front later if egress costs become a concern.
// Override via BISHUB_ASSETS_BASE_URL env var for local testing against a different bucket.
const BASE_URL =
  process.env.BISHUB_ASSETS_BASE_URL ||
  "https://bishub-hymn-assets.s3.eu-central-1.amazonaws.com";

const TTML_BUNDLE_FILENAME = "hymns-ttml.json";
const TTML_ETAG_FILENAME = "hymns-ttml.etag";
const MP3_MANIFEST_FILENAME = "mp3-manifest.json";
const BULK_DOWNLOAD_CONCURRENCY = 3;
const ESTIMATED_MP3_BYTES = 5 * 1024 * 1024; // upper estimate for disk-space precheck
const DISK_SPACE_BUFFER_BYTES = 500 * 1024 * 1024;

function padHymnNumber(n: string): string {
  return n.padStart(3, "0");
}

function getBundledTTMLBundlePath(): string {
  return path.join(__dirname, "..", "assets", TTML_BUNDLE_FILENAME);
}

function getUserDataDir(): string {
  return app.getPath("userData");
}

function getCachedTTMLBundlePath(): string {
  return path.join(getUserDataDir(), TTML_BUNDLE_FILENAME);
}

function getEtagPath(): string {
  return path.join(getUserDataDir(), TTML_ETAG_FILENAME);
}

function getManifestPath(): string {
  return path.join(getUserDataDir(), MP3_MANIFEST_FILENAME);
}

function getMP3Dir(): string {
  return path.join(getUserDataDir(), "hymns", "mp3");
}

function getMP3PathForNumber(padded: string): string {
  return path.join(getMP3Dir(), `${padded}.mp3`);
}

// --- TTML bundle (in-memory cache) ---

let ttmlBundleCache: Record<string, string> | null = null;

function loadTTMLBundle(): Record<string, string> {
  if (ttmlBundleCache) return ttmlBundleCache;

  for (const p of [getCachedTTMLBundlePath(), getBundledTTMLBundlePath()]) {
    try {
      const raw = fs.readFileSync(p, "utf-8");
      ttmlBundleCache = JSON.parse(raw) as Record<string, string>;
      return ttmlBundleCache;
    } catch {}
  }
  ttmlBundleCache = {};
  return ttmlBundleCache;
}

function invalidateTTMLBundleCache(): void {
  ttmlBundleCache = null;
}

export function getHymnTTMLContent(number: string): string | null {
  return loadTTMLBundle()[padHymnNumber(number)] ?? null;
}

// --- MP3 manifest (in-memory cache) ---

interface MP3Manifest {
  available: string[];
}

let manifestSet: Set<string> | null = null;
let manifestSize = 0;

function loadManifest(): { set: Set<string>; size: number } {
  if (manifestSet) return { set: manifestSet, size: manifestSize };
  let raw: string;
  try {
    raw = fs.readFileSync(getManifestPath(), "utf-8");
  } catch {
    manifestSet = new Set();
    manifestSize = 0;
    return { set: manifestSet, size: manifestSize };
  }
  try {
    const parsed = JSON.parse(raw) as MP3Manifest;
    manifestSet = new Set((parsed.available ?? []).map(padHymnNumber));
  } catch {
    manifestSet = new Set();
  }
  manifestSize = manifestSet.size;
  return { set: manifestSet, size: manifestSize };
}

function invalidateManifestCache(): void {
  manifestSet = null;
  manifestSize = 0;
}

function isMP3Available(padded: string): boolean {
  return loadManifest().set.has(padded);
}

// --- Cached MP3 file index + running stats ---
//
// `getSyncedAvailability` runs against every hymn on every `loadHymns()` call
// (~920 hymns), so a per-call `fs.existsSync` would be a syscall storm during
// bulk downloads. We track the on-disk MP3 set in memory, populated once at
// startup and mutated incrementally on download/delete.

let cachedMP3Numbers: Set<string> | null = null;
let cachedMP3SizeBytes = 0;

function loadMP3Index(): Set<string> {
  if (cachedMP3Numbers) return cachedMP3Numbers;
  const set = new Set<string>();
  let total = 0;
  try {
    const dir = getMP3Dir();
    for (const file of fs.readdirSync(dir)) {
      if (!file.toLowerCase().endsWith(".mp3")) continue;
      const padded = path.basename(file, path.extname(file));
      const stat = fs.statSync(path.join(dir, file));
      set.add(padded);
      total += stat.size;
    }
  } catch {}
  cachedMP3Numbers = set;
  cachedMP3SizeBytes = total;
  return cachedMP3Numbers;
}

function recordMP3Cached(padded: string, sizeBytes: number): void {
  const set = loadMP3Index();
  if (!set.has(padded)) {
    set.add(padded);
    cachedMP3SizeBytes += sizeBytes;
  }
}

function resetMP3Index(): void {
  cachedMP3Numbers = new Set();
  cachedMP3SizeBytes = 0;
}

function isMP3Cached(padded: string): boolean {
  return loadMP3Index().has(padded);
}

export function getMP3Path(number: string): string | null {
  const padded = padHymnNumber(number);
  return isMP3Cached(padded) ? getMP3PathForNumber(padded) : null;
}

export function getSyncedAvailability(number: string): SyncedAvailability {
  const padded = padHymnNumber(number);
  if (!loadTTMLBundle()[padded]) return "none";
  if (isMP3Cached(padded)) return "cached";
  if (isMP3Available(padded)) return "ttml-only";
  return "none";
}

// --- Download manager ---

type ProgressListener = (progress: MP3DownloadProgress) => void;
const progressListeners = new Set<ProgressListener>();

export function onMP3DownloadProgress(listener: ProgressListener): () => void {
  progressListeners.add(listener);
  return () => progressListeners.delete(listener);
}

function emitProgress(progress: MP3DownloadProgress): void {
  for (const listener of progressListeners) {
    try {
      listener(progress);
    } catch (err) {
      console.error("[hymnAssets] progress listener error:", err);
    }
  }
}

type AssetUpdateListener = () => void;
const assetUpdateListeners = new Set<AssetUpdateListener>();

export function onHymnAssetsUpdated(listener: AssetUpdateListener): () => void {
  assetUpdateListeners.add(listener);
  return () => assetUpdateListeners.delete(listener);
}

function emitAssetsUpdated(): void {
  for (const listener of assetUpdateListeners) {
    try {
      listener();
    } catch (err) {
      console.error("[hymnAssets] asset-update listener error:", err);
    }
  }
}

interface ActiveDownload {
  controller: AbortController;
  progress: MP3DownloadProgress;
}

const activeDownloads = new Map<string, ActiveDownload>();

function makeProgress(
  hymnNumber: string,
  status: MP3DownloadStatus,
  bytesDownloaded = 0,
  bytesTotal = 0,
  error?: string,
): MP3DownloadProgress {
  return {
    id: hymnNumber,
    hymnNumber,
    status,
    bytesDownloaded,
    bytesTotal,
    error,
  };
}

export async function downloadMP3(hymnNumber: string): Promise<void> {
  const padded = padHymnNumber(hymnNumber);
  if (activeDownloads.has(padded)) return;
  if (isMP3Cached(padded)) return;
  if (!isMP3Available(padded)) {
    emitProgress(makeProgress(padded, "error", 0, 0, "MP3 not available"));
    return;
  }

  const controller = new AbortController();
  const progress = makeProgress(padded, "downloading");
  activeDownloads.set(padded, { controller, progress });
  emitProgress(progress);

  const url = `${BASE_URL}/mp3/${padded}.mp3`;
  const destPath = getMP3PathForNumber(padded);

  try {
    await downloadFile(url, destPath, {
      signal: controller.signal,
      onProgress: (bytesDownloaded, bytesTotal) => {
        progress.bytesDownloaded = bytesDownloaded;
        progress.bytesTotal = bytesTotal;
        emitProgress(progress);
      },
    });
    progress.status = "complete";
    recordMP3Cached(padded, progress.bytesDownloaded);
    emitProgress(progress);
    emitAssetsUpdated();
  } catch (err: any) {
    if (controller.signal.aborted) {
      // Cancellation is silent — no error event.
    } else {
      progress.status = "error";
      progress.error = err?.message || String(err);
      emitProgress(progress);
      console.warn(`[hymnAssets] Failed to download MP3 ${padded}:`, err);
    }
  } finally {
    activeDownloads.delete(padded);
  }
}

export function cancelMP3Download(hymnNumber: string): void {
  const padded = padHymnNumber(hymnNumber);
  const active = activeDownloads.get(padded);
  if (!active) return;
  active.controller.abort();
}

export function cancelAllMP3Downloads(): void {
  for (const padded of Array.from(activeDownloads.keys())) {
    cancelMP3Download(padded);
  }
}

function getMissingMP3Numbers(): string[] {
  const { set: available } = loadManifest();
  const cached = loadMP3Index();
  const missing: string[] = [];
  for (const padded of available) {
    if (!cached.has(padded)) missing.push(padded);
  }
  return missing;
}

function getFreeDiskSpaceBytes(): number | null {
  try {
    const stats = fs.statfsSync(getUserDataDir());
    return Number(stats.bavail) * Number(stats.bsize);
  } catch {
    return null;
  }
}

export async function downloadAllMissingMP3s(): Promise<void> {
  const missing = getMissingMP3Numbers();
  if (missing.length === 0) return;

  const free = getFreeDiskSpaceBytes();
  const required = missing.length * ESTIMATED_MP3_BYTES + DISK_SPACE_BUFFER_BYTES;
  if (free !== null && free < required) {
    for (const padded of missing) {
      emitProgress(
        makeProgress(padded, "error", 0, 0, "Insufficient disk space"),
      );
    }
    return;
  }

  // Emit "queued" for everything up front so the UI can show the full list.
  for (const padded of missing) {
    if (!activeDownloads.has(padded)) {
      emitProgress(makeProgress(padded, "queued"));
    }
  }

  let cursor = 0;
  const workerCount = Math.min(BULK_DOWNLOAD_CONCURRENCY, missing.length);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i++) {
    workers.push(
      (async () => {
        while (true) {
          const idx = cursor++;
          if (idx >= missing.length) return;
          await downloadMP3(missing[idx]);
        }
      })(),
    );
  }
  await Promise.all(workers);
}

// --- Cache management ---

export function clearMP3Cache(): void {
  cancelAllMP3Downloads();
  try {
    fs.rmSync(getMP3Dir(), { recursive: true, force: true });
  } catch (err) {
    console.warn("[hymnAssets] Failed to clear MP3 cache:", err);
  }
  resetMP3Index();
  emitAssetsUpdated();
}

export function getMP3CacheStats(): MP3CacheStats {
  const cached = loadMP3Index();
  return {
    count: cached.size,
    sizeBytes: cachedMP3SizeBytes,
    availableCount: loadManifest().size,
  };
}

// --- OTA ---

async function refreshTTMLBundle(): Promise<boolean> {
  try {
    const result = await fetchWithEtag(
      `${BASE_URL}/${TTML_BUNDLE_FILENAME}`,
      getCachedTTMLBundlePath(),
      getEtagPath(),
    );
    if (result.updated) {
      invalidateTTMLBundleCache();
      console.log("[hymnAssets] TTML bundle updated from S3");
      return true;
    }
    return false;
  } catch (err) {
    console.warn("[hymnAssets] TTML bundle refresh failed:", err);
    return false;
  }
}

async function refreshManifest(): Promise<boolean> {
  try {
    const remote = await fetchJSON<MP3Manifest>(
      `${BASE_URL}/${MP3_MANIFEST_FILENAME}`,
    );
    if (!remote || !Array.isArray(remote.available)) return false;
    fs.mkdirSync(path.dirname(getManifestPath()), { recursive: true });
    fs.writeFileSync(getManifestPath(), JSON.stringify(remote));
    invalidateManifestCache();
    return true;
  } catch (err) {
    console.warn("[hymnAssets] Manifest refresh failed:", err);
    return false;
  }
}

/**
 * Background OTA check — fire-and-forget on app startup.
 * Refreshes the TTML bundle (ETag-gated) and MP3 manifest, then notifies
 * listeners so the hymn list can re-emit with up-to-date availability.
 */
export async function checkForHymnAssetUpdates(): Promise<void> {
  try {
    fs.mkdirSync(getUserDataDir(), { recursive: true });
    fs.mkdirSync(getMP3Dir(), { recursive: true });

    const [ttmlChanged, manifestChanged] = await Promise.all([
      refreshTTMLBundle(),
      refreshManifest(),
    ]);

    if (ttmlChanged || manifestChanged) {
      emitAssetsUpdated();
    }
  } catch (err) {
    console.warn("[hymnAssets] OTA check failed:", err);
  }
}
