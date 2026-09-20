import { unzipSync, strFromU8 } from "fflate";
import type {
  ParsedDeck,
  ParsedSlide,
  PptxParseReason,
} from "../src/shared/types";

/**
 * Text extraction from PowerPoint .pptx decks, for hymn import.
 *
 * A .pptx is a ZIP of XML, so this needs no LibreOffice, no bundled binary and no
 * native module. Only the text is taken — layout, fonts, colours and images are
 * deliberately discarded, since an imported hymn renders through the normal hymn
 * pipeline.
 *
 * Regex-on-XML rather than a DOM parser, matching how bibleParsers.ts already
 * handles USFX/OSIS: slide XML is machine-generated and well-formed.
 *
 * No Electron imports, so this stays trivially testable from a plain node script.
 */

export class PptxParseError extends Error {
  constructor(readonly reason: PptxParseReason) {
    super(`pptx parse failed: ${reason}`);
    this.name = "PptxParseError";
  }
}

/** Refuse absurd input rather than stalling the main process on it. */
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_SLIDES = 200;

/** OLE compound-file magic — a legacy binary .ppt wearing any extension. */
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];

/**
 * Line breaks inside a paragraph, in BOTH spellings PowerPoint emits.
 *
 * This is not a detail. Across a 93-deck real-world collection there were zero
 * self-closing <a:br/> and 386 paired <a:br><a:rPr .../></a:br>. A pattern that
 * matches only the self-closing form drops every line break in every deck, and
 * does it silently — the text still extracts, just welded into run-on prose.
 * Line breaks are load-bearing here: pushSlides() counts lines to split stanzas
 * and buildScreenGroups() maps line counts onto TTML indices.
 */
const RUN_OR_BREAK = /<a:t>([\s\S]*?)<\/a:t>|<a:br(?:\s[^>]*)?\/?>/g;

const TXBODY = /<p:txBody>([\s\S]*?)<\/p:txBody>/g;
const PARAGRAPH = /<a:p>([\s\S]*?)<\/a:p>/g;

/** Decode XML entities. `&amp;` must come last, or `&amp;lt;` becomes `<`. */
function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(parseInt(dec, 10))
    )
    .replace(/&amp;/g, "&");
}

/** Collapse horizontal whitespace per line, but never across line breaks. */
function tidy(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .trim();
}

/** Normalize a relationship target to a full zip entry path. */
function resolveTarget(target: string): string {
  const clean = target.replace(/^\.\.\//, "").replace(/^\//, "");
  return clean.startsWith("ppt/") ? clean : `ppt/${clean}`;
}

/**
 * Presentation order, which is NOT slideN.xml order — PowerPoint reorders slides
 * without renaming their parts, so slide3.xml can be the first slide shown.
 * Resolved via <p:sldIdLst> in presentation.xml joined to its .rels.
 */
function resolveSlideOrder(files: Record<string, Uint8Array>): string[] {
  const presentation = files["ppt/presentation.xml"];
  const rels = files["ppt/_rels/presentation.xml.rels"];

  if (presentation && rels) {
    const targets = new Map<string, string>();
    const relsXml = strFromU8(rels);
    for (const match of relsXml.matchAll(
      /<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*>/g
    )) {
      targets.set(match[1], resolveTarget(match[2]));
    }
    // Target may precede Id on the same element; catch that spelling too.
    for (const match of relsXml.matchAll(
      /<Relationship\b[^>]*\bTarget="([^"]+)"[^>]*\bId="([^"]+)"[^>]*>/g
    )) {
      if (!targets.has(match[2])) targets.set(match[2], resolveTarget(match[1]));
    }

    const ordered: string[] = [];
    for (const match of strFromU8(presentation).matchAll(
      /<p:sldId\b[^>]*\br:id="([^"]+)"[^>]*\/?>/g
    )) {
      const target = targets.get(match[1]);
      if (target && files[target]) ordered.push(target);
    }
    if (ordered.length > 0) return ordered;
  }

  // Fallback only when sldIdLst is missing or resolved to nothing.
  return Object.keys(files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort(
      (a, b) =>
        Number(/(\d+)\.xml$/.exec(a)?.[1] ?? 0) -
        Number(/(\d+)\.xml$/.exec(b)?.[1] ?? 0)
    );
}

/** One entry per non-empty text shape, in document order. */
function extractShapes(slideXml: string): string[] {
  const shapes: string[] = [];

  for (const body of slideXml.matchAll(TXBODY)) {
    const paragraphs: string[] = [];

    for (const paragraph of body[1].matchAll(PARAGRAPH)) {
      let text = "";
      for (const token of paragraph[1].matchAll(RUN_OR_BREAK)) {
        text += token[1] !== undefined ? decodeEntities(token[1]) : "\n";
      }
      paragraphs.push(text);
    }

    const shape = tidy(paragraphs.join("\n"));
    if (shape) shapes.push(shape);
  }

  return shapes;
}

function extractDocTitle(files: Record<string, Uint8Array>): string | undefined {
  const core = files["docProps/core.xml"];
  if (!core) return undefined;
  const match = /<dc:title>([\s\S]*?)<\/dc:title>/.exec(strFromU8(core));
  const title = match ? tidy(decodeEntities(match[1])) : "";
  return title || undefined;
}

/**
 * Extract per-slide text from a .pptx.
 *
 * @throws {PptxParseError} with a translatable reason code — never a prebuilt
 * English string, since the reason crosses IPC/Socket.io to the renderer.
 */
export function parsePptx(buf: Buffer | Uint8Array): ParsedDeck {
  if (buf.length > MAX_BYTES) throw new PptxParseError("too-large");

  if (OLE_MAGIC.every((byte, i) => buf[i] === byte)) {
    // A legacy binary .ppt. Out of scope by design: tell the user to re-save it
    // rather than failing with a generic "not a zip".
    throw new PptxParseError("legacy-ppt");
  }

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(buf instanceof Uint8Array ? buf : new Uint8Array(buf));
  } catch {
    throw new PptxParseError("not-a-pptx");
  }

  if (!files["ppt/presentation.xml"]) throw new PptxParseError("not-a-pptx");

  // Speaker notes live in ppt/notesSlides/** and are never lyrics, so slide
  // resolution below only ever reaches ppt/slides/**.
  const order = resolveSlideOrder(files).slice(0, MAX_SLIDES);

  const slides: ParsedSlide[] = order.map((name) => ({
    shapes: extractShapes(strFromU8(files[name])),
  }));

  // A deck whose slides are all empty is an image-only deck — the lyrics are
  // pixels, and no amount of retrying will find text. Say so distinctly.
  if (!slides.some((slide) => slide.shapes.length > 0)) {
    throw new PptxParseError("no-text-found");
  }

  return { slides, docTitle: extractDocTitle(files) };
}
