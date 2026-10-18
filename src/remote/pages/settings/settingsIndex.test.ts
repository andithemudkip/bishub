import { describe, expect, it } from "vitest";
import { getTranslations } from "../../../shared/i18n";
import { searchSettings, visibleSections, SETTINGS_INDEX } from "./settingsIndex";

const en = getTranslations("en");
const ro = getTranslations("ro");
const ids = (query: string, t = en, isElectron = true) =>
  searchSettings(query, t, isElectron).map((e) => e.id);

describe("searchSettings", () => {
  it("returns nothing for an empty query", () => {
    expect(ids("")).toEqual([]);
    expect(ids("   ")).toEqual([]);
  });

  it("finds a setting by its label", () => {
    expect(ids("darken background")).toContain("idleDim");
  });

  it("ranks label matches above rows that only mention the word in a hint", () => {
    // The dim hint mentions the clock; the clock rows should come first.
    const results = ids("clock");
    expect(results).toContain("idleDim");
    expect(results.indexOf("idleDim")).toBeGreaterThan(results.indexOf("clockPosition"));
    expect(results.indexOf("idleDim")).toBeGreaterThan(results.indexOf("idleShowClock"));
  });

  it("requires every word to match", () => {
    expect(ids("clock position")).toEqual(["clockPosition"]);
  });

  it("matches the section title, so a section name finds its rows", () => {
    expect(ids("projector screen")).toEqual(
      expect.arrayContaining(["displayMonitor", "slideBackground", "chromeSizes"]),
    );
  });

  it("ignores case and diacritics", () => {
    expect(ids("limba", ro)).toContain("language");
    expect(ids("LIMBĂ", ro)).toContain("language");
  });

  it("hides settings that need the main computer from web remotes", () => {
    expect(ids("phone", en, true)).toContain("connectPhone");
    expect(ids("phone", en, false)).not.toContain("connectPhone");
    expect(ids("startup", en, false)).not.toContain("openOnStartup");
  });

  it("gives every indexed setting a label in both languages", () => {
    for (const entry of SETTINGS_INDEX) {
      expect(entry.label(en)).toBeTruthy();
      expect(entry.label(ro)).toBeTruthy();
    }
  });
});

describe("visibleSections", () => {
  it("drops the phone section on web remotes, which can't show the pairing QR", () => {
    expect(visibleSections(true)).toContain("devices");
    expect(visibleSections(false)).not.toContain("devices");
    expect(visibleSections(false)).toContain("display");
  });
});
