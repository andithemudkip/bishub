// Centralized keyboard shortcut definitions
// Single source of truth for keys, display labels, and i18n mapping

import type { Translations } from "./i18n";

export interface ShortcutDefinition {
  keys: string[];
  display: string[];
  /** Requires Cmd (Mac) / Ctrl (other) modifier */
  mod?: boolean;
  label: (t: Translations) => string;
}

export const SHORTCUTS = {
  nextSlide: {
    keys: ["ArrowRight", "ArrowDown", "PageDown"],
    display: ["→", "↓", "PgDn"],
    label: (t: Translations) => t.settings.nextSlide,
  },
  prevSlide: {
    keys: ["ArrowLeft", "ArrowUp", "PageUp"],
    display: ["←", "↑", "PgUp"],
    label: (t: Translations) => t.settings.previousSlide,
  },
  goIdle: {
    keys: ["Escape"],
    display: ["Esc"],
    label: (t: Translations) => t.settings.goToIdle,
  },
  focusSearch: {
    keys: ["F5"],
    display: ["F5"],
    label: (t: Translations) => t.settings.focusSearch,
  },
  switchPage: {
    keys: ["1", "2", "3", "4", "5", "6", "7"],
    display: ["1–7"],
    mod: true,
    label: (t: Translations) => t.settings.switchPage,
  },
} as const satisfies Record<string, ShortcutDefinition>;

export type ShortcutName = keyof typeof SHORTCUTS;

/** Page order matching Cmd/Ctrl + 1-6 */
export const PAGE_ORDER = [
  "hymns",
  "bible",
  "video",
  "audio",
  "images",
  "transfer",
  "settings",
] as const;
