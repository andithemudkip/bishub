#!/usr/bin/env node
/**
 * Build the bundled "Alte Imnuri" book from PowerPoint decks.
 *
 * These are hymns we ship that are in no official hymnal, held as .pptx. The
 * decks live outside the repo; only the generated JSON, the number manifest and
 * the review report are committed.
 *
 *   node scripts/build-pptx-hymnal.js \
 *     --source ~/Downloads/cantari-bis \
 *     --source ~/Downloads/cantari-bis-converted --write
 *
 * BOTH sources are required: roughly half the hymns come from decks that were
 * legacy .ppt and live in the converted folder. Running with one source refuses
 * to write, because duplicate resolution changes when a competing transcription
 * is missing.
 *
 * Legacy .ppt is NOT read — the app accepts .pptx only, by design. Convert first:
 *
 *   brew install --cask libreoffice     # local dev only, never a runtime dep
 *   soffice --headless --norestore --convert-to pptx --outdir <out> <dir>/*.ppt
 *
 * Convert per bundle: filenames collide across them.
 *
 * The parser and mapping are the app's own (electron/pptxParser.ts and
 * src/shared/hymnImport.ts), bundled here with esbuild rather than
 * reimplemented. A second copy of the heuristics would drift within a release,
 * and then a user's import and our bundled book would disagree about the same
 * deck.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import esbuild from "esbuild";
import { loadOverrides, applyOverrides } from "./lib/overrides.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "assets", "hymnals");

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const flagValue = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : fallback;
};
const flagValues = (name) =>
  args.flatMap((arg, i) => (arg === name ? [args[i + 1]] : []));

const SLUG = flagValue("--slug", "alte-imnuri");
const LANGUAGE = flagValue("--language", "ro");
const sources = flagValues("--source");
const manifestPath = path.join(repoRoot, "scripts", "data", `${SLUG}.json`);
const hymnalPath = path.join(outputDir, `${SLUG}.json`);
const reportPath = path.join(repoRoot, "docs", `${SLUG}-report.md`);

if (sources.length === 0) {
  console.error(
    "\n  --source <dir> is required (repeatable).\n" +
      "  Pass the deck folder, plus the folder of .ppt files converted to .pptx.\n"
  );
  process.exit(1);
}

// ── the app's own parser + mapping, bundled on the fly ───────────────────────

async function loadAppModules() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bishub-pptx-"));
  const entry = path.join(dir, "entry.ts");
  const out = path.join(dir, "bundle.mjs");
  fs.writeFileSync(
    entry,
    `export { parsePptx, PptxParseError } from ${JSON.stringify(path.join(repoRoot, "electron/pptxParser.ts"))};\n` +
      `export { buildDraft, draftToHymn, canonicalizeHymnText } from ${JSON.stringify(path.join(repoRoot, "src/shared/hymnImport.ts"))};\n`
  );
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: out,
    logLevel: "error",
  });
  const mod = await import(pathToFileURL(out).href);
  return { mod, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

// ── discovery ────────────────────────────────────────────────────────────────

function walk(dir, base = dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, found);
    else found.push({ full, rel: path.relative(base, full) });
  }
  return found;
}

function discover() {
  const decks = new Map();
  const legacy = [];
  const other = [];
  const collisions = [];

  for (const source of sources) {
    const root = path.resolve(source.replace(/^~/, os.homedir()));
    if (!fs.existsSync(root)) {
      console.error(`  source not found: ${root}`);
      process.exit(1);
    }
    for (const { full, rel } of walk(root)) {
      const ext = path.extname(rel).toLowerCase();
      if (ext === ".pptx") {
        // The manifest keys on this, so it must be stable across runs.
        if (decks.has(rel)) collisions.push(rel);
        else decks.set(rel, full);
      } else if (ext === ".ppt") legacy.push(rel);
      else other.push(rel);
    }
  }

  if (collisions.length > 0) {
    console.error(
      `\n  Two sources contain the same relative path, so the manifest key would be\n` +
        `  ambiguous. Rename one, or pass narrower --source dirs:\n` +
        collisions.map((c) => `    ${c}`).join("\n") +
        "\n"
    );
    process.exit(1);
  }
  return { decks, legacy, other };
}

// ── duplicate detection ──────────────────────────────────────────────────────
//
// Competing transcriptions of the same hymn, which filenames do not catch
// (`Judecata cea din ceruri` ≡ `Judecata cea eterna`). Containment rather than
// Jaccard: a version with extra verses must not score as less similar.

const fold = (text) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’′´'`]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const shingles = (text, size = 4) => {
  const words = fold(text).split(" ").filter(Boolean);
  const out = new Set();
  for (let i = 0; i + size <= words.length; i++)
    out.add(words.slice(i, i + size).join(" "));
  return out;
};

const intersect = (a, b) => {
  let n = 0;
  for (const value of a) if (b.has(value)) n++;
  return n;
};
const containment = (a, b) =>
  a.size && b.size ? intersect(a, b) / Math.min(a.size, b.size) : 0;

function bestStanza(a, b) {
  let best = 0;
  for (const x of a.stanzas)
    for (const y of b.stanzas) {
      if (x.size < 3 || y.size < 3) continue;
      const score = intersect(x, y) / Math.min(x.size, y.size);
      if (score > best) best = score;
    }
  return best;
}

function clusterDuplicates(entries) {
  const parent = new Map(entries.map((e) => [e.key, e.key]));
  const find = (key) => {
    while (parent.get(key) !== key) {
      parent.set(key, parent.get(parent.get(key)));
      key = parent.get(key);
    }
    return key;
  };
  const scores = new Map();
  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      const c = containment(a.shingles, b.shingles);
      const s = bestStanza(a, b);
      if (c >= 0.35 || s >= 0.55) {
        scores.set(`${a.key}|${b.key}`, { containment: c, stanza: s });
        const ra = find(a.key);
        const rb = find(b.key);
        if (ra !== rb) parent.set(ra, rb);
      }
    }
  const groups = new Map();
  for (const entry of entries) {
    const root = find(entry.key);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(entry);
  }
  return { clusters: [...groups.values()], scores };
}

/**
 * Pick which transcription ships.
 *
 * Line breaks are load-bearing (pushSlides() counts lines; buildScreenGroups()
 * maps them to TTML indices), so words-per-line decides — but only between
 * versions that are actually complete. Without the fragment guard the rule picks
 * a 2-slide, 47-word partial deck of `Mi-e dor de vesnicie` over the full
 * 8-slide, 205-word one, purely because its lines are narrower.
 *
 * Cedillas are deliberately ignored: canonicalizeHymnText() fixes them, so they
 * must not influence which version is kept.
 */
const FRAGMENT_RATIO = 0.7;

function chooseWinner(cluster) {
  const maxWords = Math.max(...cluster.map((e) => e.words));
  const complete = cluster.filter((e) => e.words >= maxWords * FRAGMENT_RATIO);
  const pool = complete.length > 0 ? complete : cluster;
  const winner = [...pool].sort(
    (a, b) => a.wordsPerLine - b.wordsPerLine || b.words - a.words
  )[0];
  return {
    winner,
    losers: cluster.filter((e) => e !== winner),
    fragments: cluster.filter((e) => !complete.includes(e)),
  };
}

// ── diacritic restoration ────────────────────────────────────────────────────
//
// The decks were typed on keyboards without Romanian diacritics, unevenly: the
// same word appears as `veșnicii` on one slide and `vesnicii` on the next. We
// ship this book, so it should not carry that.
//
// The dictionary is our own hand-corrected corpus — the six Romanian hymnals,
// 1300+ hymns of reviewed text. A plain word is only corrected when that corpus
// *never* spells it plain, which is what separates `si`→`și` (0 plain uses in
// the corpus) from `sa`→`să` (328 plain uses: `sa` is a real word, the
// possessive). Everything rejected is left exactly as written.

const CORPUS_BOOKS = [
  "imnuri-crestine",
  "imnuri-amicus",
  "imnuri-companioni",
  "imnuri-exploratori",
  "imnuri-licurici",
  "imnuri-tineret",
];
const foldWord = (word) =>
  word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Diacritics for hyphenated compounds, corrected as whole units.
 *
 * Word-by-word correction splits `bucurati-va` into `bucurati` and `va`, fixes
 * the first and rejects the second (`va` is a real word), leaving the visibly
 * half-repaired `Bucurați-va`. As one token `bucurați-vă` is unambiguous, so
 * compounds get first refusal. The rejections still matter: `de-al` must not
 * become `de-ăl`.
 */
function buildCompoundMap() {
  const freq = new Map();
  for (const slug of CORPUS_BOOKS) {
    const file = path.join(outputDir, `${slug}.json`);
    if (!fs.existsSync(file)) continue;
    for (const hymn of JSON.parse(fs.readFileSync(file, "utf-8")))
      for (const block of hymn.blocks)
        for (const match of block.text.matchAll(/\p{L}+(?:-\p{L}+)+/gu)) {
          const key = match[0].toLowerCase();
          freq.set(key, (freq.get(key) ?? 0) + 1);
        }
  }
  return pickUnambiguous(freq, 3);
}

/** fold → the one spelling the corpus uses, when there is only one. */
function pickUnambiguous(freq, minCount) {
  const byFold = new Map();
  for (const [word, count] of freq) {
    const key = foldWord(word);
    if (!byFold.has(key)) byFold.set(key, new Map());
    byFold.get(key).set(word, count);
  }
  const out = new Map();
  for (const [key, forms] of byFold) {
    const plain = forms.get(key) ?? 0;
    const accented = [...forms.entries()]
      .filter(([spelling]) => spelling !== foldWord(spelling))
      .sort((a, b) => b[1] - a[1]);
    if (accented.length === 0) continue;
    const [best, bestCount] = accented[0];
    if (plain > Math.max(2, bestCount * 0.01)) continue;
    if (bestCount < minCount) continue;
    if (accented.length > 1 && bestCount < accented[1][1] * 10) continue;
    out.set(key, best);
  }
  return out;
}

function buildDiacriticMap() {
  const freq = new Map();
  for (const slug of CORPUS_BOOKS) {
    const file = path.join(outputDir, `${slug}.json`);
    if (!fs.existsSync(file)) continue;
    for (const hymn of JSON.parse(fs.readFileSync(file, "utf-8")))
      for (const block of hymn.blocks)
        for (const word of block.text.split(/[^\p{L}]+/u)) {
          if (!word) continue;
          const key = word.toLowerCase();
          freq.set(key, (freq.get(key) ?? 0) + 1);
        }
  }
  // Tolerate a stray plain spelling in the corpus (1% of the accented form),
  // but never adopt a correction for a word the corpus genuinely writes both ways.
  return pickUnambiguous(freq, 3);
}

/**
 * Romanian elision at a word boundary takes a hyphen, not an apostrophe:
 * `l-am`, `m-a`, `se-ngrijește`. The decks type an apostrophe instead.
 *
 * Two things must survive untouched, and the corpus shows both:
 *   - word-initial apostrophe (aphaeresis) — `’nălțimi`, `’ntre` — which is
 *     correct Romanian and appears 129 times in the corpus;
 *   - intra-word syncope — `Soar’le` for `soarele`, `răn’le`, `cel’lalt` — where
 *     the apostrophe marks a dropped vowel *inside* one word, and foreign
 *     contractions (`I’ll`, `l’agneau`) that sit in the corpus too.
 *
 * So a form is only hyphenated when the corpus attests it: either the whole
 * hyphenated word, or its left part as something that takes a hyphen. That
 * converts `l’am` and `vremea’ceea` while leaving `Frum’sețea` alone.
 *
 * Corpus-driven, so it lives here and not in canonicalizeHymnText(): the
 * renderer has no corpus, and a blanket rule there would wreck `I’ll`.
 */
function buildHyphenSets() {
  const whole = new Set();
  const leftPart = new Set();
  for (const slug of CORPUS_BOOKS) {
    const file = path.join(outputDir, `${slug}.json`);
    if (!fs.existsSync(file)) continue;
    for (const hymn of JSON.parse(fs.readFileSync(file, "utf-8")))
      for (const block of hymn.blocks)
        for (const match of block.text.matchAll(/\p{L}+(?:-\p{L}+)+/gu)) {
          whole.add(foldWord(match[0]));
          leftPart.add(foldWord(match[0].split("-")[0]));
        }
  }
  return { whole, leftPart };
}

/**
 * A comma typed where a hyphen or a space belongs.
 *
 * Two different slips, and which one it is depends on what follows: `nu,s` and
 * `ă,ntorc` are elisions that want a hyphen (`nu-s`, `ă-ntorc`), while `l,Tatăl`
 * is simply a missing space. The corpus decides, exactly as it does for
 * apostrophes — and it is unambiguous about `Tu,-n`, having no comma-before-
 * hyphen anywhere in 1300+ reviewed hymns.
 */
function fixCommaTypos(text, sets, tally) {
  // A comma immediately before a hyphen is always redundant.
  const out = text.replace(/([\p{L}])[,;](?=[-–]\p{L})/gu, (whole, before) => {
    tally.set(`${whole}- → ${before}-`, (tally.get(`${whole}- → ${before}-`) ?? 0) + 1);
    return before;
  });

  return out.replace(/(\p{L}+),(\p{L}+)/gu, (whole, left, right) => {
    const hyphenated = `${left}-${right}`;
    const elidedIn = /^n(?![aeiouăâî])/iu.test(right);
    // An elision attaches a lowercase fragment (`nu-s`, `ă-ntorc`). A capitalised
    // word after the comma is a new word, so `Doamne,Tu` wants a space — even
    // though `Doamne` is attested elsewhere as a hyphen prefix.
    const startsWord = right[0] !== right[0].toLocaleLowerCase(LANGUAGE);
    const attested = startsWord
      ? sets.whole.has(foldWord(hyphenated))
      : elidedIn ||
        sets.whole.has(foldWord(hyphenated)) ||
        sets.leftPart.has(foldWord(left));
    const fixed = attested ? hyphenated : `${left}, ${right}`;
    tally.set(`${whole} → ${fixed}`, (tally.get(`${whole} → ${fixed}`) ?? 0) + 1);
    return fixed;
  });
}

function fixElisions(text, sets, tally, skipped) {
  return text.replace(/\p{L}+(?:['\u2019]\p{L}+)+/gu, (word) => {
    const hyphenated = word.replace(/['\u2019]/g, "-");
    // The elided `în` — `Zboare’n` for *Zboare în* — is unmistakable even when
    // neither half is attested, because `n` before a consonant is not a word.
    const elidedIn = /['\u2019]n(?![aeiouăâî])/iu.test(word);
    const attested =
      elidedIn ||
      sets.whole.has(foldWord(hyphenated)) ||
      sets.leftPart.has(foldWord(word.split(/['\u2019]/)[0]));
    if (!attested) {
      skipped.set(word, (skipped.get(word) ?? 0) + 1);
      return word;
    }
    tally.set(`${word} → ${hyphenated}`, (tally.get(`${word} → ${hyphenated}`) ?? 0) + 1);
    return hyphenated;
  });
}

/** Re-apply the source word's capitalisation to the corrected spelling. */
function matchCase(source, target) {
  if (source === source.toUpperCase() && source !== source.toLowerCase())
    return target.toLocaleUpperCase(LANGUAGE);
  if (source[0] === source[0]?.toLocaleUpperCase(LANGUAGE))
    return target[0].toLocaleUpperCase(LANGUAGE) + target.slice(1);
  return target;
}

/**
 * Fix a title's diacritics from the hymn's own lyrics.
 *
 * Titles usually come from the filename, and filenames are typed without
 * diacritics; the slide text usually has them. So `Doamne cata fericire` sits
 * above a first line reading `Doamne câtă fericire,`, and `Tine-mă în mana Ta`
 * above `Tine-mă în mâna Ta`. The hymn is its own best authority here — better
 * than the corpus, which cannot know which of `viață`/`viața` this hymn means.
 *
 * Only ever changes diacritics: a word is replaced solely when the body spells
 * exactly one accented form of it and never the plain one. `Vreau sa mă-ntorc`
 * stays as written, because that body says `sa` ten times.
 */
function titleFromBody(title, blocks, tally) {
  const freq = new Map();
  for (const block of blocks)
    for (const word of block.text.split(/[^\p{L}]+/u)) {
      if (!word) continue;
      const key = word.toLowerCase();
      freq.set(key, (freq.get(key) ?? 0) + 1);
    }
  const byFold = new Map();
  for (const [word, count] of freq) {
    const key = foldWord(word);
    if (!byFold.has(key)) byFold.set(key, new Map());
    byFold.get(key).set(word, count);
  }

  return title.replace(/\p{L}+/gu, (word) => {
    const lower = word.toLowerCase();
    if (lower !== foldWord(lower)) return word;
    const forms = byFold.get(foldWord(lower));
    if (!forms) return word;
    if (forms.has(lower)) return word; // the body writes it plain too — ambiguous
    const accented = [...forms.keys()].filter((f) => f !== foldWord(f));
    if (accented.length !== 1) return word;
    const out = matchCase(word, accented[0]);
    if (out === word) return word;
    tally.set(`${word} → ${out}`, (tally.get(`${word} → ${out}`) ?? 0) + 1);
    return out;
  });
}

/**
 * Sentence-case a title that came from an ALL-CAPS deck.
 *
 * softenCaps() in hymnImport.ts capitalises every word, which is the English
 * convention; Romanian titles are sentence case. Which words keep their capital
 * is decided by the hymn's own lyrics — but only capitals found **mid-line**
 * count, because lyrics capitalise the first word of every line, and counting
 * those would mark `De` and `Drum` as proper nouns.
 */
function sentenceCaseTitle(title, blocks) {
  const isUpper = (word) =>
    word[0] === word[0].toLocaleUpperCase(LANGUAGE) &&
    word[0] !== word[0].toLocaleLowerCase(LANGUAGE);
  const words = title.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  if (words.length < 2 || words.filter(isUpper).length < 2) return title;

  const proper = new Set();
  for (const block of blocks)
    for (const line of block.text.split("\n")) {
      const lineWords = line.split(/[^\p{L}]+/u).filter(Boolean);
      for (let i = 1; i < lineWords.length; i++)
        if (isUpper(lineWords[i])) proper.add(lineWords[i].toLowerCase());
    }

  let first = true;
  return title.replace(/\p{L}+/gu, (word) => {
    if (first) {
      first = false;
      return word;
    }
    return proper.has(word.toLowerCase())
      ? word
      : word.toLocaleLowerCase(LANGUAGE);
  });
}

function matchCaseCompound(source, target) {
  const from = source.split("-");
  const to = target.split("-");
  if (from.length !== to.length) return matchCase(source, target);
  return to.map((part, i) => matchCase(from[i], part)).join("-");
}

function restoreCompounds(text, corrections, tally) {
  return text.replace(/\p{L}+(?:-\p{L}+)+/gu, (word) => {
    const fixed = corrections.get(foldWord(word));
    if (!fixed) return word;
    const out = matchCaseCompound(word, fixed);
    if (out === word) return word;
    const key = `${word} → ${out}`;
    tally.set(key, (tally.get(key) ?? 0) + 1);
    return out;
  });
}

function restoreDiacritics(text, corrections, tally) {
  return text.replace(/\p{L}+/gu, (word) => {
    const lower = word.toLowerCase();
    if (lower !== foldWord(lower)) return word; // already accented
    const fixed = corrections.get(lower);
    if (!fixed) return word;
    const out = matchCase(word, fixed);
    if (out === word) return word;
    const key = `${lower} → ${fixed}`;
    tally.set(key, (tally.get(key) ?? 0) + 1);
    return out;
  });
}

// ── manifest ─────────────────────────────────────────────────────────────────
//
// Hymn numbers are user-visible and end up in written service orders, so they
// must not shift when a deck is added later. The manifest pins file → number.

function loadManifest() {
  if (!fs.existsSync(manifestPath)) return { slug: SLUG, version: 1, entries: [] };
  return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
}

const collator = new Intl.Collator(LANGUAGE, { sensitivity: "base" });

function assignNumbers(manifest, kept) {
  const pinned = new Map(
    manifest.entries.filter((e) => e.number).map((e) => [e.file, e])
  );
  const used = new Set([...pinned.values()].map((e) => Number(e.number)));
  let next = 1;
  const nextFree = () => {
    while (used.has(next)) next++;
    used.add(next);
    return next;
  };

  // First run numbers alphabetically by title, which is the friendliest order to
  // browse. Later runs append, so that property only holds for the initial book.
  const fresh = kept
    .filter((entry) => !pinned.has(entry.key))
    .sort((a, b) => collator.compare(a.title, b.title));

  for (const entry of kept) {
    const pin = pinned.get(entry.key);
    if (pin) {
      entry.number = String(pin.number);
      if (pin.title) entry.title = pin.title;
    }
  }
  for (const entry of fresh) entry.number = String(nextFree());
  return {
    pinnedCount: kept.filter((entry) => pinned.has(entry.key)).length,
    freshCount: fresh.length,
  };
}

// ── main ─────────────────────────────────────────────────────────────────────

const { mod, cleanup } = await loadAppModules();
const { parsePptx, PptxParseError, buildDraft, draftToHymn } = mod;

const { decks, legacy, other } = discover();
const manifest = loadManifest();
const skipped = new Map(
  manifest.entries.filter((e) => e.skip).map((e) => [e.file, e.skip])
);

const entries = [];
const failures = [];
const deliberate = [];

for (const [key, full] of [...decks.entries()].sort(([a], [b]) =>
  a.localeCompare(b)
)) {
  if (skipped.has(key)) {
    deliberate.push({ key, reason: skipped.get(key) });
    continue;
  }
  let deck;
  try {
    deck = parsePptx(fs.readFileSync(full));
  } catch (error) {
    failures.push({
      key,
      reason: error instanceof PptxParseError ? error.reason : String(error),
    });
    continue;
  }

  const draft = buildDraft(deck, {
    fileName: path.basename(key),
    nextNumber: "0",
    mergeNearDuplicates: true,
  });
  const hymn = draftToHymn(draft);
  if (!hymn) {
    failures.push({ key, reason: "no-usable-slides" });
    continue;
  }

  const text = hymn.blocks.map((b) => b.text).join("\n");
  const lines = text.split("\n").filter((l) => l.trim());
  entries.push({
    key,
    title: hymn.title,
    hymn,
    draft,
    stanzas: hymn.blocks.map((b) => shingles(b.text)),
    shingles: shingles(text),
    words: fold(text).split(" ").filter(Boolean).length,
    wordsPerLine:
      lines.reduce((n, l) => n + l.trim().split(/\s+/).length, 0) /
      (lines.length || 1),
  });
}

const { clusters, scores } = clusterDuplicates(entries);
const decisions = clusters.map(chooseWinner);
const kept = decisions.map((d) => d.winner);
const duplicates = decisions.filter((d) => d.losers.length > 0);

const { pinnedCount, freshCount } = assignNumbers(manifest, kept);
kept.sort((a, b) => Number(a.number) - Number(b.number));

let hymns = kept.map((entry) => ({
  number: entry.number,
  title: entry.title,
  blocks: entry.hymn.blocks,
  sequence: entry.hymn.sequence,
}));

// Repairs run first, on every hymn; overrides are applied afterwards and win
// outright. Doing it the other way round meant a title-only override silently
// disabled diacritic repair for that hymn's whole text.
const diacriticTally = new Map();
const titleTally = new Map();
const commaTally = new Map();
const elisionTally = new Map();
const elisionSkipped = new Map();
if (!args.includes("--no-diacritics")) {
  const corrections = buildDiacriticMap();
  const compounds = buildCompoundMap();
  const hyphenSets = buildHyphenSets();
  // Elisions first: they create the hyphens the compound pass then reads.
  const repair = (text) =>
    restoreDiacritics(
      restoreCompounds(
        fixElisions(
          fixCommaTypos(text, hyphenSets, commaTally),
          hyphenSets,
          elisionTally,
          elisionSkipped
        ),
        compounds,
        diacriticTally
      ),
      corrections,
      diacriticTally
    );
  hymns = hymns.map((hymn) => {
    const blocks = hymn.blocks.map((block) => ({
      ...block,
      text: repair(block.text),
    }));
    // The hymn's own lyrics get first say on its title, then the corpus.
    let title = repair(
      sentenceCaseTitle(titleFromBody(hymn.title, blocks, titleTally), blocks)
    );
    // Filenames are not always capitalised (`va bucurati Isus e Domn.pptx`).
    title = title.replace(/^\p{Ll}/u, (c) => c.toLocaleUpperCase(LANGUAGE));
    if (title !== hymn.title) titleTally.set(`${hymn.title} → ${title}`, 1);
    return { ...hymn, title, blocks };
  });
}

const overrides = loadOverrides(outputDir, SLUG);
const applied = applyOverrides(hymns, overrides);
hymns = applied.hymns;

/**
 * Manifest entries whose deck was not passed in --source.
 *
 * These must be carried over from the committed book, not dropped: running with
 * one source instead of two (easy to do — the converted .ppt decks live in a
 * second folder) would otherwise delete 35 of the 75 hymns and write the result
 * out as if nothing happened.
 */
const missing = manifest.entries.filter((e) => !decks.has(e.file) && !e.skip);
const missingHymns = [];
if (missing.length > 0 && fs.existsSync(hymnalPath)) {
  const existing = new Map(
    JSON.parse(fs.readFileSync(hymnalPath, "utf-8")).map((h) => [h.number, h])
  );
  for (const entry of missing) {
    const hymn = existing.get(String(entry.number));
    if (hymn) missingHymns.push(hymn);
  }
  hymns = [...hymns, ...missingHymns].sort(
    (a, b) => Number(a.number) - Number(b.number)
  );
}

// ── manifest rewrite ─────────────────────────────────────────────────────────

const newManifest = {
  slug: SLUG,
  version: 1,
  note:
    "Pins hymn numbers to source decks so adding a deck later cannot renumber " +
    "existing hymns. `skip` excludes a deck with a reason; `duplicateOf` records " +
    "a transcription that lost to a better one.",
  entries: [
    ...kept.map((entry) => ({
      file: entry.key,
      number: entry.number,
      title: entry.title,
    })),
    ...duplicates.flatMap(({ winner, losers }) =>
      losers.map((loser) => ({ file: loser.key, duplicateOf: winner.key }))
    ),
    ...manifest.entries.filter((e) => e.skip),
    ...missing,
  ].sort((a, b) => a.file.localeCompare(b.file)),
};

// ── report ───────────────────────────────────────────────────────────────────

const esc = (value) => String(value).replace(/\|/g, "\\|");
const flagsOf = (entry) => entry.draft.flags.map((f) => f.code);
const allFlags = {};
for (const entry of kept)
  for (const code of flagsOf(entry)) allFlags[code] = (allFlags[code] ?? 0) + 1;

const totalLines = hymns
  .flatMap((h) => h.blocks.flatMap((b) => b.text.split("\n")))
  .filter((l) => l.trim());
const longLines = totalLines.filter(
  (l) => l.trim().split(/\s+/).length > 10
).length;

let report = `# Alte Imnuri — build report

Generated by \`scripts/build-pptx-hymnal.js\`. Everything here is a *proposal* —
review before shipping. Regenerate with:

\`\`\`bash
node scripts/build-pptx-hymnal.js ${sources.map((s) => `--source ${s}`).join(" ")} --write
\`\`\`

Source decks live outside the repo. Legacy \`.ppt\` must be converted to \`.pptx\`
first (LibreOffice headless); the app itself accepts \`.pptx\` only.

## Summary

| | count |
|---|---:|
| \`.pptx\` decks found | ${decks.size} |
| legacy \`.ppt\` ignored (convert these) | ${legacy.length} |
| non-deck files ignored | ${other.length} |
| deliberately skipped | ${deliberate.length} |
| failed to parse | ${failures.length} |
| duplicate transcriptions dropped | ${duplicates.reduce((n, d) => n + d.losers.length, 0)} |
| **hymns shipped** | **${hymns.length}** |
| numbers pinned by manifest | ${pinnedCount} |
| numbers newly assigned | ${freshCount} |
| hand-authored overrides applied | ${applied.applied.length} |
| diacritics restored from the corpus | ${[...diacriticTally.values()].reduce((n, v) => n + v, 0)} |
| title words fixed from the hymn's own lyrics | ${[...titleTally.values()].reduce((n, v) => n + v, 0)} |
| comma typos fixed (\`nu,s\` → \`nu-s\`, \`l,Tatăl\` → \`l, Tatăl\`) | ${[...commaTally.values()].reduce((n, v) => n + v, 0)} |
| apostrophes hyphenated (\`l’am\` → \`l-am\`) | ${[...elisionTally.values()].reduce((n, v) => n + v, 0)} |

## Text quality

| | |
|---|---:|
| lyric lines | ${totalLines.length} |
| average words per line | ${(totalLines.reduce((n, l) => n + l.trim().split(/\s+/).length, 0) / (totalLines.length || 1)).toFixed(1)} |
| lines over 10 words | ${longLines} |

`;

if (Object.keys(allFlags).length > 0) {
  report += `## Flags raised during mapping\n\n| flag | hymns |\n|---|---:|\n`;
  for (const [code, count] of Object.entries(allFlags).sort((a, b) => b[1] - a[1]))
    report += `| \`${code}\` | ${count} |\n`;
  report += "\n";
}

if (duplicates.length > 0) {
  report += `## Duplicate transcriptions — ${duplicates.length} songs with more than one version

Matched on shingle containment and best-matching-stanza overlap, not filenames.
Winner = fewest words per line among complete versions; anything under
${Math.round(FRAGMENT_RATIO * 100)}% of the cluster's best word count is dropped as a fragment first.

| kept | dropped | containment | stanza | why |
|---|---|---:|---:|---|
`;
  for (const { winner, losers, fragments } of duplicates)
    for (const loser of losers) {
      const score =
        scores.get(`${winner.key}|${loser.key}`) ??
        scores.get(`${loser.key}|${winner.key}`) ?? { containment: 0, stanza: 0 };
      report += `| \`${esc(winner.key)}\` — ${winner.hymn.blocks.length}b ${winner.words}w **${winner.wordsPerLine.toFixed(1)} w/line** | \`${esc(loser.key)}\` — ${loser.hymn.blocks.length}b ${loser.words}w ${loser.wordsPerLine.toFixed(1)} w/line | ${score.containment.toFixed(2)} | ${score.stanza.toFixed(2)} | ${fragments.includes(loser) ? "**fragment**" : "line quality"} |\n`;
    }
  report += "\n";
}

if (deliberate.length > 0) {
  report += `## Deliberately skipped\n\nRecorded in the manifest so a re-run cannot silently resurrect them.\n\n`;
  for (const { key, reason } of deliberate)
    report += `- **\`${esc(key)}\`** — ${esc(reason)}\n`;
  report += "\n";
}

if (failures.length > 0) {
  report += `## Failed to parse\n\n| deck | reason |\n|---|---|\n`;
  for (const { key, reason } of failures)
    report += `| \`${esc(key)}\` | \`${esc(reason)}\` |\n`;
  report += "\n";
}

if (legacy.length > 0) {
  report += `## Legacy \`.ppt\` ignored — ${legacy.length} files

Convert these and pass the output as another \`--source\`:

\`\`\`bash
soffice --headless --norestore --convert-to pptx --outdir <out> <dir>/*.ppt
\`\`\`

`;
}

if (applied.applied.length > 0) {
  report += `## Overrides applied\n\nFrom \`assets/hymnals/overrides/${SLUG}.json\`, re-applied on every build.\n\n| # | reason |\n|---|---|\n`;
  for (const { number, reason } of applied.applied)
    report += `| ${number} | ${esc(reason)} |\n`;
  report += "\n";
}
if (applied.unmatched.length > 0) {
  report += `**Overrides matching no hymn:** ${applied.unmatched
    .map((n) => `\`${n}\``)
    .join(", ")} — the numbering may have shifted.\n\n`;
}
if (missing.length > 0) {
  report += `## Manifest entries with no source file — ${missing.length}\n\n**${missingHymns.length} of these were carried over unchanged from the committed book**, so this build did not regenerate them. Pass every source folder to rebuild them from their decks.\n\n${missing
    .map((e) => `- \`${esc(e.file)}\` (#${e.number})`)
    .join("\n")}\n\n`;
}

if (diacriticTally.size > 0) {
  report += `## Diacritics restored — ${[...diacriticTally.values()].reduce((n, v) => n + v, 0)} words

The decks were typed without Romanian diacritics, unevenly. A plain word is
corrected only when the six shipped Romanian hymnals — our own hand-reviewed
corpus — **never** spell it that way. That is what admits \`si\` → \`și\` while
refusing \`sa\` → \`să\`: \`sa\` is a real word (the possessive) and the corpus
uses it 328 times. Everything ambiguous is left exactly as the deck wrote it.

Pass \`--no-diacritics\` to skip this pass. Hymns carrying a hand-written
override are never touched by it.

| correction | times |
|---|---:|
`;
  for (const [key, count] of [...diacriticTally.entries()].sort((a, b) => b[1] - a[1]))
    report += `| ${esc(key)} | ${count} |\n`;
  report += "\n";
}

if (elisionTally.size > 0) {
  report += `## Elisions hyphenated — ${[...elisionTally.values()].reduce((n, v) => n + v, 0)} words

Romanian elision at a word boundary takes a hyphen (\`l-am\`, \`se-ngrijește\`);
the decks type an apostrophe. Converted only where the corpus attests the
hyphenated form or its left part, which protects word-initial aphaeresis
(\`’nălțimi\`), intra-word syncope (\`Soar’le\` for *soarele*) and foreign
contractions (\`I’ll\`) — all of which the corpus itself keeps.

| correction | times |
|---|---:|
`;
  for (const [key, count] of [...elisionTally.entries()].sort((a, b) => b[1] - a[1]))
    report += `| ${esc(key)} | ${count} |\n`;
  report += "\n";
  if (elisionSkipped.size > 0) {
    report += `Left as written, unattested by the corpus — check these by eye:\n\n`;
    for (const [word, count] of elisionSkipped)
      report += `- \`${esc(word)}\`${count > 1 ? ` (×${count})` : ""}\n`;
    report += "\n";
  }
}

if (commaTally.size > 0) {
  report += `## Comma typos — ${[...commaTally.values()].reduce((n, v) => n + v, 0)}

A comma typed where a hyphen or a space belongs. Which one is decided the same
way as for apostrophes; a comma directly before a hyphen is always dropped, the
corpus having none.

| correction | times |
|---|---:|
`;
  for (const [key, count] of [...commaTally.entries()].sort((a, b) => b[1] - a[1]))
    report += `| ${esc(key)} | ${count} |\n`;
  report += "\n";
}

report += `## Hymns — ${hymns.length}\n\n| # | title | blocks | sequence | source deck |\n|---:|---|---:|---|---|\n`;
const byNumber = new Map(kept.map((e) => [e.number, e]));
for (const hymn of hymns) {
  const entry = byNumber.get(hymn.number);
  report += `| ${hymn.number} | ${esc(hymn.title)} | ${hymn.blocks.length} | \`${hymn.sequence.join(",")}\` | \`${esc(entry?.key ?? "—")}\` |\n`;
}

// ── output ───────────────────────────────────────────────────────────────────

console.log(`\n  ${SLUG}`);
console.log(`    decks found        ${decks.size} .pptx, ${legacy.length} legacy .ppt ignored`);
console.log(`    skipped/failed     ${deliberate.length} skipped, ${failures.length} failed`);
console.log(`    duplicates dropped ${duplicates.reduce((n, d) => n + d.losers.length, 0)}`);
console.log(`    numbers            ${pinnedCount} pinned, ${freshCount} newly assigned`);
console.log(`    overrides          ${applied.applied.length} applied`);
console.log(`    diacritics         ${[...diacriticTally.values()].reduce((n, v) => n + v, 0)} words restored`);
console.log(`    titles             ${[...titleTally.values()].reduce((n, v) => n + v, 0)} words fixed from their own lyrics`);
console.log(`    comma typos        ${[...commaTally.values()].reduce((n, v) => n + v, 0)} fixed`);
console.log(`    elisions           ${[...elisionTally.values()].reduce((n, v) => n + v, 0)} apostrophes hyphenated, ${[...elisionSkipped.values()].reduce((n, v) => n + v, 0)} left`);
console.log(`    hymns              ${hymns.length}`);
if (missing.length > 0) {
  console.log(
    `\n  ! ${missing.length} manifest entries had no source file; ` +
      `${missingHymns.length} carried over from the committed book.`
  );
  console.log(
    `    Pass every source folder, or those hymns go stale. Missing decks:`
  );
  for (const entry of missing.slice(0, 5))
    console.log(`      ${entry.file}`);
  if (missing.length > 5) console.log(`      … and ${missing.length - 5} more`);
}
for (const { key, reason } of failures) console.log(`      ! ${key}: ${reason}`);

if (WRITE && missing.length > 0 && !args.includes("--allow-missing")) {
  console.error(
    `\n  Refusing to write: ${missing.length} manifest entries have no source file.\n\n` +
      `  A partial source set cannot reproduce the book — duplicate resolution\n` +
      `  changes when a competing transcription is absent, so hymns get renumbered\n` +
      `  and doubled. Pass every source folder:\n\n` +
      `    node scripts/build-pptx-hymnal.js \\\n` +
      `      --source ~/Downloads/cantari-bis \\\n` +
      `      --source ~/Downloads/cantari-bis-converted --write\n\n` +
      `  Use --allow-missing only to deliberately rebuild a subset; the absent\n` +
      `  hymns are then carried over unchanged from the committed book.\n`
  );
  process.exit(1);
}

if (WRITE) {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(hymnalPath, JSON.stringify(hymns, null, 2) + "\n");
  fs.writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + "\n");
  fs.writeFileSync(reportPath, report);
  console.log(`\n  wrote ${path.relative(repoRoot, hymnalPath)}`);
  console.log(`        ${path.relative(repoRoot, manifestPath)}`);
  console.log(`        ${path.relative(repoRoot, reportPath)}`);
  console.log(
    `\n  Update songCount for "${SLUG}" in src/shared/hymnals.ts to ${hymns.length}, ` +
      `then run\n  node scripts/verify-hymnals.js\n`
  );
} else {
  console.log(`\n  dry run — pass --write to emit the book, manifest and report\n`);
}

cleanup();
