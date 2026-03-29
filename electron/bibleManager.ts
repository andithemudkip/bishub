import { app, net } from "electron";
import fs from "fs";
import path from "path";
import type { BibleData } from "../src/shared/types";
import {
  getTranslationById,
  BIBLE_TRANSLATIONS,
} from "../src/shared/bibleTranslations";
import { parseBible } from "./bibleParsers";
import { fileURLToPath } from "url";

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GITHUB_RAW_BASE =
  "https://raw.githubusercontent.com/seven1m/open-bibles/master";

const MAX_CACHED = 3;

const bibleCache = new Map<string, BibleData>();
const cacheOrder: string[] = [];

function getBiblesDir(): string {
  return path.join(app.getPath("userData"), "bibles");
}

function ensureBiblesDir(): void {
  const dir = getBiblesDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getTranslationPath(translationId: string): string | null {
  const info = getTranslationById(translationId);
  if (!info) return null;
  return path.join(getBiblesDir(), info.filename);
}

function getAssetsPath(): string {
  return path.join(__dirname, "..", "assets");
}

export function isTranslationDownloaded(translationId: string): boolean {
  const info = getTranslationById(translationId);
  if (!info) return false;
  if (info.bundled) return true;
  const filePath = getTranslationPath(translationId);
  return filePath !== null && fs.existsSync(filePath);
}

function downloadFile(
  url: string,
  destPath: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = net.request(url);
    request.on("response", (response) => {
      // Follow redirects
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400
      ) {
        const location = response.headers["location"];
        const redirectUrl = Array.isArray(location) ? location[0] : location;
        if (redirectUrl) {
          downloadFile(redirectUrl, destPath, onProgress)
            .then(resolve)
            .catch(reject);
          return;
        }
      }

      if (response.statusCode && response.statusCode >= 400) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const contentLength = response.headers["content-length"];
      const totalSize = contentLength
        ? parseInt(
            Array.isArray(contentLength) ? contentLength[0] : contentLength,
            10
          )
        : 0;
      let downloaded = 0;
      const tmpPath = `${destPath}.tmp`;
      const file = fs.createWriteStream(tmpPath);

      response.on("data", (chunk) => {
        file.write(chunk);
        downloaded += chunk.length;
        if (totalSize > 0 && onProgress) {
          onProgress(Math.round((downloaded / totalSize) * 100));
        }
      });
      response.on("end", () => {
        file.end(() => {
          try {
            fs.renameSync(tmpPath, destPath);
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    });
    request.on("error", (err) => {
      const tmpPath = `${destPath}.tmp`;
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch {}
      reject(err);
    });
    request.end();
  });
}

export async function downloadTranslation(
  translationId: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  const info = getTranslationById(translationId);
  if (!info) throw new Error(`Unknown translation: ${translationId}`);
  if (info.bundled) return; // Bundled translations don't need downloading

  ensureBiblesDir();
  const destPath = path.join(getBiblesDir(), info.filename);
  const url = `${GITHUB_RAW_BASE}/${info.filename}`;
  await downloadFile(url, destPath, onProgress);
}

// ── LRU Cache ────────────────────────────────────────────────────────────────

function evictCache(): void {
  while (cacheOrder.length >= MAX_CACHED) {
    const oldest = cacheOrder.shift()!;
    bibleCache.delete(oldest);
  }
}

function touchCache(translationId: string): void {
  const idx = cacheOrder.indexOf(translationId);
  if (idx !== -1) cacheOrder.splice(idx, 1);
  cacheOrder.push(translationId);
}

export function loadTranslation(translationId: string): BibleData | null {
  if (bibleCache.has(translationId)) {
    touchCache(translationId);
    return bibleCache.get(translationId)!;
  }

  const info = getTranslationById(translationId);
  if (!info) return null;

  const filePath = info.bundled
    ? path.join(getAssetsPath(), info.bundled)
    : getTranslationPath(translationId);

  if (!filePath || !fs.existsSync(filePath)) return null;

  try {
    const xml = fs.readFileSync(filePath, "utf-8");
    const data = parseBible(xml, info.format);

    evictCache();
    bibleCache.set(translationId, data);
    touchCache(translationId);

    return data;
  } catch (error) {
    console.error(`Failed to parse Bible ${translationId}:`, error);
    return null;
  }
}

export function getDownloadedTranslationIds(): string[] {
  ensureBiblesDir();
  const ids: string[] = [];
  try {
    const files = fs.readdirSync(getBiblesDir());
    for (const t of BIBLE_TRANSLATIONS) {
      if (t.bundled || files.includes(t.filename)) {
        ids.push(t.id);
      }
    }
  } catch {
    for (const t of BIBLE_TRANSLATIONS) {
      if (t.bundled) ids.push(t.id);
    }
  }
  return ids;
}
