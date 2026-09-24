import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { buildScreenGroups, getActiveScreen, parseTTML, type TTMLLine } from "./ttmlParser";

function ttml(body: string, dur?: string): string {
  const durAttr = dur ? ` dur="${dur}"` : "";
  return `<tt xmlns="http://www.w3.org/ns/ttml"><body${durAttr}><div>${body}</div></body></tt>`;
}

function span(begin: string, end: string, text: string): string {
  return `<span begin="${begin}" end="${end}">${text}</span>`;
}

describe("parseTTML", () => {
  it("parses lines of timed words", () => {
    const parsed = parseTTML(
      ttml(
        `<p begin="0:01.000" end="0:02.500">${span("0:01.000", "0:01.400", "Spre")} ${span("0:01.500", "0:02.500", "slava")}</p>` +
          `<p begin="0:03.000" end="0:04.000">${span("0:03.000", "0:04.000", "Ta")}</p>`,
        "3:27.023"
      )
    );

    expect(parsed.duration).toBeCloseTo(207.023);
    expect(parsed.lines).toEqual([
      {
        words: [
          { text: "Spre", begin: 1, end: 1.4 },
          { text: "slava", begin: 1.5, end: 2.5 },
        ],
        begin: 1,
        end: 2.5,
      },
      { words: [{ text: "Ta", begin: 3, end: 4 }], begin: 3, end: 4 },
    ]);
  });

  it.each([
    ["0:13.178", 13.178],
    ["1:05", 65],
    ["12:00.5", 720.5],
    ["123:01.000", 7381],
  ])("reads the time %s as %d seconds", (time, seconds) => {
    const parsed = parseTTML(ttml(`<p>${span(time, time, "w")}</p>`));
    expect(parsed.lines[0].words[0].begin).toBeCloseTo(seconds);
  });

  it("takes line bounds from the words, not the <p> attributes", () => {
    const parsed = parseTTML(
      ttml(`<p begin="0:00.000" end="0:59.000">${span("0:05.000", "0:06.000", "a")}${span("0:06.000", "0:07.000", "b")}</p>`)
    );
    expect(parsed.lines[0]).toMatchObject({ begin: 5, end: 7 });
  });

  it("falls back to the last line's end when the body has no dur", () => {
    const parsed = parseTTML(
      ttml(`<p>${span("0:01.000", "0:02.000", "a")}</p><p>${span("0:03.000", "0:09.250", "b")}</p>`)
    );
    expect(parsed.duration).toBe(9.25);
  });

  it("trims word text and keeps multi-line span content", () => {
    const parsed = parseTTML(ttml(`<p>${span("0:01.000", "0:02.000", "\n   Doamne,  \n")}</p>`));
    expect(parsed.lines[0].words[0].text).toBe("Doamne,");
  });

  it("drops whitespace-only words and lines with no words", () => {
    const parsed = parseTTML(
      ttml(
        `<p>${span("0:01.000", "0:02.000", "   ")}</p>` +
          `<p></p>` +
          `<p>${span("0:03.000", "0:04.000", " ")}${span("0:04.000", "0:05.000", "real")}</p>`
      )
    );
    expect(parsed.lines).toHaveLength(1);
    expect(parsed.lines[0].words.map((w) => w.text)).toEqual(["real"]);
    expect(parsed.lines[0].begin).toBe(4);
  });

  it("ignores spans without timing and extra attributes around the times", () => {
    const parsed = parseTTML(
      ttml(
        `<p><span>untimed</span>` +
          `<span ttm:agent="v1" begin="0:01.000" xml:id="w2" end="0:02.000" role="x">timed</span></p>`
      )
    );
    expect(parsed.lines[0].words).toEqual([{ text: "timed", begin: 1, end: 2 }]);
  });

  it.each([
    ["an empty string", ""],
    ["plain text", "not xml at all"],
    ["an unclosed paragraph", `<tt><body><p>${span("0:01.000", "0:02.000", "a")}</body></tt>`],
    ["a document with no body", "<tt></tt>"],
  ])("returns no lines and zero duration for %s", (_label, xml) => {
    expect(parseTTML(xml)).toEqual({ lines: [], duration: 0 });
  });
});

describe("parseTTML on a bundled hymn", () => {
  const file = path.resolve(__dirname, "../../assets/hymns/003.ttml");
  const parsed = parseTTML(fs.readFileSync(file, "utf-8"));

  it("produces non-empty lines", () => {
    expect(parsed.lines.length).toBeGreaterThan(0);
    for (const line of parsed.lines) {
      expect(line.words.length).toBeGreaterThan(0);
      for (const word of line.words) expect(word.text.trim()).not.toBe("");
    }
  });

  it("has word and line times that never run backwards", () => {
    const words = parsed.lines.flatMap((line) => line.words);
    for (const word of words) expect(word.end).toBeGreaterThanOrEqual(word.begin);
    for (let i = 1; i < words.length; i++) {
      expect(words[i].begin).toBeGreaterThanOrEqual(words[i - 1].begin);
    }
    for (const line of parsed.lines) {
      expect(line.begin).toBe(line.words[0].begin);
      expect(line.end).toBe(line.words[line.words.length - 1].end);
    }
  });

  it("fits every word inside the declared duration", () => {
    const last = parsed.lines[parsed.lines.length - 1];
    expect(parsed.duration).toBeGreaterThanOrEqual(last.end);
  });
});

describe("buildScreenGroups", () => {
  it("maps each slide's line count onto consecutive TTML lines", () => {
    expect(buildScreenGroups(["a\nb", "c\nd\ne", "f"], 6)).toEqual([[0, 1], [2, 3, 4], [5]]);
  });

  it("stops at the last TTML line when the slides have more lines", () => {
    expect(buildScreenGroups(["a\nb", "c\nd", "e\nf"], 3)).toEqual([[0, 1], [2]]);
  });

  it("leaves trailing TTML lines ungrouped when the slides have fewer", () => {
    expect(buildScreenGroups(["a", "b"], 5)).toEqual([[0], [1]]);
  });

  it("returns no groups when there are no slides or no lines", () => {
    expect(buildScreenGroups([], 4)).toEqual([]);
    expect(buildScreenGroups(["a\nb"], 0)).toEqual([]);
  });

  it("counts an empty slide as one line", () => {
    expect(buildScreenGroups(["", "a"], 2)).toEqual([[0], [1]]);
  });
});

describe("getActiveScreen", () => {
  function line(...times: [number, number][]): TTMLLine {
    const words = times.map(([begin, end], i) => ({ text: `w${i}`, begin, end }));
    return { words, begin: words[0].begin, end: words[words.length - 1].end };
  }

  // Screen 0 ends at 4s, screen 1 at 9s, with a gap before screen 2 starts at 12s.
  const lines = [
    line([1, 2]),
    line([2, 3], [3, 4]),
    line([5, 7]),
    line([7, 9]),
    line([12, 14]),
  ];
  const groups = [[0, 1], [2, 3], [4]];

  it.each([
    ["before the first word", 0, 0],
    ["on the first word", 1, 0],
    ["just before screen 0's last word ends", 3.999, 0],
    ["exactly when screen 0's last word ends", 4, 1],
    ["in the middle of screen 1", 6, 1],
    ["exactly when screen 1's last word ends", 9, 2],
    ["in the gap before screen 2's first word", 10, 2],
    ["on the last screen", 13, 2],
    ["after the last word", 60, 2],
  ])("%s (t=%d) is screen %d", (_label, time, screen) => {
    expect(getActiveScreen(groups, lines, time)).toBe(screen);
  });

  it("stays on the only screen", () => {
    expect(getActiveScreen([[0]], [line([1, 2])], 100)).toBe(0);
  });

  it("returns 0 when there are no groups", () => {
    expect(getActiveScreen([], [], 5)).toBe(0);
  });

  it("works with groups from buildScreenGroups", () => {
    const built = buildScreenGroups(["a\nb", "c\nd", "e"], lines.length);
    expect(built).toEqual(groups);
    expect(getActiveScreen(built, lines, 8)).toBe(1);
  });
});
