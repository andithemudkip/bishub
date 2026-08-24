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

// Parse TTML time format "M:SS.mmm" or "MM:SS.mmm" to seconds
function parseTime(time: string): number {
  const match = time.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (!match) return 0;
  return parseInt(match[1]) * 60 + parseFloat(match[2]);
}

export function parseTTML(xml: string): ParsedTTML {
  const lines: TTMLLine[] = [];

  // Parse total duration from <body dur="M:SS.mmm">
  let duration = 0;
  const durMatch = xml.match(/<body[^>]*\bdur="([^"]+)"/);
  if (durMatch) {
    duration = parseTime(durMatch[1]);
  }

  // Extract all <p> elements (lines)
  const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/g;
  let pMatch;

  while ((pMatch = pRegex.exec(xml)) !== null) {
    const pContent = pMatch[0];
    const words: TTMLWord[] = [];

    // Extract <span> elements (words) within this <p>
    const spanRegex = /<span\b[^>]*\bbegin="([^"]+)"[^>]*\bend="([^"]+)"[^>]*>([\s\S]*?)<\/span>/g;
    let spanMatch;

    while ((spanMatch = spanRegex.exec(pContent)) !== null) {
      const begin = parseTime(spanMatch[1]);
      const end = parseTime(spanMatch[2]);
      const text = spanMatch[3].trim();
      if (text) {
        words.push({ text, begin, end });
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
/**
 * Shift word times by the operator's live corrections.
 *
 * Applied per word rather than to the playhead, because a correction can start
 * anywhere: keyframes accumulate from their `fromWord` onwards, so a hymn that
 * drifts halfway through a line can be fixed at exactly that word. Line bounds
 * are recomputed from the shifted words, since a keyframe inside a line moves
 * its end but not its beginning.
 */
export function applyLyricsTuning(
  lines: TTMLLine[],
  tuning?: { offset: number; breakpoints: { fromWord: number; delta: number }[] }
): TTMLLine[] {
  if (!tuning) return lines;
  const { offset, breakpoints } = tuning;
  if (!offset && breakpoints.length === 0) return lines;

  // Cumulative shift for each word, in performance order.
  const ordered = [...breakpoints].sort((a, b) => a.fromWord - b.fromWord);
  const total = lines.reduce((n, line) => n + line.words.length, 0);
  const deltas = new Array<number>(total);
  let cursor = 0;
  let running = offset;
  for (let i = 0; i < total; i++) {
    while (cursor < ordered.length && ordered[cursor].fromWord <= i) {
      running += ordered[cursor].delta;
      cursor++;
    }
    deltas[i] = running;
  }

  // A word's *end* moves with the word that follows it, not with itself. What
  // the display animates is begin→end, and in generated timings one word's end
  // is the next word's begin — so shifting a word's own end would leave the
  // previous word still running past the moment the next one starts, or open a
  // gap. Dragging the boundary keeps them adjoining, which is what makes
  // "this word runs on too long" fixable by moving the next word earlier.
  let index = 0;
  return lines.map((line) => {
    const words = line.words.map((word) => {
      const beginDelta = deltas[index];
      const endDelta = index + 1 < total ? deltas[index + 1] : beginDelta;
      index++;
      if (!beginDelta && !endDelta) return word;
      const begin = word.begin + beginDelta;
      return {
        text: word.text,
        begin,
        // Never let a boundary invert: a keyframe can pull the next word back
        // past this one's start, which would otherwise give a negative span and
        // a nonsensical progress fraction.
        end: Math.max(word.end + endDelta, begin),
      };
    });
    return {
      words,
      begin: words.length ? words[0].begin : line.begin,
      end: words.length ? words[words.length - 1].end : line.end,
    };
  });
}

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
