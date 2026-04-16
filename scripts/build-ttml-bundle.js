#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const sourceDir = path.join(repoRoot, "assets", "hymns");
const outputPath = path.join(repoRoot, "assets", "hymns-ttml.json");

if (!fs.existsSync(sourceDir)) {
  console.error(`[build-ttml] Source dir not found: ${sourceDir}`);
  process.exit(1);
}

const bundle = {};
const files = fs
  .readdirSync(sourceDir)
  .filter((f) => f.toLowerCase().endsWith(".ttml"))
  .sort();

for (const file of files) {
  const number = path.basename(file, path.extname(file));
  const content = fs.readFileSync(path.join(sourceDir, file), "utf-8");
  bundle[number] = content;
}

fs.writeFileSync(outputPath, JSON.stringify(bundle));
const sizeKB = (fs.statSync(outputPath).size / 1024).toFixed(1);
console.log(
  `[build-ttml] Wrote ${files.length} hymn(s) to ${path.relative(repoRoot, outputPath)} (${sizeKB} KB)`,
);
