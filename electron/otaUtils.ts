import { net } from "electron";
import fs from "fs";
import path from "path";

export interface DownloadOptions {
  executable?: boolean;
  onProgress?: (bytesDownloaded: number, bytesTotal: number) => void;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export async function fetchJSON<T = any>(
  url: string,
  headers?: Record<string, string>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = net.request(url);
    if (headers) {
      for (const [k, v] of Object.entries(headers)) request.setHeader(k, v);
    }
    let body = "";
    request.on("response", (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400
      ) {
        const location = response.headers["location"];
        const redirectUrl = Array.isArray(location) ? location[0] : location;
        if (redirectUrl) {
          fetchJSON<T>(redirectUrl, headers).then(resolve).catch(reject);
          return;
        }
      }
      response.on("data", (chunk: Buffer) => (body += chunk.toString()));
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error("Failed to parse JSON"));
        }
      });
    });
    request.on("error", reject);
    request.end();
  });
}

export async function downloadFile(
  url: string,
  destPath: string,
  opts: DownloadOptions = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    let aborted = false;
    const request = net.request(url);

    if (opts.headers) {
      for (const [k, v] of Object.entries(opts.headers)) {
        request.setHeader(k, v);
      }
    }

    const onAbort = () => {
      aborted = true;
      try {
        request.abort();
      } catch {}
      reject(new Error("Aborted"));
    };
    if (opts.signal) {
      if (opts.signal.aborted) {
        onAbort();
        return;
      }
      opts.signal.addEventListener("abort", onAbort, { once: true });
    }

    request.on("response", (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400
      ) {
        const location = response.headers["location"];
        const redirectUrl = Array.isArray(location) ? location[0] : location;
        if (redirectUrl) {
          downloadFile(redirectUrl, destPath, opts).then(resolve).catch(reject);
          return;
        }
      }

      if (!response.statusCode || response.statusCode >= 400) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const contentLengthHeader = response.headers["content-length"];
      const totalBytes = contentLengthHeader
        ? parseInt(
            Array.isArray(contentLengthHeader)
              ? contentLengthHeader[0]
              : contentLengthHeader,
            10,
          )
        : 0;
      let bytesDownloaded = 0;

      const tmpPath = `${destPath}.tmp`;
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      const file = fs.createWriteStream(tmpPath);

      response.on("data", (chunk: Buffer) => {
        if (aborted) return;
        file.write(chunk);
        bytesDownloaded += chunk.length;
        opts.onProgress?.(bytesDownloaded, totalBytes);
      });
      response.on("end", () => {
        if (aborted) return;
        file.end(() => {
          try {
            fs.renameSync(tmpPath, destPath);
            if (opts.executable && process.platform !== "win32") {
              fs.chmodSync(destPath, 0o755);
            }
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    });
    request.on("error", (err) => {
      if (!aborted) reject(err);
    });
    request.end();
  });
}

export interface FetchWithEtagResult {
  updated: boolean;
  etag: string | null;
}

export async function fetchWithEtag(
  url: string,
  destPath: string,
  etagPath: string,
): Promise<FetchWithEtagResult> {
  let cachedEtag: string | null = null;
  try {
    const raw = fs.readFileSync(etagPath, "utf-8").trim();
    cachedEtag = raw || null;
  } catch {}

  return new Promise((resolve, reject) => {
    const request = net.request(url);
    if (cachedEtag) {
      request.setHeader("If-None-Match", cachedEtag);
    }

    request.on("response", (response) => {
      if (response.statusCode === 304) {
        response.on("data", () => {});
        response.on("end", () => resolve({ updated: false, etag: cachedEtag }));
        return;
      }

      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400
      ) {
        const location = response.headers["location"];
        const redirectUrl = Array.isArray(location) ? location[0] : location;
        if (redirectUrl) {
          fetchWithEtag(redirectUrl, destPath, etagPath).then(resolve).catch(reject);
          return;
        }
      }

      if (!response.statusCode || response.statusCode >= 400) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const etagHeader = response.headers["etag"];
      const newEtag = etagHeader
        ? Array.isArray(etagHeader)
          ? etagHeader[0]
          : etagHeader
        : null;

      const tmpPath = `${destPath}.tmp`;
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      const file = fs.createWriteStream(tmpPath);
      response.on("data", (chunk: Buffer) => file.write(chunk));
      response.on("end", () => {
        file.end(() => {
          try {
            fs.renameSync(tmpPath, destPath);
            if (newEtag) {
              fs.mkdirSync(path.dirname(etagPath), { recursive: true });
              fs.writeFileSync(etagPath, newEtag);
            }
            resolve({ updated: true, etag: newEtag });
          } catch (err) {
            reject(err);
          }
        });
      });
    });
    request.on("error", reject);
    request.end();
  });
}
