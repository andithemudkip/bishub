#!/usr/bin/env node
// Sync hymn assets (TTML bundle + MP3 instrumentals + manifest) to S3.
//
// Usage:
//   npm run upload-assets             # uploads everything that changed
//   npm run upload-assets -- --ttml   # only TTML bundle
//   npm run upload-assets -- --mp3    # only MP3s + manifest
//
// Reads AWS creds from .env.local (gitignored). Expected env vars:
//   AWS_REGION
//   AWS_ACCESS_KEY_ID
//   AWS_SECRET_ACCESS_KEY
//   BISHUB_ASSETS_BUCKET    (S3 bucket name)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import mime from "mime-types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

// Load .env.local manually (no extra dep needed)
const envPath = path.join(repoRoot, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

const BUCKET = process.env.BISHUB_ASSETS_BUCKET;
const REGION = process.env.AWS_REGION;
if (!BUCKET || !REGION) {
  console.error(
    "Missing BISHUB_ASSETS_BUCKET or AWS_REGION. Set them in .env.local or env.",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const onlyTTML = args.includes("--ttml");
const onlyMP3 = args.includes("--mp3");
const doTTML = !onlyMP3; // default: do both
const doMP3 = !onlyTTML;

const client = new S3Client({ region: REGION });

function md5Hex(buf) {
  return crypto.createHash("md5").update(buf).digest("hex");
}

async function getRemoteEtag(key) {
  try {
    const head = await client.send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: key }),
    );
    return (head.ETag || "").replace(/^"|"$/g, "");
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

async function uploadIfChanged(key, body, contentType, cacheControl) {
  const localEtag = md5Hex(body);
  const remoteEtag = await getRemoteEtag(key);
  if (remoteEtag === localEtag) {
    console.log(`  = ${key} (unchanged)`);
    return false;
  }
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
  console.log(`  ✓ ${key} (${(body.length / 1024).toFixed(1)} KB)`);
  return true;
}

async function uploadTTML() {
  console.log("[upload-assets] TTML bundle");
  // Build the bundle first to make sure it's current.
  execSync("npm run build:ttml", { cwd: repoRoot, stdio: "inherit" });
  const bundlePath = path.join(repoRoot, "assets", "hymns-ttml.json");
  const body = fs.readFileSync(bundlePath);
  await uploadIfChanged(
    "hymns-ttml.json",
    body,
    "application/json",
    "no-cache",
  );
}

async function uploadMP3s() {
  console.log("[upload-assets] MP3 instrumentals");
  const sourceDir = path.join(repoRoot, "mp3-source");
  if (!fs.existsSync(sourceDir)) {
    console.error(
      `  Source dir not found: ${sourceDir} — create it and put MP3s there.`,
    );
    return;
  }
  const files = fs
    .readdirSync(sourceDir)
    .filter((f) => f.toLowerCase().endsWith(".mp3"))
    .sort();

  const available = [];
  for (const file of files) {
    const number = path.basename(file, path.extname(file)).padStart(3, "0");
    available.push(number);
    const key = `mp3/${number}.mp3`;
    const body = fs.readFileSync(path.join(sourceDir, file));
    const ct = mime.lookup(file) || "audio/mpeg";
    // MP3s rarely change — long TTL is fine.
    await uploadIfChanged(key, body, ct, "public, max-age=31536000, immutable");
  }

  console.log("[upload-assets] mp3-manifest.json");
  const manifest = JSON.stringify({ available });
  await uploadIfChanged(
    "mp3-manifest.json",
    Buffer.from(manifest, "utf-8"),
    "application/json",
    "no-cache",
  );
}

(async () => {
  try {
    if (doTTML) await uploadTTML();
    if (doMP3) await uploadMP3s();
    console.log("[upload-assets] Done.");
  } catch (err) {
    console.error("[upload-assets] Failed:", err);
    process.exit(1);
  }
})();
