// TTML (Timed Text Markup Language) parser for word-synced karaoke lyrics
// Parses TTML XML into a flat list of timed lines and words

export interface TTMLWord {
  text: string;
  begin: number; // seconds
  end: number; // seconds
}

export interface TTMLLine {
  words: TTMLWord[];
  begin: number; // first word's begin
  end: number; // last word's end
}

export interface ParsedTTML {
  lines: TTMLLine[];
  duration: number; // total duration in seconds
}

const OFFSET_UNITS: Record<string, number> = { h: 3600, m: 60, s: 1, ms: 0.001 };

// Parse a TTML time expression to seconds: clock time ("M:SS.mmm",
// "H:MM:SS.mmm") or offset time ("13.5s", "500ms", "2m", "1h"). Frame and
// tick units need the document's frame/tick rate, which we don't read, so
// they (like anything else unparseable) come out as 0.
function parseTime(time: string): number {
  const trimmed = time.trim();
  const clock = trimmed.match(/^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/);
  if (clock) {
    const [, hours = "0", minutes, seconds] = clock;
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
  }
  const offset = trimmed.match(/^(\d+(?:\.\d+)?)(h|ms|m|s)$/);
  if (offset) return parseFloat(offset[1]) * OFFSET_UNITS[offset[2]];
  return 0;
}

// Attribute value by exact name, in either quote style. The leading
// whitespace keeps "begin" from matching a namespaced "ttm:begin".
function getAttribute(attributes: string, name: string): string | null {
  const match = attributes.match(new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`));
  return match ? match[2] : null;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

// One pass, so "&amp;lt;" correctly becomes "&lt;" rather than "<".
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }
    return NAMED_ENTITIES[body] ?? entity;
  });
}

export function parseTTML(xml: string): ParsedTTML {
  const lines: TTMLLine[] = [];

  // Parse total duration from <body dur="M:SS.mmm">
  let duration = 0;
  const bodyMatch = xml.match(/<body\b([^>]*)>/);
  const dur = bodyMatch && getAttribute(bodyMatch[1], "dur");
  if (dur) {
    duration = parseTime(dur);
  }

  // Extract all <p> elements (lines)
  const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/g;
  let pMatch;

  while ((pMatch = pRegex.exec(xml)) !== null) {
    const pContent = pMatch[0];
    const words: TTMLWord[] = [];

    // Extract innermost <span> elements (words) within this <p>. Content
    // may not contain another <span, so a wrapper span (e.g. background
    // vocals) is skipped and its timed children are matched on their own.
    const spanRegex = /<span\b([^>]*)>((?:(?!<span\b)[\s\S])*?)<\/span>/g;
    let spanMatch;

    while ((spanMatch = spanRegex.exec(pContent)) !== null) {
      const beginAttr = getAttribute(spanMatch[1], "begin");
      const endAttr = getAttribute(spanMatch[1], "end");
      if (beginAttr === null || endAttr === null) continue;
      const text = decodeEntities(spanMatch[2].trim());
      if (text) {
        words.push({ text, begin: parseTime(beginAttr), end: parseTime(endAttr) });
      }
    }

    if (words.length > 0) {
      lines.push({
        words,
        begin: words[0].begin,
        end: words[words.length - 1].end,
      });
    }
  }

  // If no duration from body, use the last line's end time
  if (duration === 0 && lines.length > 0) {
    duration = lines[lines.length - 1].end;
  }

  return { lines, duration };
}

// Determine which screen is active based on currentTime.
// Advances to next screen when the last word on the current screen ends.
export function getActiveScreen(
  groups: number[][],
  lines: TTMLLine[],
  currentTime: number
): number {
  for (let i = groups.length - 2; i >= 0; i--) {
    const lastLineIdx = groups[i][groups[i].length - 1];
    const lastLine = lines[lastLineIdx];
    const lastWord = lastLine.words[lastLine.words.length - 1];
    if (currentTime >= lastWord.end) {
      return i + 1;
    }
  }
  if (groups.length > 0 && currentTime >= lines[groups[0][0]].begin) {
    return 0;
  }
  return 0;
}

// Build screen groups by mapping each slide's line count to TTML line indices
export function buildScreenGroups(slides: string[], totalLines: number): number[][] {
  const groups: number[][] = [];
  let lineIndex = 0;
  for (const slide of slides) {
    const lineCount = slide.split("\n").length;
    const group: number[] = [];
    for (let j = lineIndex; j < Math.min(lineIndex + lineCount, totalLines); j++) {
      group.push(j);
    }
    if (group.length > 0) groups.push(group);
    lineIndex += lineCount;
  }
  return groups;
}
