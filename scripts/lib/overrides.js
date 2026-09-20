import fs from "node:fs";
import path from "node:path";

/**
 * Hand-authored corrections, keyed by hymn number, in
 * assets/hymnals/overrides/{slug}.json. The hymnals are generated, so anything
 * edited straight into the output is lost on the next run — corrections live
 * here instead and are re-applied on top of every build.
 *
 * Each entry may set `title`, `blocks` and/or `sequence`, plus a `reason`
 * recording why the generated version was wrong. Everything else is inherited.
 *
 * Shared by build-hymnals.js (MyBible books) and build-pptx-hymnal.js (the
 * bundled PowerPoint-sourced book), which need identical semantics.
 */
export function loadOverrides(outputDir, slug) {
  const file = path.join(outputDir, "overrides", `${slug}.json`);
  if (!fs.existsSync(file)) return new Map();
  return new Map(Object.entries(JSON.parse(fs.readFileSync(file, "utf-8"))));
}

export function applyOverrides(hymns, overrides) {
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
