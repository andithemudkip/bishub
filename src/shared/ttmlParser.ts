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
