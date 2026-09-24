import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { deepFreeze } from "../../test/helpers";
import {
  buildDraft,
  canonicalizeHymnText,
  draftToHymn,
  normalizeBlockKey,
  remapTextOverrides,
  sanitizeImportedHymn,
  titleFromSlideText,
  type BuildDraftOptions,
  type HymnImportDraft,
} from "./hymnImport";
import type { Hymn, ParsedDeck } from "./types";

// Realistic four-line stanzas: a two-line slide at the start of a deck is
// (by design) taken for a title slide, which would muddy unrelated cases.
const V1 = "Ce prieten bun e Domnul\nCe prieten minunat\nToate grijile le poartă\nCel ce viața Și-a dat";
const V2 = "Ai necazuri și ispite\nTe apasă-al vieții greu\nNu te-ngrijora, căci Domnul\nTe ajută tot mereu";
const V3 = "Ești cuprins de slăbiciune\nPovara-i tot mai grea\nMergi la Domnul cu credință\nȘi-El te va ușura";
const CHORUS = "Slavă, slavă, aleluia\nSlavă Mielului ceresc\nSlavă, slavă, aleluia\nPe El toți Îl preamăresc";

/** One shape per slide unless a slide is given as an array of shapes. */
function deck(...slides: Array<string | string[]>): ParsedDeck {
  return { slides: slides.map((s) => ({ shapes: Array.isArray(s) ? s : [s] })) };
}

function draft(d: ParsedDeck, opts: Partial<BuildDraftOptions> = {}): HymnImportDraft {
  return buildDraft(d, { fileName: "Ce prieten.pptx", nextNumber: "901", ...opts });
}

const flagCodes = (d: HymnImportDraft) => d.flags.map((f) => f.code);

describe("canonicalizeHymnText", () => {
  it.each([
    ["legacy cedillas to comma-below", "şi Ţara ţine Ştefan", "și Țara ține Ștefan"],
    ["CRLF and lone CR", "a\r\nb\rc", "a\nb\nc"],
    ["decomposed diacritics to NFC", "ă", "ă"],
    ["prime, acute and backtick to ’", "E ′ntre pe ´nălțimi `napoi", "E ’ntre pe ’nălțimi ’napoi"],
    ["/: … :/ repeat markers", "/:Aleluia:/", "(: Aleluia :)"],
    ["[: … :] repeat markers", "[:  Aleluia  :]", "(: Aleluia :)"],
    ["runs of spaces and tabs", "  a \t  b  ", "a b"],
    ["three or more blank lines", "a\n\n\n\nb", "a\n\nb"],
    ["surrounding blank lines", "\n\n a \n\n", "a"],
  ])("normalises %s", (_label, input, expected) => {
    expect(canonicalizeHymnText(input)).toBe(expected);
  });

  it("leaves cedillas alone outside Romanian", () => {
    expect(canonicalizeHymnText("Ça ş", { romanian: false })).toBe("Ça ş");
  });

  it("is idempotent", () => {
    const messy = " /:şi  E ′ntre:/\r\n\r\n\r\n\r\nŢara ";
    const once = canonicalizeHymnText(messy);
    expect(canonicalizeHymnText(once)).toBe(once);
  });
});

describe("normalizeBlockKey", () => {
  it("ignores case, spacing, blank lines and trailing punctuation", () => {
    expect(normalizeBlockKey("Slavă,  Domnului!\n\n  Aleluia…  ")).toBe(
      normalizeBlockKey("slavă, domnului\naleluia")
    );
  });

  it("keeps diacritics distinct, so Romanian words stay apart", () => {
    expect(normalizeBlockKey("tara")).not.toBe(normalizeBlockKey("țara"));
    expect(normalizeBlockKey("si")).not.toBe(normalizeBlockKey("și"));
  });

  it("keeps punctuation inside a line", () => {
    expect(normalizeBlockKey("Da, Doamne")).not.toBe(normalizeBlockKey("Da Doamne"));
  });
});

describe("buildDraft structure", () => {
  it("maps numbered verses and a marked chorus onto blocks and a sequence", () => {
    const d = draft(deck(`1.\n${V1}`, `Ref:\n${CHORUS}`, `2.\n${V2}`, `Ref:\n${CHORUS}`));
    expect(d.blocks).toEqual([
      { kind: "verse", text: V1 },
      { kind: "chorus", text: CHORUS },
      { kind: "verse", text: V2 },
    ]);
    expect(d.sequence).toEqual([0, 1, 2, 1]);
    expect(d.slides.map((s) => s.blockIndices)).toEqual([[0], [1], [2], [1]]);
  });

  it.each([
    ["1.", "verse"],
    ["2)", "verse"],
    ["3:", "verse"],
    ["12", "verse"],
    ["Ref.", "chorus"],
    ["ref:", "chorus"],
    ["Refren", "chorus"],
    ["R:", "chorus"],
    ["R", "chorus"],
    ["Cor.", "chorus"],
  ] as const)("reads the %s marker on its own line as a %s", (marker, kind) => {
    const d = draft(deck(`${marker}\n${V1}`, `${marker}\n${V2}`));
    expect(d.blocks.map((b) => b.kind)).toEqual([kind, kind]);
    expect(d.blocks[0].text).toBe(V1);
  });

  it.each([
    ["1. ", "verse"],
    ["Ref: ", "chorus"],
    ["Cor. ", "chorus"],
    ["R) ", "chorus"],
  ] as const)("strips an inline %s marker", (marker, kind) => {
    const d = draft(deck(`${marker}${V1}`, V2));
    expect(d.blocks[0]).toEqual({ kind, text: V1 });
  });

  it("does not treat a word starting with R as a chorus marker", () => {
    const text = "Rugăciunea mea se-nalță\nCătre Tine, Doamne sfânt\nAscultă-mă, Te rog\nCând mă plec la pământ";
    const d = draft(deck(text, V2));
    expect(d.blocks[0]).toEqual({ kind: "verse", text });
  });

  it("infers a chorus from an unmarked stanza that repeats", () => {
    const d = draft(deck(V1, CHORUS, V2, CHORUS));
    expect(d.blocks.map((b) => b.kind)).toEqual(["verse", "chorus", "verse"]);
    expect(d.sequence).toEqual([0, 1, 2, 1]);
  });

  it("dedupes repeats that differ only by case and trailing punctuation", () => {
    const shouted = CHORUS.toUpperCase().replace(/\n/g, "!\n");
    const d = draft(deck(V1, CHORUS, V2, shouted));
    expect(d.blocks).toHaveLength(3);
    expect(d.sequence).toEqual([0, 1, 2, 1]);
  });

  it("keeps a repeated stanza a verse when every copy is marked as one", () => {
    const d = draft(deck(`1.\n${V1}`, `1.\n${V1}`));
    expect(d.blocks).toEqual([{ kind: "verse", text: V1 }]);
    expect(d.sequence).toEqual([0, 0]);
  });

  it("makes a stanza the chorus when one copy is marked Ref and another is not", () => {
    const d = draft(deck(V1, `Ref:\n${CHORUS}`, V2, CHORUS));
    expect(d.blocks[1].kind).toBe("chorus");
  });

  it("splits a slide carrying a verse and the chorus into two blocks", () => {
    const d = draft(deck(`1.\n${V1}\nRef:\n${CHORUS}`, `2.\n${V2}\nRef:\n${CHORUS}`));
    expect(d.blocks).toEqual([
      { kind: "verse", text: V1 },
      { kind: "chorus", text: CHORUS },
      { kind: "verse", text: V2 },
    ]);
    expect(d.sequence).toEqual([0, 1, 2, 1]);
    expect(d.slides[0].blockIndices).toEqual([0, 1]);
    expect(d.slides[0].markerKinds).toEqual(["verse", "chorus"]);
  });

  it("treats a verse before a mid-slide Ref: as its own stanza", () => {
    const d = draft(deck(`${V1}\nRef:\n${CHORUS}`, V2));
    expect(d.blocks.map((b) => b.text)).toEqual([V1, CHORUS, V2]);
  });

  it("normalises CRLF, cedillas and blank lines inside a slide", () => {
    const d = draft(deck(`1.\r\n${V1.replace(/ș/g, "ş").replace(/\n/g, "\r\n\r\n")}`, V2));
    expect(d.blocks[0].text).toBe(V1);
  });

  it("joins a slide's shapes (after the first) into one stanza", () => {
    const [a, b] = [V1.split("\n").slice(0, 2).join("\n"), V1.split("\n").slice(2).join("\n")];
    const d = draft(deck(V2, [a, b]));
    expect(d.blocks[1].text).toBe(V1);
  });

  it("is pure: the deck is not mutated and a re-run gives the same draft", () => {
    const d = deepFreeze(deck(V1, CHORUS, V2, CHORUS));
    expect(draft(d)).toEqual(draft(d));
  });
});

describe("buildDraft exclusions", () => {
  it("drops an excluded occurrence from the sequence but keeps the slide", () => {
    const d = draft(deck(V1, CHORUS, V2, CHORUS), { excluded: new Set([3]) });
    expect(d.sequence).toEqual([0, 1, 2]);
    expect(d.slides[3]).toMatchObject({ included: false, blockIndices: [] });
    expect(d.blocks[1].kind).toBe("verse"); // no longer repeats
  });

  it("pre-deselects empty slides and flags them", () => {
    const d = draft(deck(V1, "   ", V2));
    expect(d.slides[1]).toMatchObject({ included: false, autoExcluded: "empty", text: "" });
    expect(d.flags).toContainEqual({ code: "empty-slides", detail: "1" });
  });

  it("pre-deselects a title slide, and lets the user bring it back", () => {
    const d = deck("147\nCe prieten avem în Cristos", V1, V2);
    const auto = draft(d);
    expect(auto.slides[0]).toMatchObject({ included: false, autoExcluded: "title-slide" });
    expect(auto.sequence).toEqual([0, 1]);

    const restored = draft(d, { included: new Set([0]) });
    expect(restored.slides[0]).toMatchObject({ included: true, autoExcluded: "title-slide" });
    expect(restored.sequence).toEqual([0, 1, 2]);
  });

  it("does not take a short chorus that repeats for a title slide", () => {
    // Over 40 characters, so it is not mistaken for slide furniture either.
    const chorus = "Aleluia, aleluia, aleluia\nSlavă Domnului în veci";
    const d = draft(deck(chorus, V1, chorus));
    expect(d.slides[0].autoExcluded).toBeUndefined();
    expect(d.blocks[0].kind).toBe("chorus");
  });

  it("does not take a short slide wrapped in repeat markers for a title slide", () => {
    const d = draft(deck("(: Ține-mă în mâna Ta\nDoamne, Tu :)", V1));
    expect(d.slides[0].autoExcluded).toBeUndefined();
  });

  it("excluded wins over included", () => {
    const d = draft(deck(V1, V2), { excluded: new Set([0]), included: new Set([0]) });
    expect(d.slides[0].included).toBe(false);
  });
});

describe("buildDraft slide furniture", () => {
  it("drops a short shape stamped on most slides", () => {
    const d = draft(deck([V1, "Nr. 424"], [CHORUS, "Nr. 424"], [V2, "Nr. 424"]));
    expect(d.blocks.map((b) => b.text)).toEqual([V1, CHORUS, V2]);
    expect(d.flags).toContainEqual({ code: "dropped-furniture", detail: "3" });
  });

  it("drops slide counters even though they differ per slide", () => {
    const d = draft(deck([V1, "1/3"], [V2, "2 / 3"], [V3, "3 of 3"]));
    expect(d.blocks.map((b) => b.text)).toEqual([V1, V2, V3]);
  });

  it("never treats a single slide's shapes as furniture", () => {
    const d = draft(deck([V1, "1/1"]));
    expect(flagCodes(d)).not.toContain("dropped-furniture");
  });
});

describe("buildDraft title and number", () => {
  it("lifts a title shape off slide 1, splitting off a foreign number", () => {
    const d = draft(deck(["147. Ce prieten avem în Cristos", `1.\n${V1}`], V2));
    expect(d.title).toBe("Ce prieten avem în Cristos");
    expect(d.titleSource).toBe("shape");
    expect(d.blocks[0].text).toBe(V1);
    expect(d.flags).toContainEqual({ code: "foreign-number", detail: "147" });
    expect(d.number).toBe("901");
  });

  it("uses the longest line of a title slide", () => {
    const d = draft(deck("147\nCe prieten avem în Cristos", V1, V2));
    expect(d.title).toBe("Ce prieten avem în Cristos");
    expect(d.titleSource).toBe("title-slide");
  });

  it("falls back to the file name, dropping notes and underscores", () => {
    const d = draft(deck(V1, V2), { fileName: "Tine_ma  in mana Ta (poezie nu stiu).PPTX" });
    expect(d.title).toBe("Tine ma in mana Ta");
    expect(d.titleSource).toBe("filename");
  });

  it("takes the number from the file name when the deck has none", () => {
    const d = draft(deck(V1, V2), { fileName: "625. Fara hotar.pptx" });
    expect(d.number).toBe("625");
    expect(d.title).toBe("Fara hotar");
  });

  it("falls back to the first line of the first included slide", () => {
    const d = draft(deck(V1, V2), { fileName: ".pptx" });
    expect(d.title).toBe("Ce prieten bun e Domnul");
    expect(d.titleSource).toBe("first-line");
  });

  it("uses the document title only as a last resort, and never a generic one", () => {
    const empty = deck("");
    expect(draft(empty, { fileName: "" }).title).toBe("");
    expect(draft({ ...empty, docTitle: "Slide 1" }, { fileName: "" }).title).toBe("");
    const d = draft({ ...empty, docTitle: "Cântare nouă" }, { fileName: "" });
    expect(d).toMatchObject({ title: "Cântare nouă", titleSource: "doc-title" });
  });

  it("softens an ALL-CAPS title", () => {
    const d = draft(deck("ASTEPTAM MAREA ZI\n", V1, V2));
    expect(d.title).toBe("Asteptam Marea Zi");
  });

  it("lets user-edited title and number win", () => {
    const d = draft(deck("147\nCe prieten", V1), {
      fileName: "625. Alt imn.pptx",
      title: "Titlul meu",
      number: "12a",
    });
    expect(d).toMatchObject({ title: "Titlul meu", number: "12a" });
  });
});

describe("buildDraft flags", () => {
  it("flags a one-slide deck", () => {
    expect(flagCodes(draft(deck(V1)))).toContain("single-slide");
  });

  it("flags a deck with nothing included", () => {
    expect(flagCodes(draft(deck(V1, V2), { excluded: new Set([0, 1]) }))).toContain(
      "no-included-slides"
    );
  });

  it("flags a deck whose slides are all the same stanza", () => {
    expect(flagCodes(draft(deck(V1, V1, V1)))).toContain("all-slides-identical");
  });

  it("flags a very long deck", () => {
    const slides = Array.from({ length: 61 }, (_, i) => `${V1}\nstrofa ${i}`);
    expect(draft(deck(...slides)).flags).toContainEqual({ code: "many-slides", detail: "61" });
  });

  it("flags near-duplicate stanzas without merging them by default", () => {
    const retyped = CHORUS.replace("Slavă Mielului", "Slava Mielului");
    const d = draft(deck(V1, CHORUS, V2, retyped));
    expect(d.blocks).toHaveLength(4);
    expect(d.flags).toContainEqual({ code: "near-duplicate-blocks", detail: "1+3" });
  });
});

describe("buildDraft with mergeNearDuplicates", () => {
  // Each copy is the better-spelt one on a different line; the repair keeps
  // the variant with the most diacritics, line by line.
  const copyA = "Azi m’am intors acasa\nLa Tatăl meu cel bun";
  const copyB = "Azi m’am întors acasă\nLa Tatal meu cel bun";
  const repaired = "Azi m’am întors acasă\nLa Tatăl meu cel bun";

  it("collapses near-duplicates into one repaired block and remaps indices", () => {
    const d = draft(deck(V1, copyA, V2, copyB, V3), { mergeNearDuplicates: true });
    expect(d.blocks.map((b) => b.text)).toEqual([V1, repaired, V2, V3]);
    expect(d.blockKeys).toEqual(d.blocks.map((b) => normalizeBlockKey(b.text)));
    expect(d.sequence).toEqual([0, 1, 2, 1, 3]);
    expect(d.slides.map((s) => s.blockIndices)).toEqual([[0], [1], [2], [1], [3]]);
    expect(d.blocks[1].kind).toBe("chorus");
    expect(d.flags).toContainEqual({ code: "merged-near-duplicates", detail: "1" });
    expect(flagCodes(d)).not.toContain("near-duplicate-blocks");
  });

  it("keeps the first variant of a line when they tie", () => {
    const d = draft(deck(V1, "Azi m’am intors acasă", V2, "Azi m’am întors acasa"), {
      mergeNearDuplicates: true,
    });
    expect(d.blocks[1].text).toBe("Azi m’am intors acasă");
  });

  it("changes nothing when there are no near-duplicates", () => {
    const opts = { mergeNearDuplicates: true };
    const d = draft(deck(V1, CHORUS, V2, CHORUS), opts);
    expect(d.sequence).toEqual([0, 1, 2, 1]);
    expect(flagCodes(d)).not.toContain("merged-near-duplicates");
  });
});

describe("buildDraft overrides", () => {
  it("applies kind overrides keyed by the block's original text", () => {
    const base = draft(deck(V1, V2));
    const d = draft(deck(V1, V2), { kindOverrides: new Map([[base.blockKeys[1], "bridge"]]) });
    expect(d.blocks.map((b) => b.kind)).toEqual(["verse", "bridge"]);
  });

  it("lets a kind override beat an explicit marker", () => {
    const base = draft(deck(`Ref:\n${CHORUS}`, V1));
    const d = draft(deck(`Ref:\n${CHORUS}`, V1), {
      kindOverrides: new Map([[base.blockKeys[0], "verse"]]),
    });
    expect(d.blocks[0].kind).toBe("verse");
  });

  it("applies a text edit to every occurrence and canonicalises it", () => {
    const base = draft(deck(V1, CHORUS, V2, CHORUS));
    const d = draft(deck(V1, CHORUS, V2, CHORUS), {
      textOverrides: new Map([[base.blockKeys[1], "  Slavă,  şi\r\naleluia "]]),
    });
    expect(d.blocks[1].text).toBe("Slavă, și\naleluia");
    expect(d.sequence).toEqual([0, 1, 2, 1]);
    expect(d.blockKeys).toEqual(base.blockKeys); // keys stay the original text
  });

  it("ignores a text edit that canonicalises to nothing", () => {
    const base = draft(deck(V1, V2));
    const d = draft(deck(V1, V2), { textOverrides: new Map([[base.blockKeys[0], " \n "]]) });
    expect(d.blocks[0].text).toBe(V1);
  });
});

describe("remapTextOverrides", () => {
  const copyA = "Azi m’am intors acasă\nLa Tatăl meu cel bun";
  const copyB = "Azi m’am întors acasa\nLa Tatal meu cel bun";
  const d = deck(V1, copyA, V2, copyB);
  const separate = draft(d);
  const merged = draft(d, { mergeNearDuplicates: true });

  it("returns an empty map when there is nothing to carry", () => {
    expect(remapTextOverrides(separate, merged, new Map()).size).toBe(0);
  });

  it("carries an edit onto the merged block when joining", () => {
    const next = remapTextOverrides(separate, merged, new Map([[separate.blockKeys[3], "edited"]]));
    expect([...next]).toEqual([[merged.blockKeys[1], "edited"]]);
  });

  it("keeps the earliest edit when two edited copies are joined", () => {
    const overrides = new Map([
      [separate.blockKeys[1], "first"],
      [separate.blockKeys[3], "second"],
    ]);
    expect([...remapTextOverrides(separate, merged, overrides)]).toEqual([
      [merged.blockKeys[1], "first"],
    ]);
  });

  it("leaves the edit only on the first slide showing it when separating", () => {
    const next = remapTextOverrides(merged, separate, new Map([[merged.blockKeys[1], "edited"]]));
    expect([...next]).toEqual([[separate.blockKeys[1], "edited"]]);
  });

  it("drops edits for slides that no longer yield a block", () => {
    const excluded = draft(d, { excluded: new Set([1, 3]) });
    const next = remapTextOverrides(separate, excluded, new Map([[separate.blockKeys[1], "x"]]));
    expect(next.size).toBe(0);
  });
});

describe("titleFromSlideText", () => {
  it.each([
    ["147\nCe prieten avem în Cristos", "Ce prieten avem în Cristos"],
    ["625. Fără hotar", "Fără hotar"],
    ["147 - Ce prieten", "Ce prieten"],
    ["ASTEPTAM MAREA ZI", "Asteptam Marea Zi"],
    ["ÎN CER, LA TATĂL", "În Cer, La Tatăl"],
    ["(: Ține-mă :)", "Ține-mă"],
    ["IAD", "IAD"], // too short to judge as shouting
    ["Isus e Domnul", "Isus e Domnul"],
  ])("%j → %j", (input, expected) => {
    expect(titleFromSlideText(input)).toBe(expected);
  });
});

describe("draftToHymn", () => {
  const good = () => draft(deck(V1, CHORUS, V2, CHORUS), { title: " Titlu ", number: " 12 " });

  it("freezes a draft into a trimmed Hymn", () => {
    expect(draftToHymn(good())).toEqual({
      number: "12",
      title: "Titlu",
      blocks: [
        { kind: "verse", text: V1 },
        { kind: "chorus", text: CHORUS },
        { kind: "verse", text: V2 },
      ],
      sequence: [0, 1, 2, 1],
    });
  });

  it("copies rather than shares the draft's arrays", () => {
    const d = good();
    const hymn = draftToHymn(d)!;
    hymn.blocks[0].text = "changed";
    hymn.sequence.push(0);
    expect(d.blocks[0].text).toBe(V1);
    expect(d.sequence).toEqual([0, 1, 2, 1]);
  });

  it.each([
    ["no blocks", { blocks: [] }],
    ["no sequence", { sequence: [] }],
    ["a blank title", { title: "  " }],
    ["a blank number", { number: "" }],
  ])("returns null with %s", (_label, patch) => {
    expect(draftToHymn({ ...good(), ...patch })).toBeNull();
  });
});

describe("sanitizeImportedHymn", () => {
  const valid = (): Record<string, unknown> => ({
    number: "12",
    title: "Titlu",
    blocks: [
      { kind: "verse", text: V1 },
      { kind: "chorus", text: CHORUS },
      { kind: "bridge", text: V2 },
    ],
    sequence: [0, 1, 2, 1],
  });

  it("accepts a valid hymn", () => {
    expect(sanitizeImportedHymn(valid())).toEqual(valid());
  });

  it("canonicalises text and trims number and title", () => {
    const hymn = sanitizeImportedHymn({
      ...valid(),
      number: " 12 ",
      title: " Ţara  mea ",
      blocks: [{ kind: "verse", text: "şi\r\nţie" }],
      sequence: [0],
    });
    expect(hymn).toEqual({
      number: "12",
      title: "Țara mea",
      blocks: [{ kind: "verse", text: "și\nție" }],
      sequence: [0],
    });
  });

  it("rebuilds the object, dropping fields a client may not claim", () => {
    const hymn = sanitizeImportedHymn({
      ...valid(),
      audioAvailability: "cached",
      hasSyncedLyrics: true,
      source: { kind: "bundled" },
      blocks: [{ kind: "verse", text: V1, extra: 1 }],
      sequence: [0],
    });
    expect(Object.keys(hymn!).sort()).toEqual(["blocks", "number", "sequence", "title"]);
    expect(hymn!.blocks[0]).toEqual({ kind: "verse", text: V1 });
  });

  it("does not let a __proto__ key through", () => {
    const hostile = JSON.parse(
      `{"__proto__":{"polluted":true},"number":"1","title":"T","blocks":[{"kind":"verse","text":"a"}],"sequence":[0]}`
    );
    const hymn = sanitizeImportedHymn(hostile)!;
    expect(Object.getPrototypeOf(hymn)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("accepts payloads at the size caps", () => {
    const blocks = Array.from({ length: 200 }, (_, i) => ({ kind: "verse", text: `v${i}` }));
    const sequence = Array.from({ length: 400 }, (_, i) => i % 200);
    const hymn = sanitizeImportedHymn({
      number: "x".repeat(16),
      title: "t".repeat(200),
      blocks,
      sequence,
    });
    expect(hymn?.blocks).toHaveLength(200);
    expect(hymn?.sequence).toHaveLength(400);
  });

  const blocksOf = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: "verse", text: `v${i}` }));

  it.each<[string, unknown]>([
    ["null", null],
    ["undefined", undefined],
    ["a number", 42],
    ["a string", "hymn"],
    ["an array", []],
    ["an empty object", {}],
    ["a missing number", { ...valid(), number: undefined }],
    ["a numeric number", { ...valid(), number: 12 }],
    ["a blank number", { ...valid(), number: "   " }],
    ["a number over 16 chars", { ...valid(), number: "1".repeat(17) }],
    ["a missing title", { ...valid(), title: undefined }],
    ["a blank title", { ...valid(), title: " " }],
    ["a title over 200 chars", { ...valid(), title: "t".repeat(201) }],
    ["blocks that are not an array", { ...valid(), blocks: { 0: { kind: "verse", text: "a" } } }],
    ["a sequence that is not an array", { ...valid(), sequence: "0,1,2" }],
    ["no blocks", { ...valid(), blocks: [], sequence: [] }],
    ["an empty sequence", { ...valid(), sequence: [] }],
    ["over 200 blocks", { ...valid(), blocks: blocksOf(201), sequence: [...Array(201).keys()] }],
    ["over 400 sequence entries", { ...valid(), sequence: Array(401).fill(0) }],
    ["a null block", { ...valid(), blocks: [null] }],
    ["a string block", { ...valid(), blocks: ["verse"] }],
    ["an unknown kind", { ...valid(), blocks: [{ kind: "intro", text: "a" }], sequence: [0] }],
    ["a missing kind", { ...valid(), blocks: [{ text: "a" }], sequence: [0] }],
    ["non-string text", { ...valid(), blocks: [{ kind: "verse", text: 1 }], sequence: [0] }],
    ["whitespace-only text", { ...valid(), blocks: [{ kind: "verse", text: " \r\n " }], sequence: [0] }],
    ["a fractional index", { ...valid(), sequence: [0, 1, 2, 1.5] }],
    ["a NaN index", { ...valid(), sequence: [0, 1, 2, NaN] }],
    ["an Infinity index", { ...valid(), sequence: [0, 1, 2, Infinity] }],
    ["a string index", { ...valid(), sequence: [0, 1, "2"] }],
    ["a negative index", { ...valid(), sequence: [0, 1, 2, -1] }],
    ["an out-of-range index", { ...valid(), sequence: [0, 1, 2, 3] }],
    ["an unreachable block", { ...valid(), sequence: [0, 1, 1] }],
  ])("rejects %s", (_label, input) => {
    expect(sanitizeImportedHymn(input)).toBeNull();
  });
});

describe("round trip of bundled hymns", () => {
  // Rebuild each hymn as the deck a church would make of it — one slide per
  // sequence entry, verses numbered and the chorus marked `Ref:` — and expect
  // the importer to give back the same blocks and sequence.
  //
  // Only hymns already in the shape the importer produces can round-trip:
  // bundled text that isn't canonical (backtick apostrophes), has blank lines
  // inside a stanza, carries a line that reads as a marker (`3.Dios`, a bare
  // `2`), or lists blocks out of first-use order is legitimately normalised on
  // the way through. So is a hymn opening on a short stanza: slide 1 at two
  // lines or fewer is taken for a title slide.
  const hymnalsDir = path.resolve(__dirname, "../../assets/hymnals");
  const books = fs.readdirSync(hymnalsDir).filter((f) => f.endsWith(".json"));

  const MARKER_LINE = /^\s*(?:\d{1,2}|ref(?:ren)?|cor|r)\s*(?:[.:)]|$)/im;

  function importShaped(hymn: Hymn): boolean {
    const firstUse = hymn.sequence.filter((b, i) => hymn.sequence.indexOf(b) === i);
    const opening = hymn.blocks[hymn.sequence[0]]?.text ?? "";
    return (
      hymn.blocks.every(
        (b) =>
          b.text === canonicalizeHymnText(b.text) &&
          !b.text.includes("\n\n") &&
          !MARKER_LINE.test(b.text)
      ) &&
      (opening.split("\n").length > 2 || opening.length > 60) &&
      firstUse.every((b, i) => b === i) &&
      firstUse.length === hymn.blocks.length
    );
  }

  function asDeck(hymn: Hymn): ParsedDeck {
    const verseNumber = new Map<number, number>();
    hymn.blocks.forEach((b, i) => {
      if (b.kind === "verse") verseNumber.set(i, verseNumber.size + 1);
    });
    return {
      slides: hymn.sequence.map((i) => {
        const block = hymn.blocks[i];
        const marker = block.kind === "chorus" ? "Ref:" : `${verseNumber.get(i)}.`;
        return { shapes: [`${marker}\n${block.text}`] };
      }),
    };
  }

  it.each(books)("%s", (book) => {
    const hymns = JSON.parse(fs.readFileSync(path.join(hymnalsDir, book), "utf-8")) as Hymn[];
    const candidates = hymns.filter(importShaped);
    // Guard against the filter quietly excluding everything.
    expect(candidates.length / hymns.length).toBeGreaterThan(0.8);

    const mismatched = candidates
      .filter((hymn) => {
        const out = draftToHymn(
          buildDraft(asDeck(hymn), { fileName: "", nextNumber: "1", title: hymn.title, number: hymn.number })
        );
        return (
          JSON.stringify(out?.blocks) !== JSON.stringify(hymn.blocks) ||
          JSON.stringify(out?.sequence) !== JSON.stringify(hymn.sequence)
        );
      })
      .map((hymn) => hymn.number);
    expect(mismatched).toEqual([]);
  });
});
