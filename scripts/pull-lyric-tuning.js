#!/usr/bin/env node
// Fold karaoke timing corrections made in the app back into the generator.
//
// The app writes corrections to userData/lyric-tuning.json as they are dialled
// in by ear, and applies them at render time. This copies them into
// scripts/score-extract/overrides.json so the next generation bakes them into
// the TTML itself — otherwise they would live only on the machine that made
// them.
//
// Usage: npm run pull-lyric-tuning
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const overridesPath = path.join(repoRoot, "scripts", "score-extract", "overrides.json");

// Only imnuri-crestine has recordings, so only its corrections can be baked in.
const HYMNAL = "imnuri-crestine";

function userDataDir() {
  const name = "bishub";
  if (process.platform === "darwin")
    return path.join(os.homedir(), "Library", "Application Support", name);
  if (process.platform === "win32")
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), name);
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), name);
}

const tuningPath = path.join(userDataDir(), "lyric-tuning.json");
if (!fs.existsSync(tuningPath)) {
  console.log(`[pull-lyric-tuning] Nothing to pull — no ${tuningPath}`);
  process.exit(0);
}

const tuning = JSON.parse(fs.readFileSync(tuningPath, "utf-8"));
const book = tuning[HYMNAL] || {};
const numbers = Object.keys(book).sort();
if (numbers.length === 0) {
  console.log(`[pull-lyric-tuning] No corrections recorded for ${HYMNAL}.`);
  process.exit(0);
}

const overrides = fs.existsSync(overridesPath)
  ? JSON.parse(fs.readFileSync(overridesPath, "utf-8"))
  : {};

let added = 0;
let updated = 0;
for (const number of numbers) {
  const { offset = 0, breakpoints = [] } = book[number];
  const key = number.padStart(3, "0");
  const entry = { note: "tuned by ear in the app" };
  if (offset) entry.shift = Math.round(offset * 1000) / 1000;
  if (breakpoints.length) entry.breakpoints = breakpoints;
  if (!entry.shift && !entry.breakpoints) continue;
  if (overrides[key]) updated++;
  else added++;
  overrides[key] = { ...overrides[key], ...entry };
}

fs.writeFileSync(overridesPath, JSON.stringify(overrides, null, 2) + "\n");
console.log(
  `[pull-lyric-tuning] ${added} added, ${updated} updated in ` +
    `${path.relative(repoRoot, overridesPath)}. Re-run batch2.py to bake them in.`,
);
