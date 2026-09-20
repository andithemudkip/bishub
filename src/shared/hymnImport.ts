import type {
  Hymn,
  HymnBlock,
  HymnBlockKind,
  ParsedDeck,
  ParsedSlide,
} from "./types";

/**
 * Maps a ParsedDeck onto our hymn schema.
 *
 * Pure and renderer-side on purpose: the import review screen re-runs buildDraft()
 * on every slide de-selection, so this must not involve IPC or a socket round-trip.
 * The main process hands over ParsedDeck once and gets a finished Hymn back.
 */

// ── canonicalisation ─────────────────────────────────────────────────────────

/**
 * Legacy cedilla forms (U+015F/U+0163, really Turkish letters) → the correct
 * Romanian comma-below forms. Church decks authored on older Windows are full of
 * them, and scripts/verify-hymnals.js fails a Romanian book that still contains
 * any. Mirrors canonicalize() in scripts/lib/hymn-merge.js — keep the two in step.
 */
const CEDILLA: ReadonlyArray<readonly [RegExp, string]> = [
  [/ş/g, "ș"],
  [/Ş/g, "Ș"],
  [/ţ/g, "ț"],
  [/Ţ/g, "Ț"],
];

/**
 * Repeat markers. We write `(: … :)`; decks in the wild use `/: … :/` and
 * `[: … :]` too. Normalising here keeps the three from being treated as
 * different text by the dedupe below.
 */
const REPEAT_OPEN = /(?:\/:|\[:)\s*/g;
const REPEAT_CLOSE = /\s*(?::\/|:\])/g;

/** Prime and backtick standing in for an apostrophe (`E ′ntre`, `pe ′nălțimi`). */
const FAKE_APOSTROPHE = /[′´`]/g;

/**
 * House typography for imported slide text. Applied once, in the shared layer, so
 * an in-app import and the bundled-book generator treat text identically.
 */
export function canonicalizeHymnText(
  text: string,
  { romanian = true }: { romanian?: boolean } = {}
): string {
  let out = text.normalize("NFC").replace(/\r\n?/g, "\n");
  if (romanian) for (const [from, to] of CEDILLA) out = out.replace(from, to);
  out = out.replace(FAKE_APOSTROPHE, "’");
  out = out.replace(REPEAT_OPEN, "(: ").replace(REPEAT_CLOSE, " :)");
  return out
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Dedupe key for a stanza.
 *
 * Deliberately NOT normalizeForSearch() from ./utils — that strips diacritics,
 * which in Romanian would merge distinct lines (`tara`/`țara`, `si`/`și`).
 */
export function normalizeBlockKey(text: string): string {
  return text
    .toLowerCase()
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim().replace(/[.,;:!?…]+$/, ""))
    .filter(Boolean)
    .join("\n");
}

// ── verse / chorus markers ───────────────────────────────────────────────────

/**
 * Decks mark structure explicitly far more often than they repeat slides:
 * `1.` / `2.` for verses, and for the chorus `Ref.` / `Ref:` / `Refren`, `R` /
 * `R:`, or `Cor.` / `Cor:` (Romanian *cor*, choir). The marker is stripped —
 * shipped hymnals carry no markers in blocks[].text.
 */
const CHORUS_WORD = "(?:ref(?:ren)?|cor|r)";
const CHORUS_MARKER = new RegExp(`^[ \t]*${CHORUS_WORD}[ \t]*[.:)][ \t]*`, "i");
const CHORUS_MARKER_BARE = new RegExp(`^[ \t]*${CHORUS_WORD}[ \t]*[.:)]?[ \t]*$`, "i");
const VERSE_MARKER = /^[ \t]*(\d{1,2})[ \t]*[.):][ \t]*/;
const VERSE_MARKER_BARE = /^[ \t]*(\d{1,2})[ \t]*[.):]?[ \t]*$/;

interface MarkerMatch {
  kind: HymnBlockKind;
  /** The stanza text with the marker removed. */
  text: string;
}

/**
 * Split a slide into stanzas at its markers.
 *
 * A slide is not always one stanza: five decks in the real collection put the
 * verse and the whole chorus on the same slide, separated by a `Ref:` line —
 * which is the very defect the shipped hymnals carry hand-written overrides for
 * ("the refrain was embedded inside every verse instead of being a deduped
 * chorus block"). Splitting here keeps it from happening again.
 *
 * The first segment may have no marker at all: it is the verse that precedes a
 * mid-slide `Ref:`.
 */
function splitIntoSegments(
  text: string
): Array<{ text: string; markerKind?: HymnBlockKind }> {
  if (!text) return [];
  const lines = text.split("\n");
  const segments: Array<{ lines: string[]; markerKind?: HymnBlockKind }> = [];
  let current: { lines: string[]; markerKind?: HymnBlockKind } = { lines: [] };

  for (const line of lines) {
    const marker = stripMarker(line);
    // A marker only starts a new stanza once the current one has content;
    // otherwise `Ref:\nlyrics` would open with an empty segment.
    if (marker && current.lines.some((l) => l.trim())) {
      segments.push(current);
      current = { lines: marker.text ? [marker.text] : [], markerKind: marker.kind };
    } else if (marker) {
      current.markerKind = marker.kind;
      if (marker.text) current.lines.push(marker.text);
    } else {
      current.lines.push(line);
    }
  }
  segments.push(current);

  return segments
    .map((segment) => ({
      text: segment.lines.join("\n").replace(/\n{2,}/g, "\n").trim(),
      markerKind: segment.markerKind,
    }))
    .filter((segment) => segment.text.length > 0);
}

/** Read and strip a leading verse/chorus marker, on its own line or inline. */
function stripMarker(text: string): MarkerMatch | null {
  const lines = text.split("\n");
  const first = lines[0] ?? "";

  if (CHORUS_MARKER_BARE.test(first)) {
    return { kind: "chorus", text: lines.slice(1).join("\n").trim() };
  }
  if (CHORUS_MARKER.test(first)) {
    return {
      kind: "chorus",
      text: [first.replace(CHORUS_MARKER, ""), ...lines.slice(1)].join("\n").trim(),
    };
  }
  if (VERSE_MARKER_BARE.test(first)) {
    return { kind: "verse", text: lines.slice(1).join("\n").trim() };
  }
  if (VERSE_MARKER.test(first)) {
    return {
      kind: "verse",
      text: [first.replace(VERSE_MARKER, ""), ...lines.slice(1)].join("\n").trim(),
    };
  }
  return null;
}

// ── title detection ──────────────────────────────────────────────────────────

/** A line that is only a hymn number, e.g. `147` or `Nr. 147`. */
const NUMBER_ONLY = /^[ \t]*(?:nr\.?|no\.?|#)?[ \t]*\d{1,3}[ \t]*$/i;
/** A number leading a title, e.g. `625. Fără hotar` or `147 - Ce prieten`. */
const LEADING_NUMBER = /^[ \t]*(\d{1,3})[ \t]*[.\-–)]?[ \t]+(?=\S)/;
/** Titles PowerPoint invents when the deck has none. */
const GENERIC_TITLE = /^(?:powerpoint presentation|presentation|prezentare|slide\s*\d*|untitled)\s*$/i;

/**
 * Repeat markers mean the slide is a stanza someone wrapped for repetition, not a
 * title. `Tine-ma in mana Ta.pptx` opens with `(: … :)` across two lines and was
 * otherwise short enough to pass every title test.
 */
function hasRepeatMarker(text: string): boolean {
  return /\(:|:\)/.test(text);
}

function isTitleish(text: string): boolean {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return false;
  if (lines.length === 1 && NUMBER_ONLY.test(lines[0])) return true;
  // The common `147` / `Ce prieten avem în Cristos` shape, and plain short titles.
  return lines.length <= 2 && text.length <= 60;
}

/** Longest line, which on a title slide is the title rather than the number. */
function longestLine(text: string): string {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .reduce((best, line) => (line.length > best.length ? line : best), "");
}

function titleFromFileName(fileName: string): string {
  return fileName
    .replace(/\.pptx?$/i, "")
    .replace(/\([^)]*\)/g, " ") // `(poezie nu stiu)` is a note, not part of the title
    .replace(/[_\s]+/g, " ")
    .trim();
}

/** ALL-CAPS deck titles are common; never ship a shouting title. */
function softenCaps(title: string): string {
  const letters = title.replace(/[^A-Za-zĂÂÎȘȚăâîșț]/g, "");
  if (letters.length < 4 || letters !== letters.toUpperCase()) return title;
  return title
    .toLocaleLowerCase("ro")
    .replace(/(^|[\s(„"'’-])(\p{L})/gu, (_, lead: string, ch: string) => lead + ch.toLocaleUpperCase("ro"));
}

// ── slide furniture ──────────────────────────────────────────────────────────

/** A slide counter: `1/3`, `2 / 3`, `1 of 3`. Lyrics never look like this. */
const SLIDE_COUNTER = /^\s*\d{1,3}\s*(?:\/|of)\s*\d{1,3}\s*$/i;

/**
 * Running headers and footers — a hymn number stamped on every slide, a page
 * counter, a church name. PowerPoint puts them in their own text shapes, so
 * they arrive looking exactly like lyrics and end up welded into a stanza. One
 * real deck had `Nr. 424` on all six slides, which deduped into its own block
 * and was then presented as a chorus.
 *
 * A short shape repeated across most of the deck is furniture by definition; a
 * stanza is neither that short nor that repetitive. The counter pattern is
 * matched separately because `1/3`, `2/3`, `3/3` differ per slide.
 */
function findFurniture(slides: readonly ParsedSlide[]): ReadonlySet<string> {
  const furniture = new Set<string>();
  if (slides.length < 2) return furniture;

  const counts = new Map<string, number>();
  for (const slide of slides)
    for (const shape of slide.shapes) {
      const key = shape.trim();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

  const threshold = Math.max(2, Math.ceil(slides.length * 0.6));
  for (const [shape, count] of counts) {
    if (SLIDE_COUNTER.test(shape)) {
      furniture.add(shape);
      continue;
    }
    const lines = shape.split("\n").filter((line) => line.trim());
    if (count >= threshold && shape.length <= 40 && lines.length <= 2)
      furniture.add(shape);
  }
  return furniture;
}

// ── draft ────────────────────────────────────────────────────────────────────

export type AutoExclusionReason = "title-slide" | "empty";

export type DraftFlagCode =
  | "no-included-slides"
  | "single-slide"
  | "all-slides-identical"
  | "many-slides"
  | "empty-slides"
  | "foreign-number"
  | "dropped-furniture"
  | "near-duplicate-blocks"
  | "merged-near-duplicates";

export interface DraftFlag {
  code: DraftFlagCode;
  /** Free-form value for the UI to interpolate — never a prebuilt English string. */
  detail?: string;
}

export interface DraftSlide {
  /** Index in ParsedDeck.slides. Stable across toggles. */
  index: number;
  /** Canonicalised lyric text, marker stripped. Empty for a no-text slide. */
  text: string;
  included: boolean;
  /**
   * Indices into blocks[], one per stanza on this slide — usually one, but a
   * slide carrying a verse and the chorus contributes two. Empty when excluded.
   */
  blockIndices: number[];
  autoExcluded?: AutoExclusionReason;
  /** Kind implied by an explicit marker, per stanza on this slide. */
  markerKinds?: Array<HymnBlockKind | undefined>;
}

export interface HymnImportDraft {
  title: string;
  number: string;
  slides: DraftSlide[];
  blocks: HymnBlock[];
  sequence: number[];
  flags: DraftFlag[];
  /** Where the title came from, so the review screen can say so. */
  titleSource: "shape" | "title-slide" | "filename" | "first-line" | "doc-title";
}

export interface BuildDraftOptions {
  fileName: string;
  /** Number to use when the deck suggests none. */
  nextNumber: string;
  /**
   * Slides the user unchecked. Auto-exclusions are computed here rather than
   * seeded into this set, so their reason survives every toggle.
   */
  excluded?: ReadonlySet<number>;
  /**
   * Slides the user re-checked, overriding an auto-exclusion. Needed because a
   * pre-deselected slide must be one click from coming back — with only
   * `excluded`, re-including an auto-excluded slide would be impossible.
   */
  included?: ReadonlySet<number>;
  /**
   * Per-block kind overrides keyed by normalised block text, NOT by block index:
   * indices shift as slides are toggled, the text does not.
   */
  kindOverrides?: ReadonlyMap<string, HymnBlockKind>;
  /** User-edited title/number, which always win. */
  title?: string;
  number?: string;
  /**
   * Collapse stanzas that differ only by dropped diacritics into one block,
   * repairing the text line by line. Off by default: in the review screen the
   * user should decide, because merging silently picks which variant survives.
   * The bundled-book generator turns it on — we control that content and should
   * not ship a chorus three times with a different typo in each copy.
   */
  mergeNearDuplicates?: boolean;
}

const MANY_SLIDES = 60;

/** Pure. Safe to re-run on every de-selection toggle. */
export function buildDraft(
  deck: ParsedDeck,
  opts: BuildDraftOptions
): HymnImportDraft {
  const flags: DraftFlag[] = [];

  // 1 ─ text per slide, with the slide-1 title shape lifted out of the lyrics.
  let shapeTitle: string | null = null;
  const furniture = findFurniture(deck.slides);
  let furnitureDropped = 0;
  const rawSlides = deck.slides.map((slide, index) => {
    let shapes = slide.shapes.filter((shape) => {
      if (!furniture.has(shape.trim())) return true;
      furnitureDropped++;
      return false;
    });
    if (index === 0 && shapes.length > 1) {
      const head = canonicalizeHymnText(shapes[0]);
      // A short opening shape above the first verse is the title, not a lyric.
      if (
        head &&
        head.length <= 60 &&
        !stripMarker(head) &&
        !hasRepeatMarker(head) &&
        isTitleish(head)
      ) {
        shapeTitle = longestLine(head);
        shapes = shapes.slice(1);
      }
    }
    return canonicalizeHymnText(shapes.join("\n"));
  });

  // 2 ─ markers give structure directly; dedupe is the fallback. One slide may
  //     hold more than one stanza, so this yields a list per slide.
  const segmented = rawSlides.map(splitIntoSegments);
  const slideText = segmented.map((segments) =>
    segments.map((segment) => segment.text).join("\n")
  );

  // 3 ─ auto-exclusions. Only ever pre-deselect; never hide.
  const keyCounts = new Map<string, number>();
  for (const segments of segmented)
    for (const segment of segments) {
      const key = normalizeBlockKey(segment.text);
      keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
    }

  let titleSlideIndex: number | null = null;
  if (!shapeTitle && segmented.length > 1) {
    const first = slideText[0];
    // "appears exactly once" guards against mistaking a repeated chorus for a title.
    if (
      first &&
      segmented[0].length === 1 &&
      isTitleish(first) &&
      !hasRepeatMarker(first) &&
      keyCounts.get(normalizeBlockKey(first)) === 1
    ) {
      titleSlideIndex = 0;
    }
  }

  const autoExclusion = (index: number): AutoExclusionReason | undefined => {
    if (!slideText[index]) return "empty";
    if (index === titleSlideIndex) return "title-slide";
    return undefined;
  };

  const isIncluded = (index: number): boolean => {
    if (opts.excluded?.has(index)) return false;
    if (opts.included?.has(index)) return true;
    return autoExclusion(index) === undefined;
  };

  // 4 ─ exclusion BEFORE dedupe, so dropping one occurrence of a repeated chorus
  //     removes just that repeat from the sequence.
  const blocks: HymnBlock[] = [];
  const blockKeys: string[] = [];
  const blockIndexByKey = new Map<string, number>();
  const sequence: number[] = [];
  const slides: DraftSlide[] = [];

  for (let index = 0; index < segmented.length; index++) {
    const segments = segmented[index];
    const included = isIncluded(index) && segments.length > 0;
    const blockIndices: number[] = [];

    if (included) {
      for (const segment of segments) {
        const key = normalizeBlockKey(segment.text);
        const existing = blockIndexByKey.get(key);
        let blockIndex: number;
        if (existing === undefined) {
          blockIndex = blocks.length;
          blockIndexByKey.set(key, blockIndex);
          blockKeys.push(key);
          blocks.push({ kind: segment.markerKind ?? "verse", text: segment.text });
        } else {
          blockIndex = existing;
          // A marker anywhere beats an inference from repetition.
          if (segment.markerKind) blocks[existing].kind = segment.markerKind;
        }
        blockIndices.push(blockIndex);
        sequence.push(blockIndex);
      }
    }

    slides.push({
      index,
      text: slideText[index],
      included,
      blockIndices,
      autoExcluded: autoExclusion(index),
      markerKinds: segments.map((segment) => segment.markerKind),
    });
  }

  // 4b ─ optional repair of near-duplicate stanzas.
  const merged = opts.mergeNearDuplicates
    ? mergeNearDuplicateBlocks(blocks, blockKeys, sequence, slides)
    : null;
  if (merged) flags.push(...merged.flags);

  // 5 ─ kind: an unmarked block that recurs is a chorus; overrides win outright.
  const repeats = new Map<number, number>();
  for (const index of sequence) repeats.set(index, (repeats.get(index) ?? 0) + 1);
  blocks.forEach((block, index) => {
    const marked = slides.some((s) =>
      s.blockIndices.some(
        (b, i) => b === index && s.markerKinds?.[i] !== undefined
      )
    );
    if (!marked && (repeats.get(index) ?? 0) > 1) block.kind = "chorus";
    // A stanza marked `Ref:` on one slide and left unmarked on another is the
    // chorus — `Valuri muginde` does exactly that.
    if (
      marked &&
      slides.some((s) =>
        s.blockIndices.some((b, i) => b === index && s.markerKinds?.[i] === "chorus")
      )
    ) {
      block.kind = "chorus";
    }
    const override = opts.kindOverrides?.get(blockKeys[index]);
    if (override) block.kind = override;
  });

  // 6 ─ title and number.
  const { title, titleSource, foreignNumber } = resolveTitle(deck, opts, {
    shapeTitle,
    titleSlideText: titleSlideIndex === null ? null : slideText[titleSlideIndex],
    firstIncluded: slides.find((s) => s.included)?.text ?? null,
  });

  const fileNumber = LEADING_NUMBER.exec(titleFromFileName(opts.fileName))?.[1];
  if (foreignNumber) flags.push({ code: "foreign-number", detail: foreignNumber });

  // 7 ─ flags: surface edge cases rather than swallowing them.
  if (furnitureDropped > 0)
    flags.push({ code: "dropped-furniture", detail: String(furnitureDropped) });

  const emptyCount = slides.filter((s) => !s.text).length;
  if (emptyCount > 0) flags.push({ code: "empty-slides", detail: String(emptyCount) });
  if (!slides.some((s) => s.included)) flags.push({ code: "no-included-slides" });
  if (deck.slides.length === 1) flags.push({ code: "single-slide" });
  if (deck.slides.length > MANY_SLIDES)
    flags.push({ code: "many-slides", detail: String(deck.slides.length) });
  if (blocks.length === 1 && sequence.length > 1)
    flags.push({ code: "all-slides-identical" });

  // Stanzas that differ only by a dropped diacritic or stray punctuation are
  // almost always one stanza retyped — `Azi m’am întors` has its chorus three
  // times, each missing a different diacritic. We do NOT merge them: the plan
  // rules out diacritic-insensitive dedupe (it would merge genuinely distinct
  // Romanian lines), and multi-part refrains are real — `Fii lăudat` has three
  // different stanzas all marked `Ref:`. So surface it and let the reviewer decide.
  if (!opts.mergeNearDuplicates) {
    const nearDuplicates = findNearDuplicates(blocks);
    if (nearDuplicates.length > 0)
      flags.push({ code: "near-duplicate-blocks", detail: nearDuplicates.join(",") });
  }

  return {
    title: opts.title ?? title,
    number: opts.number ?? fileNumber ?? opts.nextNumber,
    slides,
    blocks,
    sequence,
    flags,
    titleSource,
  };
}

/** Romanian letters that a careless retype drops. */
const DIACRITICS = /[ăâîșțĂÂÎȘȚ]/g;

/**
 * Repair one line from its variants.
 *
 * The errors in real decks are always *dropped* diacritics, never added ones
 * (`acasa` for `acasă`, `renascut` for `renăscut`), so the variant carrying the
 * most diacritics is the least corrupted. Ties keep the first occurrence.
 *
 * This cannot fix a typo present in every variant — `Dragoste divina` reads
 * `spalati`/`spălati` with no copy spelling `spălați`, and `In curând` never
 * gets its `Î`. Those need an entry in assets/hymnals/overrides/{slug}.json,
 * which is exactly what that file is for.
 */
function bestLine(variants: readonly string[]): string {
  let best = variants[0] ?? "";
  let bestScore = (best.match(DIACRITICS) ?? []).length;
  for (const variant of variants.slice(1)) {
    const score = (variant.match(DIACRITICS) ?? []).length;
    if (score > bestScore) {
      best = variant;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Collapse each near-duplicate group into its lowest-indexed block, with every
 * line repaired from the group's variants, then remap sequence and slides onto
 * the compacted block list. Mutates `blocks`, `blockKeys`, `sequence`, `slides`.
 */
function mergeNearDuplicateBlocks(
  blocks: HymnBlock[],
  blockKeys: string[],
  sequence: number[],
  slides: DraftSlide[]
): { flags: DraftFlag[] } | null {
  const groups = findNearDuplicates(blocks).map((g) => g.split("+").map(Number));
  if (groups.length === 0) return null;

  const remap = new Map<number, number>();
  const dropped = new Set<number>();

  for (const group of groups) {
    const keep = group[0];
    const variants = group.map((index) => blocks[index].text.split("\n"));
    const lineCount = Math.max(...variants.map((v) => v.length));
    const repaired: string[] = [];
    for (let line = 0; line < lineCount; line++) {
      repaired.push(bestLine(variants.map((v) => v[line] ?? "").filter(Boolean)));
    }
    blocks[keep] = { ...blocks[keep], text: repaired.filter(Boolean).join("\n") };
    blockKeys[keep] = normalizeBlockKey(blocks[keep].text);
    for (const index of group.slice(1)) {
      remap.set(index, keep);
      dropped.add(index);
    }
  }

  // Compact, then rebuild every index that pointed into the old array.
  const shift: number[] = [];
  let offset = 0;
  for (let index = 0; index < blocks.length; index++) {
    shift[index] = index - offset;
    if (dropped.has(index)) offset++;
  }
  const resolve = (index: number): number => shift[remap.get(index) ?? index];

  for (let index = 0; index < sequence.length; index++) {
    sequence[index] = resolve(sequence[index]);
  }
  for (const slide of slides) {
    slide.blockIndices = slide.blockIndices.map(resolve);
  }
  for (let index = blocks.length - 1; index >= 0; index--) {
    if (dropped.has(index)) {
      blocks.splice(index, 1);
      blockKeys.splice(index, 1);
    }
  }

  return {
    flags: [
      {
        code: "merged-near-duplicates",
        detail: String(groups.reduce((n, g) => n + g.length - 1, 0)),
      },
    ],
  };
}

/** Groups of block indices that are the same stanza bar typography. */
function findNearDuplicates(blocks: readonly HymnBlock[]): string[] {
  const loose = (text: string): string =>
    normalizeBlockKey(text)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}\n]+/gu, " ")
      .replace(/[ \t]+/g, " ")
      .trim();

  const byLoose = new Map<string, number[]>();
  blocks.forEach((block, index) => {
    const key = loose(block.text);
    if (!key) return;
    const group = byLoose.get(key);
    if (group) group.push(index);
    else byLoose.set(key, [index]);
  });

  return [...byLoose.values()]
    .filter((group) => group.length > 1)
    .map((group) => group.join("+"));
}

function resolveTitle(
  deck: ParsedDeck,
  opts: BuildDraftOptions,
  found: {
    shapeTitle: string | null;
    titleSlideText: string | null;
    firstIncluded: string | null;
  }
): {
  title: string;
  titleSource: HymnImportDraft["titleSource"];
  foreignNumber: string | null;
} {
  const strip = (
    raw: string
  ): { text: string; number: string | null } => {
    const bare = raw.replace(/\(:\s*|\s*:\)/g, " ").replace(/\s+/g, " ").trim();
    const match = LEADING_NUMBER.exec(bare);
    return match
      ? { text: bare.slice(match[0].length).trim(), number: match[1] }
      : { text: bare, number: null };
  };

  // 1. The slide-1 title shape — the dominant pattern in native .pptx.
  if (found.shapeTitle) {
    const { text, number } = strip(found.shapeTitle);
    if (text) return { title: softenCaps(text), titleSource: "shape", foreignNumber: number };
  }

  // 2. A title slide — the dominant pattern in decks converted from legacy .ppt.
  if (found.titleSlideText) {
    const { text, number } = strip(longestLine(found.titleSlideText));
    if (text) return { title: softenCaps(text), titleSource: "title-slide", foreignNumber: number };
  }

  // 3. The filename. Diacritics are often missing, so an in-deck title beats it —
  //    but it beats guessing from lyrics.
  const fromFile = strip(titleFromFileName(opts.fileName));
  if (fromFile.text) {
    return { title: softenCaps(fromFile.text), titleSource: "filename", foreignNumber: null };
  }

  // 4. First line of the first included slide.
  if (found.firstIncluded) {
    const line = found.firstIncluded.split("\n")[0]?.trim() ?? "";
    if (line) return { title: softenCaps(strip(line).text), titleSource: "first-line", foreignNumber: null };
  }

  // 5. docProps <dc:title>, last: in real decks it is often a leftover from the
  //    file this one was copied from, or a dump of slide 1.
  const doc = deck.docTitle?.trim();
  if (doc && !GENERIC_TITLE.test(doc)) {
    return { title: softenCaps(strip(doc).text), titleSource: "doc-title", foreignNumber: null };
  }

  return { title: "", titleSource: "filename", foreignNumber: null };
}

/**
 * Freeze a draft into a Hymn, or null when there is nothing to save.
 * Callers must still validate main-side — a commit can arrive from a web client.
 */
export function draftToHymn(draft: HymnImportDraft): Hymn | null {
  if (draft.blocks.length === 0 || draft.sequence.length === 0) return null;
  if (!draft.title.trim() || !draft.number.trim()) return null;
  return {
    number: draft.number.trim(),
    title: draft.title.trim(),
    blocks: draft.blocks.map((block) => ({ ...block })),
    sequence: [...draft.sequence],
  };
}

// ── commit ───────────────────────────────────────────────────────────────────

const BLOCK_KINDS = new Set<string>(["verse", "chorus", "bridge"]);

/** Caps, so a malformed or hostile payload cannot be written to the user's book. */
const MAX_BLOCKS = 200;
const MAX_SEQUENCE = 400;
const MAX_TITLE = 200;
const MAX_NUMBER = 16;

/**
 * Validate and clean a Hymn arriving from a client — null when it is not one.
 *
 * The commit payload is a plain `Hymn` assembled in the renderer, and on the web
 * path it comes from a browser we do not control, so every invariant
 * scripts/verify-hymnals.js enforces on the books we ship is re-checked here
 * rather than trusted.
 *
 * It also *rebuilds* the object from known fields instead of spreading the
 * input: `audioAvailability` and `hasSyncedLyrics` are ours to annotate (they
 * key karaoke assets by bare hymn number, which only one book may use), and
 * `source` provenance is stamped by the main process — neither is a client's to
 * claim.
 */
export function sanitizeImportedHymn(raw: unknown): Hymn | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;

  const number = typeof input.number === "string" ? input.number.trim() : "";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!number || number.length > MAX_NUMBER) return null;
  if (!title || title.length > MAX_TITLE) return null;

  const rawBlocks = input.blocks;
  const rawSequence = input.sequence;
  if (!Array.isArray(rawBlocks) || !Array.isArray(rawSequence)) return null;
  if (rawBlocks.length === 0 || rawBlocks.length > MAX_BLOCKS) return null;
  if (rawSequence.length === 0 || rawSequence.length > MAX_SEQUENCE) return null;

  const blocks: HymnBlock[] = [];
  for (const entry of rawBlocks as unknown[]) {
    if (!entry || typeof entry !== "object") return null;
    const block = entry as Record<string, unknown>;
    if (typeof block.kind !== "string" || !BLOCK_KINDS.has(block.kind)) return null;
    if (typeof block.text !== "string") return null;
    // Canonicalise rather than reject: this is the same pass buildDraft already
    // ran, so it is a no-op for an honest client, and it repairs the cedillas
    // and stray \r that verify-hymnals treats as hard failures for any other.
    const text = canonicalizeHymnText(block.text);
    if (!text) return null;
    blocks.push({ kind: block.kind as HymnBlockKind, text });
  }

  const sequence: number[] = [];
  for (const index of rawSequence as unknown[]) {
    if (!Number.isInteger(index)) return null;
    const at = index as number;
    if (at < 0 || at >= blocks.length) return null;
    sequence.push(at);
  }

  // Every block must be reachable. Indices are already known to be in range and
  // integral, so the set covers 0..n-1 exactly when its size matches.
  if (new Set(sequence).size !== blocks.length) return null;

  return { number, title: canonicalizeHymnText(title), blocks, sequence };
}
