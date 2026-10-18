import fs from "fs";
import path from "path";

/**
 * Busboy (under multer 1.x) decodes multipart filenames as latin1, so a
 * browser's UTF-8 "Cântare.mp4" arrives as "CÃ¢ntare.mp4". Reinterpret the
 * bytes as UTF-8; if they aren't valid UTF-8 the name really was latin1, and
 * a name with characters above U+00FF was already decoded — keep those as-is.
 */
export function decodeUploadName(name: string): string {
  const codes = Array.from(name, (c) => c.charCodeAt(0));
  if (!codes.some((c) => c >= 0x80) || codes.some((c) => c > 0xff)) return name;
  const decoded = Buffer.from(name, "latin1").toString("utf8");
  return decoded.includes("\uFFFD") ? name : decoded;
}

const MAX_BASE_LENGTH = 150;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/**
 * A filename safe to write on macOS, Windows and Linux that still reads like
 * the original: path separators, characters Windows rejects and control
 * characters become "_", trailing dots/spaces go, and reserved device names
 * get a prefix.
 */
export function safeFilename(name: string): string {
  const ext = path.extname(name).replace(/[^\w.-]/g, "");
  let base = name
    .slice(0, name.length - path.extname(name).length)
    .replace(/[<>:"/\\|?*]/g, "_")
    .split("")
    .map((c) => (c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f ? "_" : c))
    .join("")
    .replace(/[. ]+$/, "")
    .trim()
    .slice(0, MAX_BASE_LENGTH)
    .trim();
  if (!base || /^_+$/.test(base)) base = "file";
  if (WINDOWS_RESERVED.test(base)) base = `_${base}`;
  return `${base}${ext}`;
}

/**
 * Claim a path in `dir` for `filename` — "name.ext", then "name (2).ext",
 * "name (3).ext", … — by creating it empty, so two uploads with the same name
 * can't both pick it while their bytes are still being written.
 */
export function claimFilePath(dir: string, filename: string): string {
  const ext = path.extname(filename);
  const base = filename.slice(0, filename.length - ext.length);
  for (let n = 1; ; n++) {
    const candidate = path.join(dir, n === 1 ? filename : `${base} (${n})${ext}`);
    try {
      fs.closeSync(fs.openSync(candidate, "wx"));
      return candidate;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }
  }
}

/** Move an upload multer saved under a random name to its original name. */
export function moveToOriginalName(tempPath: string, originalName: string): string {
  const finalPath = claimFilePath(path.dirname(tempPath), safeFilename(originalName));
  fs.renameSync(tempPath, finalPath);
  return finalPath;
}

/**
 * Copy `sourcePath` into `dir` under its own (sanitised) name, numbered if
 * taken. Returns the new path.
 */
export async function copyIntoDir(sourcePath: string, dir: string): Promise<string> {
  const finalPath = claimFilePath(dir, safeFilename(path.basename(sourcePath)));
  try {
    await fs.promises.copyFile(sourcePath, finalPath);
  } catch (err) {
    await fs.promises.rm(finalPath, { force: true });
    throw err;
  }
  return finalPath;
}
