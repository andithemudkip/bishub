import { describe, expect, it } from "vitest";
import { AVAILABLE_LANGUAGES, getTranslations } from "./i18n";

// Key parity between languages is already enforced by the `Translations`
// type. What the compiler can't see is the content of each string: a
// placeholder dropped or renamed in one language renders as a literal "{n}"
// (or loses the number entirely) only for users of that language.

type Leaf = { path: string; value: unknown };

function leaves(node: unknown, prefix = ""): Leaf[] {
  if (node === null || typeof node !== "object") return [{ path: prefix, value: node }];
  return Object.entries(node).flatMap(([key, child]) =>
    leaves(child, prefix ? `${prefix}.${key}` : key)
  );
}

function placeholders(text: string): string[] {
  return [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();
}

const [reference, ...others] = AVAILABLE_LANGUAGES;
const referenceLeaves = new Map(
  leaves(getTranslations(reference)).map((leaf) => [leaf.path, leaf.value])
);

describe.each(AVAILABLE_LANGUAGES)("%s translations", (language) => {
  it("has no empty strings", () => {
    const empty = leaves(getTranslations(language))
      .filter((leaf) => typeof leaf.value === "string" && leaf.value.trim() === "")
      .map((leaf) => leaf.path);
    expect(empty).toEqual([]);
  });
});

describe.each(others)(`%s translations`, (language) => {
  it(`use the same placeholders as ${reference}`, () => {
    const mismatches = leaves(getTranslations(language))
      .filter((leaf) => typeof leaf.value === "string")
      .map((leaf) => ({
        path: leaf.path,
        expected: placeholders(String(referenceLeaves.get(leaf.path) ?? "")),
        actual: placeholders(leaf.value as string),
      }))
      .filter((row) => row.expected.join() !== row.actual.join());
    expect(mismatches).toEqual([]);
  });
});
