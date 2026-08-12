/**
 * Shared helpers for the phase-2 hymnal build (scripts/build-hymnals.js).
 *
 * The interesting problem: MyBible's Romanian hymn text is flattened to running
 * prose with no line breaks, but line breaks are load-bearing in BisHub —
 * pushSlides() counts lines to decide stanza splits, and buildScreenGroups()
 * maps slide line counts onto TTML indices for karaoke. For imnuri-crestine we
 * already have correct line breaks, so we transplant MyBible's *wording* onto
 * our line structure rather than taking their text wholesale.
 */

// --- canonicalisation ---

/**
 * Legacy cedilla forms (U+015F/U+0163, really Turkish letters) → the correct
 * Romanian comma-below forms. Both decompose under NFD into the U+0300-U+036F
 * range, so removeDiacritics() in shared/utils.ts already treats them alike and
 * search is unaffected either way.
 */
const ROMANIAN_LETTERS = [
  ["ş", "ș"], // ş → ș
  ["Ş", "Ș"], // Ş → Ș
  ["ţ", "ț"], // ţ → ț
  ["Ţ", "Ț"], // Ţ → Ț
];

export function canonicalize(text, { romanian = false } = {}) {
  let out = text.normalize("NFC").replace(/\r\n?/g, "\n");
  if (romanian) {
    for (const [from, to] of ROMANIAN_LETTERS) out = out.split(from).join(to);
  }
  // Repeat markers: MyBible writes /:like this:/ with the marker glued to the
  // adjacent word, we write (: like this :) as standalone tokens. Normalising
  // to our form here keeps the two sides tokenising the same way, without
  // which the aligner drops our markers on the floor.
  out = out.replace(/\/:\s*/g, "(: ").replace(/\s*:\//g, " :)");
  // Collapse runs of spaces/tabs but preserve newlines.
  return out
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .trim();
}

/** BisHub house typography, applied to tokens adopted from MyBible. */
export function applyHouseTypography(token) {
  return token
    .replace(/\/:/g, "(:")
    .replace(/:\//g, ":)")
    .replace(/^"/, "„") // leading  " → „
    .replace(/"$/, "”") // trailing " → ”
    .replace(/'/g, "’");
}

/** Comparison key: casing, punctuation and diacritics all ignored. */
export function wordKey(word) {
  const stripped = word
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  const alnum = stripped.replace(/[^\p{L}\p{N}]/gu, "");
  // Punctuation-only tokens (repeat markers, dashes) would otherwise all key to
  // "" and match each other indiscriminately; key them on their own glyphs.
  return alnum || stripped;
}

// --- word alignment ---

/**
 * Indices of a longest common subsequence between two token arrays, as
 * [aIndex, bIndex] pairs. Stanzas are tens of tokens, so the O(n*m) table is
 * cheap and worth the clarity over a Myers diff.
 */
export function lcsPairs(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const pairs = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

/**
 * Reflow `theirText` onto the line structure of `ourStanza`.
 *
 * Tokens that survive the alignment unchanged (ignoring case/punctuation) are
 * taken from OUR side, which preserves our typography — „ ” over ASCII quotes,
 * (: :) over /: :/, and the capitalised line-initial words MyBible lowercased.
 * Only genuinely different words are adopted from theirs.
 *
 * Returns { text, adopted } or null when the result doesn't fill every line,
 * which means the alignment is untrustworthy and the caller should keep ours.
 */
export function reflowOntoLines(ourStanza, theirText) {
  const ourLines = ourStanza.split("\n");
  // Stanzas may contain deliberate blank lines (a chorus split into two halves,
  // for instance). They carry no tokens, so they're held out of the alignment
  // and re-emitted as-is rather than counting as a collapsed line.
  const isBlank = ourLines.map((line) => line.trim() === "");
  const ourTokens = [];
  const lineOf = [];
  ourLines.forEach((line, index) => {
    for (const word of line.split(/\s+/).filter(Boolean)) {
      ourTokens.push(word);
      lineOf.push(index);
    }
  });

  const theirTokens = theirText.split(/\s+/).filter(Boolean);
  const pairs = lcsPairs(ourTokens.map(wordKey), theirTokens.map(wordKey));

  const assigned = new Array(theirTokens.length).fill(-1);
  const source = new Array(theirTokens.length).fill(null);
  for (const [ourIndex, theirIndex] of pairs) {
    assigned[theirIndex] = lineOf[ourIndex];
    source[theirIndex] = ourTokens[ourIndex];
  }

  // Unmatched runs are placed by looking at the corresponding gap on OUR side
  // rather than by carrying the previous line forward. It matters when a token
  // count differs across a line break: "Doamne-ascultă" is one word for us and
  // two for MyBible, and forward-filling pulled both onto the preceding line,
  // silently moving the break even though the line count stayed right.
  let prevOur = -1;
  let prevTheir = -1;
  for (let p = 0; p <= pairs.length; p++) {
    const [nextOur, nextTheir] =
      p < pairs.length ? pairs[p] : [ourTokens.length, theirTokens.length];
    if (nextTheir > prevTheir + 1) {
      let line;
      if (nextOur > prevOur + 1) {
        line = lineOf[prevOur + 1]; // our own words fill this gap — follow them
      } else if (prevOur >= 0) {
        line = lineOf[prevOur]; // pure insertion; attach to the preceding line
      } else {
        line = nextOur < ourTokens.length ? lineOf[nextOur] : 0;
      }
      for (let t = prevTheir + 1; t < nextTheir; t++) assigned[t] = line;
    }
    prevOur = nextOur;
    prevTheir = nextTheir;
  }

  const adopted = [];
  const buckets = ourLines.map(() => []);
  theirTokens.forEach((token, k) => {
    if (source[k] !== null) {
      buckets[assigned[k]].push(source[k]);
    } else {
      const replacement = applyHouseTypography(token);
      buckets[assigned[k]].push(replacement);
      adopted.push(replacement);
    }
  });

  // Every one of our lines must still receive words; a gap means the alignment
  // collapsed and the stanza needs a human. Checked before the marker re-insert
  // below, so a line left holding nothing but "(:" still counts as a failure.
  if (buckets.some((bucket, index) => !isBlank[index] && bucket.length === 0)) {
    return null;
  }

  // Words of ours that MyBible doesn't have. The output is built from their
  // token stream, so these are dropped — which is sometimes right and sometimes
  // a silent regression, so the caller reports them either way.
  const matched = new Set(pairs.map(([ourIndex]) => ourIndex));

  // ...except purely typographic tokens. MyBible frequently omits our repeat
  // markers, and dropping "(:" / ":)" silently changes what the congregation
  // sings. Re-insert them at the edge of their original line.
  const firstMatchedOnLine = new Map();
  ourTokens.forEach((_, index) => {
    if (!matched.has(index)) return;
    const line = lineOf[index];
    if (!firstMatchedOnLine.has(line)) firstMatchedOnLine.set(line, index);
  });

  const dropped = [];
  ourTokens.forEach((token, index) => {
    if (matched.has(index)) return;
    if (/[\p{L}\p{N}]/u.test(token)) {
      dropped.push(token);
      return;
    }
    const line = lineOf[index];
    const first = firstMatchedOnLine.get(line);
    if (first === undefined || index < first) buckets[line].unshift(token);
    else buckets[line].push(token);
  });

  return {
    text: buckets
      .map((bucket, index) => (isBlank[index] ? "" : bucket.join(" ")))
      .join("\n"),
    adopted,
    dropped,
  };
}

// --- heuristic line splitting (books with no line breaks and no ground truth) ---

const OPENERS = new Set(['"', "„", "(", "/", "–", "—"]);

/**
 * Best-effort poetic line recovery: break after sentence-ish punctuation when
 * the next token starts a new line visually (capital or an opening mark).
 *
 * Measured against imnuri-crestine, where we have real line breaks to score
 * on, this gets the exact line count 27% of the time and lands within one line
 * 35% of the time — so output from this path is a starting point for review,
 * never something to ship unread. isSuspect() flags the worst of it.
 */
export function splitIntoLines(text) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = [];
  tokens.forEach((token, index) => {
    current.push(token);
    if (index === tokens.length - 1) return;
    if (!/[,;:!?.…]["”’')]?$/.test(token)) return;
    const next = tokens[index + 1];
    if (next[0]?.toUpperCase() === next[0] || OPENERS.has(next[0])) {
      lines.push(current.join(" "));
      current = [];
    }
  });
  if (current.length) lines.push(current.join(" "));
  return lines;
}

/** Heuristic output that looks wrong: over-long lines, or no split at all. */
export function isSuspect(lines) {
  if (lines.length < 2) return true;
  return lines.some((line) => line.split(/\s+/).length > 10);
}

// --- MyBible → BisHub schema ---

/**
 * Convert MyBible's stanza array to blocks + sequence, deduplicating repeated
 * text so a chorus is stored once however often it recurs.
 */
export function toBlocksAndSequence(stanzas, transform = (text) => text) {
  const blocks = [];
  const sequence = [];
  const seen = new Map();
  for (const stanza of stanzas) {
    const kind = stanza.is_chorus ? "chorus" : "verse";
    const text = transform(stanza.text, kind);
    if (!text) continue;
    const key = `${kind} ${text}`;
    let index = seen.get(key);
    if (index === undefined) {
      index = blocks.push({ kind, text }) - 1;
      seen.set(key, index);
    }
    sequence.push(index);
  }
  return { blocks, sequence };
}

/** Verse blocks in order, plus the first chorus block, for structure compares. */
export function partition(hymn) {
  const verses = hymn.blocks.filter((block) => block.kind === "verse");
  const chorus = hymn.blocks.find((block) => block.kind === "chorus") ?? null;
  return { verses, chorus };
}
