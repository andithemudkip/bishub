#!/usr/bin/env node
/**
 * Data invariants for assets/hymnals/*.json. Run after any change to the
 * hymnal build or to the hand-authored overrides.
 *
 *   node scripts/verify-hymnals.js [--baseline <dir>]
 *
 * With --baseline, additionally enforces the rule that line-break fixes in the
 * five heuristically-split Romanian books may only move "\n" around: the word
 * stream of every stanza must be byte-identical to the baseline. Content fixes
 * to imnuri-crestine are exempt, since changing wording is their whole point.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const hymnalDir = path.join(repoRoot, "assets", "hymnals");

const args = process.argv.slice(2);
const baselineFlag = args.indexOf("--baseline");
const baselineDir = baselineFlag !== -1 ? args[baselineFlag + 1] : null;

const ROMANIAN = new Set([
  "imnuri-crestine",
  "imnuri-amicus",
  "imnuri-companioni",
  "imnuri-exploratori",
  "imnuri-licurici",
  "imnuri-tineret",
]);
// Books whose line breaks were inferred, and where fixes must preserve wording.
const WORDS_FROZEN = new Set([
  "imnuri-amicus",
  "imnuri-companioni",
  "imnuri-exploratori",
  "imnuri-licurici",
  "imnuri-tineret",
]);

const CEDILLA = /[şţŞŢ]/;
const KINDS = new Set(["verse", "chorus", "bridge"]);

const words = (text) => text.split(/\s+/).filter(Boolean).join(" ");
const readJSON = (file) => JSON.parse(fs.readFileSync(file, "utf-8"));

const failures = [];
const warnings = [];
const fail = (slug, number, message) =>
  failures.push(`${slug} #${number}: ${message}`);

// The registry in src/shared/hymnals.ts drives the UI, so a book present on
// disk but missing from it (or a stale songCount) silently ships wrong.
const registrySource = fs.readFileSync(
  path.join(repoRoot, "src", "shared", "hymnals.ts"),
  "utf-8"
);
const registry = new Map(
  [...registrySource.matchAll(/slug: "([^"]+)"[\s\S]*?songCount: (\d+)/g)].map(
    (m) => [m[1], Number(m[2])]
  )
);

const files = fs
  .readdirSync(hymnalDir)
  .filter((f) => f.endsWith(".json"))
  .sort();

let totalHymns = 0;
const rows = [];

for (const file of files) {
  const slug = path.basename(file, ".json");
  const hymns = readJSON(path.join(hymnalDir, file));
  const baseline = baselineDir
    ? new Map(
        readJSON(path.join(baselineDir, file)).map((h) => [h.number, h])
      )
    : null;

  const seenNumbers = new Set();
  let longLines = 0;
  let changedWordStream = 0;

  for (const hymn of hymns) {
    const { number, title, blocks, sequence } = hymn;
    if (!number) fail(slug, "?", "missing number");
    if (seenNumbers.has(number)) fail(slug, number, "duplicate number");
    seenNumbers.add(number);
    if (!title?.trim()) fail(slug, number, "missing title");
    if (!Array.isArray(blocks) || blocks.length === 0)
      fail(slug, number, "no blocks");
    if (!Array.isArray(sequence) || sequence.length === 0)
      fail(slug, number, "empty sequence");

    for (const index of sequence ?? []) {
      if (!Number.isInteger(index) || !blocks?.[index])
        fail(slug, number, `sequence references missing block ${index}`);
    }
    // A block nothing points at is dead weight and usually a hand-edit slip.
    for (let i = 0; i < (blocks?.length ?? 0); i++) {
      if (!sequence?.includes(i))
        fail(slug, number, `block ${i} is unreachable from sequence`);
    }

    for (const block of blocks ?? []) {
      if (!KINDS.has(block.kind))
        fail(slug, number, `bad block kind "${block.kind}"`);
      if (!block.text?.trim()) fail(slug, number, "empty block text");
      if (/\r/.test(block.text ?? "")) fail(slug, number, "carriage return");
      if (ROMANIAN.has(slug) && CEDILLA.test(block.text ?? ""))
        fail(slug, number, "cedilla diacritic (use ș/ț, not ş/ţ)");
      for (const line of (block.text ?? "").split("\n")) {
        if (line.split(/\s+/).filter(Boolean).length > 10) longLines++;
      }
    }

    if (baseline?.has(number) && WORDS_FROZEN.has(slug)) {
      const before = baseline.get(number);
      const a = (before.blocks ?? []).map((b) => words(b.text)).join(" | ");
      const b = (blocks ?? []).map((x) => words(x.text)).join(" | ");
      if (a !== b) {
        changedWordStream++;
        fail(
          slug,
          number,
          "word stream changed — line-break fixes may only move newlines"
        );
      }
    }
  }

  if (!registry.has(slug)) {
    failures.push(`${slug}: on disk but missing from the hymnal registry`);
  } else if (registry.get(slug) !== hymns.length) {
    failures.push(
      `${slug}: registry songCount ${registry.get(slug)} != ${hymns.length} on disk`
    );
  }

  totalHymns += hymns.length;
  rows.push({ slug, count: hymns.length, longLines, changedWordStream });
  if (longLines > 0 && WORDS_FROZEN.has(slug)) {
    warnings.push(`${slug}: ${longLines} lines still over 10 words`);
  }
}

for (const row of rows) {
  console.log(
    `  ${row.slug.padEnd(28)} ${String(row.count).padStart(4)} hymns  ` +
      `${String(row.longLines).padStart(4)} long lines`
  );
}
console.log(`\n  ${totalHymns} hymns across ${rows.length} books`);

for (const slug of registry.keys()) {
  if (!files.includes(`${slug}.json`)) {
    failures.push(`${slug}: in the registry but no assets/hymnals/${slug}.json`);
  }
}

if (warnings.length) {
  console.log("\n  warnings:");
  for (const warning of warnings) console.log(`    - ${warning}`);
}

if (failures.length) {
  console.log(`\n  FAILURES (${failures.length}):`);
  for (const failure of failures.slice(0, 40)) console.log(`    ✗ ${failure}`);
  if (failures.length > 40) console.log(`    … ${failures.length - 40} more`);
  process.exit(1);
}
console.log("\n  all invariants hold ✓\n");
