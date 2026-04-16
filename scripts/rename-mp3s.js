#!/usr/bin/env node
// Renames MP3s in mp3-source/ to the {padded}.mp3 format the upload script expects.
// Drive exports look like "1. Plecati-va lui Dumnezeu (1).mp3" — this strips
// everything after the leading number and zero-pads to 3 digits.
//
// Usage: npm run rename-mp3s
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.resolve(__dirname, "..", "mp3-source");

if (!fs.existsSync(sourceDir)) {
  console.error(`[rename-mp3s] mp3-source dir not found: ${sourceDir}`);
  process.exit(1);
}

const files = fs
  .readdirSync(sourceDir)
  .filter((f) => f.toLowerCase().endsWith(".mp3"));

if (files.length === 0) {
  console.log("[rename-mp3s] No .mp3 files in mp3-source/.");
  process.exit(0);
}

const plan = [];
const skipped = [];
const failed = [];
const targetCounts = new Map();

for (const file of files) {
  const match = file.match(/^(\d+)/);
  if (!match) {
    failed.push(file);
    continue;
  }
  const padded = match[1].padStart(3, "0");
  const target = `${padded}.mp3`;
  targetCounts.set(target, (targetCounts.get(target) ?? 0) + 1);
  if (file === target) {
    skipped.push(file);
    continue;
  }
  plan.push({ from: file, to: target });
}

if (failed.length > 0) {
  console.warn(`\n[rename-mp3s] ${failed.length} file(s) have no leading number — skipping:`);
  for (const f of failed) console.warn(`  ${f}`);
}

const collisions = Array.from(targetCounts.entries()).filter(([, n]) => n > 1);
if (collisions.length > 0) {
  console.error(`\n[rename-mp3s] Collisions — multiple source files map to the same target:`);
  for (const [target] of collisions) {
    const sources = files.filter(
      (f) => `${(f.match(/^(\d+)/) ?? [, ""])[1].padStart(3, "0")}.mp3` === target,
    );
    console.error(`  ${target}  ←  ${sources.join(", ")}`);
  }
  console.error("\nResolve by deleting duplicates from mp3-source/, then re-run.");
  process.exit(1);
}

const existing = new Set(files);
const overwrites = plan.filter((p) => existing.has(p.to));
if (overwrites.length > 0) {
  console.error(`\n[rename-mp3s] Rename would overwrite existing files:`);
  for (const p of overwrites) console.error(`  ${p.from}  →  ${p.to} (exists)`);
  process.exit(1);
}

if (plan.length === 0) {
  console.log(
    `[rename-mp3s] Nothing to rename — ${skipped.length} file(s) already in correct format.`,
  );
  process.exit(0);
}

console.log(`\n[rename-mp3s] Will rename ${plan.length} file(s):`);
for (const { from, to } of plan) console.log(`  ${from}  →  ${to}`);
if (skipped.length > 0) {
  console.log(`\n${skipped.length} already-correct file(s) will be left alone.`);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("\nProceed? [y/N] ", (answer) => {
  rl.close();
  if (answer.trim().toLowerCase() !== "y") {
    console.log("Aborted.");
    process.exit(0);
  }
  for (const { from, to } of plan) {
    fs.renameSync(path.join(sourceDir, from), path.join(sourceDir, to));
  }
  console.log(`[rename-mp3s] Renamed ${plan.length} file(s).`);
});
