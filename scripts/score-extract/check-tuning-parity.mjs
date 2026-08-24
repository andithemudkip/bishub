#!/usr/bin/env node
// Verify the live and baked keyframe paths agree.
//
// Timing corrections are implemented twice: applyLyricsTuning() in
// src/shared/ttmlParser.ts, which the app applies as the operator nudges, and
// _word_deltas()/to_ttml() in stage2.py, which bakes them into the generated
// TTML. If they ever disagree, a correction sounds right while tuning and wrong
// once regenerated — silently. This runs both over the same keyframes and
// compares every word.
//
// Usage: node check-tuning-parity.mjs <score.json> <recording.mp3> [python]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [scorePath, mp3Path, python = "python3"] = process.argv.slice(2);
if (!scorePath || !mp3Path) {
  console.error("usage: node check-tuning-parity.mjs <score.json> <recording.mp3> [python]");
  process.exit(2);
}

const here = path.dirname(new URL(import.meta.url).pathname);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tuning-parity-"));
const KEYFRAMES = [
  { fromWord: 7, delta: -0.4 },
  { fromWord: 20, delta: 0.25 },
];
const OFFSET = 0.15;

// The TypeScript is transpiled rather than reimplemented — reimplementing it
// here would test the copy, not the code the app runs.
const parser = path.join(tmp, "ttmlParser.mjs");
execFileSync("npx", ["esbuild", path.join(here, "../../src/shared/ttmlParser.ts"),
  "--format=esm", `--outfile=${parser}`, "--log-level=error"], { stdio: "inherit" });
const { applyLyricsTuning } = await import(parser);

const overrides = path.join(tmp, "overrides.json");
const number = JSON.parse(fs.readFileSync(scorePath, "utf-8")).number.padStart(3, "0");
fs.writeFileSync(overrides,
  JSON.stringify({ [number]: { shift: OFFSET, breakpoints: KEYFRAMES } }));

const run = (out, extra) =>
  execFileSync(python, [path.join(here, "stage2.py"), scorePath, mp3Path, "--out", out, ...extra],
    { stdio: ["ignore", "ignore", "ignore"] });
const plainPath = path.join(tmp, "plain.ttml");
const bakedPath = path.join(tmp, "baked.ttml");
run(plainPath, ["--overrides", path.join(tmp, "none.json")]);
run(bakedPath, ["--overrides", overrides]);

const secs = (v) => { const p = v.split(":"); return +p[0] * 60 + +p[1]; };
const read = (f) =>
  [...fs.readFileSync(f, "utf-8").matchAll(/<p [^>]*>(.*?)<\/p>/g)].map((m) => {
    const words = [...m[1].matchAll(/<span begin="([^"]+)" end="([^"]+)">(.*?)<\/span>/g)]
      .map((w) => ({ text: w[3], begin: secs(w[1]), end: secs(w[2]) }));
    return { words, begin: words[0].begin, end: words[words.length - 1].end };
  });

const live = applyLyricsTuning(read(plainPath), { offset: OFFSET, breakpoints: KEYFRAMES });
const baked = read(bakedPath);
const flat = (ls) => ls.flatMap((l) => l.words.map((w) => [w.begin, w.end]));
const a = flat(live);
const b = flat(baked);

let worstBegin = 0;
let worstEnd = 0;
for (let i = 0; i < Math.min(a.length, b.length); i++) {
  worstBegin = Math.max(worstBegin, Math.abs(a[i][0] - b[i][0]));
  worstEnd = Math.max(worstEnd, Math.abs(a[i][1] - b[i][1]));
}

// Words must also stay adjoining across a keyframe: the display animates
// begin→end, so a gap freezes a word and an overlap runs two at once.
let boundaryBreaks = 0;
for (let i = 0; i + 1 < a.length; i++) {
  if (Math.abs(a[i][1] - a[i + 1][0]) > 0.002) boundaryBreaks++;
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`words: live ${a.length}, baked ${b.length}`);
console.log(`max begin difference: ${worstBegin.toFixed(4)}s`);
console.log(`max end   difference: ${worstEnd.toFixed(4)}s`);
console.log(`non-adjoining word boundaries: ${boundaryBreaks}`);
const ok = a.length === b.length && worstBegin < 0.002 && worstEnd < 0.002 && boundaryBreaks === 0;
console.log(ok ? "PASS — live and baked agree" : "FAIL — the two paths disagree");
process.exit(ok ? 0 : 1);
