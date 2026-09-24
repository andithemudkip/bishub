import type { StateManager } from "./state";
import type { HymnPlaybackMode } from "../src/shared/types";
import { resolveHymnDisplay, type HymnAudioPreferences } from "./dataLoader";
import {
  getFallbackHymnalSlug,
  isValidHymnalSlug,
} from "./hymnalRegistry";

/**
 * Presenting a hymn is identical for the Electron remote (IPC) and web remotes
 * (Socket.io), so both entry points share these rather than keeping two copies
 * of the resolve-then-load dance in step.
 */

/**
 * Pick the book to act on: an explicit slug when it's a real book, otherwise
 * the remembered one, otherwise the default for the UI language. Slugs arrive
 * from remote clients, so an unknown value must never reach the filesystem.
 */
export function resolveHymnalSlug(
  stateManager: StateManager,
  slug?: string,
): string {
  if (slug && isValidHymnalSlug(slug)) return slug;
  const settings = stateManager.getSettings();
  if (settings.hymnal && isValidHymnalSlug(settings.hymnal)) {
    return settings.hymnal;
  }
  return getFallbackHymnalSlug(settings.language);
}

/**
 * Resolve a hymn and push it to the display: karaoke when the assets and
 * settings allow, otherwise an instrumental behind manual slides, otherwise
 * silent slides. Anything but `"auto"` is the operator overriding that for this
 * one hymn, so those branches read the assets alone and never the settings.
 */
export function presentHymn(
  stateManager: StateManager,
  slug: string,
  hymnNumber: string,
  playbackMode?: HymnPlaybackMode | null,
): void {
  const settings = stateManager.getSettings();
  const prefsByMode: Record<HymnPlaybackMode, HymnAudioPreferences> = {
    auto: { synced: settings.syncedLyrics, instrumental: settings.instrumentals },
    synced: { synced: true, instrumental: false },
    instrumental: { synced: false, instrumental: true },
    static: { synced: false, instrumental: false },
  };
  // Socket.io sends an omitted trailing argument as null (JSON has no
  // undefined), so a default parameter never kicks in for web remotes. Treat
  // anything that isn't a known mode as "auto" rather than crash.
  const mode =
    playbackMode && Object.prototype.hasOwnProperty.call(prefsByMode, playbackMode)
      ? playbackMode
      : "auto";
  const prefs = prefsByMode[mode];
  const resolved = resolveHymnDisplay(
    slug,
    hymnNumber,
    prefs,
    settings.language,
  );
  if (!resolved) return;

  const hymnRef = { book: slug, number: hymnNumber };
  if (resolved.kind === "synced") {
    stateManager.loadSyncedHymn(
      resolved.title,
      resolved.slides,
      resolved.ttml,
      resolved.audioPath,
      hymnRef,
    );
  } else if (resolved.kind === "instrumental") {
    stateManager.loadInstrumentalHymn(
      resolved.title,
      resolved.slides,
      resolved.audioPath,
      hymnRef,
    );
  } else {
    stateManager.loadText(
      resolved.title,
      resolved.slides.join("\n\n"),
      "hymn",
      hymnRef,
    );
  }
}
