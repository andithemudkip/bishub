#!/usr/bin/env node
/**
 * Phase 2 of the hymn migration: build assets/hymnals/*.json for all nine
 * shipped books from the extracted MyBible data, and write a review report.
 *
 * Three modes, because the source data differs sharply by language:
 *
 *   merge  — imnuri-crestine. We already ship these 920 hymns with correct
 *            line breaks and better typography; MyBible has better content
 *            coverage. Transplant their wording onto our line structure and
 *            report every adopted word. Structural conflicts keep OUR version
 *            and are listed for a human to settle.
 *   native — sda-hymnal / nuevo-himnario / hymnes-et-louanges. Real "\n" in
 *            the source; straight conversion.
 *   reflow — the five small Romanian books. Flattened prose with no ground
 *            truth, so line breaks are recovered heuristically and the
 *            doubtful ones are flagged.
 *
 * Usage: node scripts/build-hymnals.js [--write] [--source <dir>]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalize,
  reflowOntoLines,
  splitIntoLines,
  isSuspect,
  toBlocksAndSequence,
  partition,
  wordKey,
} from "./lib/hymn-merge.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "assets", "hymnals");
const reportPath = path.join(repoRoot, "docs", "hymn-merge-report.md");

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const sourceFlag = args.indexOf("--source");
const sourceDir =
  sourceFlag !== -1
    ? args[sourceFlag + 1]
    : path.join(process.env.HOME, "Downloads", "mybible", "hymns", "json");

const BOOKS = [
  { slug: "imnuri-crestine", file: "08_imnuri-crestine.json", lang: "ro", mode: "merge" },
  { slug: "imnuri-amicus", file: "09_imnuri-amicus.json", lang: "ro", mode: "reflow" },
  { slug: "imnuri-companioni", file: "10_imnuri-companioni.json", lang: "ro", mode: "reflow" },
  { slug: "imnuri-exploratori", file: "11_imnuri-exploratori.json", lang: "ro", mode: "reflow" },
  { slug: "imnuri-licurici", file: "12_imnuri-licurici.json", lang: "ro", mode: "reflow" },
  { slug: "imnuri-tineret", file: "13_imnuri-tineret.json", lang: "ro", mode: "reflow" },
  { slug: "sda-hymnal", file: "01_sda-hymnal.json", lang: "en", mode: "native" },
  { slug: "nuevo-himnario-adventista", file: "03_nuevo-himnario-adventista.json", lang: "es", mode: "native" },
  { slug: "hymnes-et-louanges", file: "04_hymnes-et-louanges.json", lang: "fr", mode: "native" },
];

const readJSON = (file) => JSON.parse(fs.readFileSync(file, "utf-8"));

/**
 * Hand-authored corrections, keyed by hymn number, in
 * assets/hymnals/overrides/{slug}.json. The hymnals are generated, so anything
 * edited straight into the output is lost on the next run — corrections live
 * here instead and are re-applied on top of every build.
 *
 * Each entry may set `title`, `blocks` and/or `sequence`, plus a `reason`
 * recording why the generated version was wrong. Everything else is inherited.
 */
function loadOverrides(slug) {
  const file = path.join(outputDir, "overrides", `${slug}.json`);
  if (!fs.existsSync(file)) return new Map();
  return new Map(Object.entries(readJSON(file)));
}

function applyOverrides(hymns, overrides) {
  const applied = [];
  const unmatched = new Set(overrides.keys());
  const out = hymns.map((hymn) => {
    const override = overrides.get(hymn.number);
    if (!override) return hymn;
    unmatched.delete(hymn.number);
    applied.push({ number: hymn.number, reason: override.reason ?? "" });
    const { reason: _reason, ...fields } = override;
    return { ...hymn, ...fields };
  });
  return { hymns: out, applied, unmatched: [...unmatched] };
}
// Titles are kept verbatim apart from canonicalisation. Trimming trailing "!"
// or "." to reconcile the two sides looked tidy but mutated our own titles and
// ate a character per run from ones legitimately ending in "..".
const cleanTitle = (title, romanian) => canonicalize(title, { romanian });

// --- mode: native / reflow (books we don't already ship) ---

function buildFromSource(songs, { lang, mode }) {
  const romanian = lang === "ro";
  const notes = [];
  const hymns = songs.map((song) => {
    const suspects = [];
    const { blocks, sequence } = toBlocksAndSequence(song.stanzas, (raw) => {
      const text = canonicalize(raw, { romanian });
      if (!text) return "";
      if (mode === "native") return text;
      const lines = splitIntoLines(text);
      if (isSuspect(lines)) suspects.push(lines);
      return lines.join("\n");
    });
    if (suspects.length) {
      notes.push({ number: song.number, title: song.title, suspects });
    }
    return {
      number: song.number,
      title: cleanTitle(song.title, romanian),
      blocks,
      sequence,
      ...extras(song, romanian),
    };
  });
  return { hymns, notes };
}

function extras(song, romanian) {
  const out = {};
  for (const field of ["author", "composer", "copyright"]) {
    const value = song[field] && canonicalize(String(song[field]), { romanian });
    if (value) out[field] = value;
  }
  return out;
}

// --- mode: merge (imnuri-crestine) ---

function mergeCrestine(ours, songs) {
  const theirs = new Map(songs.map((song) => [song.number, song]));
  const adoptions = [];
  const conflicts = [];

  const hymns = ours.map((hymn) => {
    const song = theirs.get(hymn.number);
    // Our text is already canonical apart from the cedilla → comma-below fix.
    const base = {
      ...hymn,
      title: cleanTitle(hymn.title, true),
      blocks: hymn.blocks.map((block) => ({
        ...block,
        text: canonicalize(block.text, { romanian: true }),
      })),
    };
    if (!song) return base;

    const ourParts = partition(base);
    const theirVerses = song.stanzas.filter((s) => !s.is_chorus);
    const theirChorus = song.stanzas.find((s) => s.is_chorus) ?? null;

    if (
      ourParts.verses.length !== theirVerses.length ||
      Boolean(ourParts.chorus) !== Boolean(theirChorus)
    ) {
      conflicts.push({
        number: hymn.number,
        title: base.title,
        reason: "stanza structure differs",
        ours: `${ourParts.verses.length} verses${ourParts.chorus ? " + chorus" : ""}`,
        theirs: `${theirVerses.length} verses${theirChorus ? " + chorus" : ""}`,
        ourTitle: base.title,
        theirTitle: cleanTitle(song.title, true),
      });
      return base;
    }

    // Pair each of our blocks with its counterpart and reflow.
    const pairing = new Map();
    let verseCursor = 0;
    for (const block of base.blocks) {
      const counterpart =
        block.kind === "chorus" ? theirChorus : theirVerses[verseCursor++];
      if (counterpart) pairing.set(block, counterpart);
    }

    const changes = [];
    let failed = false;
    const blocks = base.blocks.map((block) => {
      const counterpart = pairing.get(block);
      if (!counterpart) return block;
      const theirText = canonicalize(counterpart.text, { romanian: true });
      const result = reflowOntoLines(block.text, theirText);
      if (!result) {
        failed = true;
        return block;
      }
      if (result.text !== block.text) {
        changes.push({
          before: block.text,
          after: result.text,
          adopted: result.adopted,
          dropped: result.dropped,
        });
      }
      return { ...block, text: result.text };
    });

    if (failed) {
      conflicts.push({
        number: hymn.number,
        title: base.title,
        reason: "word alignment failed",
        ours: `${ourParts.verses.length} verses`,
        theirs: `${theirVerses.length} verses`,
        ourTitle: base.title,
        theirTitle: cleanTitle(song.title, true),
      });
      return base;
    }

    const merged = { ...base, blocks, ...extras(song, true) };
    if (changes.length) {
      adoptions.push({ number: hymn.number, title: base.title, changes });
    }
    return merged;
  });

  return { hymns, adoptions, conflicts };
}

// --- run ---

// Re-apply overrides to the already-generated hymnals without touching the
// MyBible source. Overrides replace whole fields, so this is idempotent — and
// it keeps override work unblocked when the source tree isn't reachable.
if (args.includes("--apply-overrides-only")) {
  let touched = 0;
  for (const book of BOOKS) {
    const file = path.join(outputDir, `${book.slug}.json`);
    if (!fs.existsSync(file)) continue;
    const overrides = loadOverrides(book.slug);
    if (overrides.size === 0) continue;
    const result = applyOverrides(readJSON(file), overrides);
    if (result.unmatched.length) {
      console.error(
        `  ! ${book.slug}: override for unknown hymn ${result.unmatched.join(", ")}`
      );
    }
    fs.writeFileSync(file, JSON.stringify(result.hymns, null, 2) + "\n");
    touched += result.applied.length;
    console.log(`  ${book.slug.padEnd(28)} ${result.applied.length} overrides applied`);
  }
  console.log(`\n  ${touched} overrides re-applied (report not regenerated)\n`);
  process.exit(0);
}

if (!fs.existsSync(sourceDir)) {
  console.error(`[build-hymnals] MyBible source not found: ${sourceDir}`);
  console.error("  pass --source <dir> to point at the extracted hymns/json folder");
  process.exit(1);
}

const results = [];
let merge = null;

for (const book of BOOKS) {
  const songs = readJSON(path.join(sourceDir, book.file));
  let built;
  if (book.mode === "merge") {
    const ours = readJSON(path.join(outputDir, `${book.slug}.json`));
    merge = mergeCrestine(ours, songs);
    built = { hymns: merge.hymns, notes: [] };
  } else {
    built = buildFromSource(songs, book);
  }

  const overrides = loadOverrides(book.slug);
  const result = applyOverrides(built.hymns, overrides);
  if (result.unmatched.length) {
    console.error(
      `  ! ${book.slug}: override for unknown hymn ${result.unmatched.join(", ")}`
    );
  }
  // Conflicts and heuristic warnings settled by hand stop being open questions.
  const resolved = new Set(result.applied.map((entry) => entry.number));
  if (book.mode === "merge") {
    merge.conflicts = merge.conflicts.filter((c) => !resolved.has(c.number));
    merge.resolved = result.applied;
  }
  built.notes = built.notes.filter((note) => !resolved.has(note.number));
  results.push({ book, hymns: result.hymns, notes: built.notes, overrides: result.applied });
}

// Word-level changes actually adopted from MyBible, for the report.
const adoptedWords = new Set();
for (const entry of merge.adoptions) {
  for (const change of entry.changes) {
    for (const word of change.adopted) adoptedWords.add(word);
  }
}

console.log("");
for (const { book, hymns, notes, overrides } of results) {
  const blocks = hymns.reduce((n, h) => n + h.blocks.length, 0);
  const flag =
    book.mode === "reflow" ? ` | ${notes.length} flagged for review` : "";
  const fixed = overrides.length ? ` | ${overrides.length} overrides` : "";
  console.log(
    `  ${book.slug.padEnd(28)} ${String(hymns.length).padStart(4)} hymns  ` +
      `${String(blocks).padStart(5)} blocks  [${book.mode}]${flag}${fixed}`
  );
}
const total = results.reduce((n, r) => n + r.hymns.length, 0);
console.log(`\n  total: ${total} hymns across ${results.length} books`);
console.log(
  `  imnuri-crestine: ${merge.adoptions.length} hymns took wording from MyBible, ` +
    `${merge.conflicts.length} conflicts kept OURS\n`
);

if (!WRITE) {
  console.log("  dry run — pass --write to emit files and the report\n");
  process.exit(0);
}

fs.mkdirSync(outputDir, { recursive: true });
for (const { book, hymns } of results) {
  fs.writeFileSync(
    path.join(outputDir, `${book.slug}.json`),
    JSON.stringify(hymns, null, 2) + "\n"
  );
}

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, buildReport(results, merge));
console.log(`  wrote ${results.length} hymnals + ${path.relative(repoRoot, reportPath)}\n`);

// --- report ---

function fence(text) {
  return "```\n" + text + "\n```";
}

function buildReport(results, merge) {
  const lines = [];
  lines.push("# Hymnal merge report", "");
  lines.push(
    "Generated by `scripts/build-hymnals.js`. Everything here is a *proposal* —",
    "review before shipping. Regenerate with `node scripts/build-hymnals.js --write`.",
    ""
  );

  lines.push("## Books", "");
  lines.push("| book | lang | hymns | blocks | mode | hand-fixed | still needs review |");
  lines.push("|---|---|---:|---:|---|---:|---:|");
  for (const { book, hymns, notes, overrides } of results) {
    const blocks = hymns.reduce((n, h) => n + h.blocks.length, 0);
    const review =
      book.mode === "merge"
        ? `${merge.conflicts.length} conflicts`
        : book.mode === "reflow"
          ? `${notes.length} stanzas`
          : "—";
    lines.push(
      `| \`${book.slug}\` | ${book.lang} | ${hymns.length} | ${blocks} | ${book.mode} | ${overrides.length} | ${review} |`
    );
  }
  lines.push("");

  const allOverrides = results.flatMap(({ book, overrides }) =>
    overrides.map((entry) => ({ ...entry, slug: book.slug }))
  );
  if (allOverrides.length) {
    lines.push("## Hand-authored overrides applied", "");
    lines.push(
      "From `assets/hymnals/overrides/{slug}.json`, re-applied on every build.",
      ""
    );
    lines.push("| book | # | reason |");
    lines.push("|---|---|---|");
    for (const entry of allOverrides) {
      lines.push(`| \`${entry.slug}\` | ${entry.number} | ${entry.reason} |`);
    }
    lines.push("");
  }

  lines.push("## Corpus-wide change: Romanian diacritics", "");
  lines.push(
    "All Romanian text is normalised from the legacy cedilla forms `ş/ţ` (U+015F/U+0163,",
    "historically Turkish letters) to the correct comma-below `ș/ț` (U+0219/U+021B).",
    "Both decompose into the U+0300–U+036F range, so `removeDiacritics()` treats them",
    "identically and search behaviour is unchanged. The shipped font stack",
    "(`system-ui`/`-apple-system`/`Segoe UI`/`Roboto`) renders comma-below correctly.",
    ""
  );

  lines.push("## imnuri-crestine — conflicts (kept OURS, need a decision)", "");
  lines.push(
    `${merge.conflicts.length} hymns where our version and MyBible's disagree structurally,`,
    "or where word alignment couldn't be trusted. **Our text was kept in every case.**",
    ""
  );
  lines.push("| # | our title | their title | ours | theirs | reason |");
  lines.push("|---|---|---|---|---|---|");
  for (const c of merge.conflicts) {
    lines.push(
      `| ${c.number} | ${c.ourTitle} | ${c.theirTitle} | ${c.ours} | ${c.theirs} | ${c.reason} |`
    );
  }
  lines.push("");

  lines.push("## imnuri-crestine — adopted wording", "");
  lines.push(
    `${merge.adoptions.length} hymns took at least one word from MyBible.`,
    "Matched words keep OUR spelling, casing and typography; only genuinely",
    "different words are adopted. Full before/after per stanza:",
    ""
  );
  for (const entry of merge.adoptions) {
    lines.push(`### ${entry.number}. ${entry.title}`, "");
    for (const change of entry.changes) {
      lines.push("**ours**", fence(change.before), "**merged**", fence(change.after));
      if (change.adopted.length) {
        lines.push(`*adopted from MyBible:* ${change.adopted.map((w) => `\`${w}\``).join(" ")}`);
      }
      if (change.dropped.length) {
        lines.push(`*dropped from ours:* ${change.dropped.map((w) => `\`${w}\``).join(" ")}`);
      }
      lines.push("");
    }
  }

  for (const { book, notes } of results) {
    if (!notes.length) continue;
    lines.push(`## ${book.slug} — heuristic line breaks needing review`, "");
    lines.push(
      `${notes.length} stanzas produced suspicious line breaks (a line over 10 words,`,
      "or no break found at all). These books have no line breaks upstream and no",
      "ground truth, so every break here is inferred.",
      ""
    );
    for (const note of notes) {
      lines.push(`### ${note.number}. ${note.title}`, "");
      for (const suspect of note.suspects) lines.push(fence(suspect.join("\n")), "");
    }
  }

  return lines.join("\n") + "\n";
}
