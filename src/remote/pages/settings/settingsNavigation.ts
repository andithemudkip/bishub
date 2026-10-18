import { createContext } from "react";
import { isSettingsSection, type SettingsSectionId } from "./settingsIndex";

/**
 * The last Settings section opened, per browser, so desktop users land where
 * they left off. Other pages deep-link into a section with a `settings`
 * page intent (`sendPageIntent`).
 */

const STORAGE_KEY = "bishub.settings.section";

export function readLastSection(): SettingsSectionId | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isSettingsSection(value) ? value : null;
  } catch {
    return null;
  }
}

export function rememberSection(section: SettingsSectionId) {
  try {
    localStorage.setItem(STORAGE_KEY, section);
  } catch {
    // Private mode / blocked storage: forgetting the section is harmless.
  }
}

/** The `SettingRow` id a search result or deep link just pointed at. */
export const HighlightContext = createContext<string | null>(null);
