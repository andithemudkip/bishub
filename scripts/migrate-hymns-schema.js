#!/usr/bin/env node
/**
 * Phase 1 of the hymn migration: convert assets/hymns.json from the
 * `verses[] + chorus + chorusFirst` shape to the sequence-based
 * `blocks[] + sequence[]` shape, written to assets/hymnals/imnuri-crestine.json.
 *
 * This is a PURE STRUCTURAL conversion — no text is changed. The script proves
 * that by replaying both the old and new display-formatting logic over all 920
 * hymns and asserting the resulting slides are byte-identical. Content merging
 * with the MyBible data happens in phase 2.
 *
 * One-shot: its output is committed and the old assets/hymns.json is removed.
 * To re-run, restore the input with:
 *   git show a308ed1:assets/hymns.json > assets/hymns.json
 *
 * Usage: node scripts/migrate-hymns-schema.js [--write]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(repoRoot, "assets", "hymns.json");
const outputDir = path.join(repoRoot, "assets", "hymnals");
const outputPath = path.join(outputDir, "imnuri-crestine.json");

const WRITE = process.argv.includes("--write");

// Chorus prefixes from src/shared/i18n.ts — slides are language-dependent, so
// the equivalence check runs against every language we ship.
const CHORUS_PREFIXES = { ro: "R", en: "Ch" };

// --- slide building (mirrors electron/dataLoader.ts) ---

function pushSlides(slides, text) {
  const lines = text.split(/\r?\n/);
  if (lines.length >= 8) {
    const mid = Math.ceil(lines.length / 2);
    slides.push(lines.slice(0, mid).join("\n"));
    slides.push(lines.slice(mid).join("\n"));
  } else {
    slides.push(text);
  }
}

/** The CURRENT formatHymnForDisplay, verbatim. */
function formatOld(hymn, chorusPrefix) {
  const slides = [];
  const chorus =
    hymn.chorus && hymn.chorus.trim()
      ? `${chorusPrefix}: ${hymn.chorus.trim()}`
      : null;

  if (chorus && hymn.chorusFirst) pushSlides(slides, chorus);

  hymn.verses.forEach((verse, index) => {
    pushSlides(slides, `${index + 1}. ${verse}`);
    if (chorus) pushSlides(slides, chorus);
  });

  return { title: `${hymn.number}. ${hymn.title}`, slides };
}

/** The NEW sequence-driven formatter. */
function formatNew(hymn, chorusPrefix) {
  const slides = [];

  // Verses are numbered by their position among verse blocks, not by their
  // position in the sequence — so a repeated verse keeps its original number.
  const verseNumbers = new Map();
  let n = 0;
  hymn.blocks.forEach((block, i) => {
    if (block.kind === "verse") verseNumbers.set(i, ++n);
  });

  for (const index of hymn.sequence) {
    const block = hymn.blocks[index];
    if (block.kind === "chorus") {
      pushSlides(slides, `${chorusPrefix}: ${block.text}`);
    } else if (block.kind === "verse") {
      pushSlides(slides, `${verseNumbers.get(index)}. ${block.text}`);
    } else {
      pushSlides(slides, block.text);
    }
  }

  return { title: `${hymn.number}. ${hymn.title}`, slides };
}

// --- conversion ---

function convert(hymn) {
  const blocks = [];
  const sequence = [];

  // Whitespace-only choruses were treated as absent by the old formatter.
  const chorusText = hymn.chorus && hymn.chorus.trim() ? hymn.chorus.trim() : null;

  // Blocks are emitted in first-appearance order, so a chorus-first hymn puts
  // its chorus at index 0 — matching how MyBible represents the same thing.
  let chorusIndex = -1;
  if (chorusText !== null && hymn.chorusFirst) {
    chorusIndex = blocks.push({ kind: "chorus", text: chorusText }) - 1;
    sequence.push(chorusIndex);
  }

  for (const verse of hymn.verses) {
    sequence.push(blocks.push({ kind: "verse", text: verse }) - 1);
    if (chorusText !== null) {
      if (chorusIndex === -1) {
        chorusIndex = blocks.push({ kind: "chorus", text: chorusText }) - 1;
      }
      sequence.push(chorusIndex);
    }
  }

  return { number: hymn.number, title: hymn.title, blocks, sequence };
}

// --- run ---

const source = JSON.parse(fs.readFileSync(sourcePath, "utf-8"));
const converted = source.map(convert);

let mismatches = 0;
for (const [lang, prefix] of Object.entries(CHORUS_PREFIXES)) {
  for (let i = 0; i < source.length; i++) {
    const before = formatOld(source[i], prefix);
    const after = formatNew(converted[i], prefix);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      mismatches++;
      if (mismatches <= 5) {
        console.error(`MISMATCH [${lang}] hymn ${source[i].number}`);
        console.error("  old:", JSON.stringify(before).slice(0, 300));
        console.error("  new:", JSON.stringify(after).slice(0, 300));
      }
    }
  }
}

const stats = {
  hymns: converted.length,
  withChorus: converted.filter((h) => h.blocks.some((b) => b.kind === "chorus")).length,
  chorusFirst: source.filter((h) => h.chorusFirst).length,
  blocks: converted.reduce((n, h) => n + h.blocks.length, 0),
};

console.log(
  `[migrate-hymns] ${stats.hymns} hymns | ${stats.withChorus} with chorus ` +
    `(${stats.chorusFirst} chorus-first) | ${stats.blocks} blocks`
);
console.log(
  `[migrate-hymns] slide equivalence across ${Object.keys(CHORUS_PREFIXES).length} languages: ` +
    (mismatches === 0 ? "IDENTICAL ✓" : `${mismatches} MISMATCHES ✗`)
);

if (mismatches > 0) process.exit(1);

if (!WRITE) {
  console.log("[migrate-hymns] dry run — pass --write to emit the file");
  process.exit(0);
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(converted, null, 2) + "\n");
console.log(
  `[migrate-hymns] wrote ${path.relative(repoRoot, outputPath)} ` +
    `(${(fs.statSync(outputPath).size / 1024).toFixed(0)} KB)`
);
