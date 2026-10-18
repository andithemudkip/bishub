import fs from "fs";
import type { IdleBackground } from "../src/shared/types";
import {
  DEFAULT_IDLE_BACKGROUND,
  validateIdleBackground,
} from "../src/shared/idleBackground";
import type { ImageLibraryManager } from "./imageLibrary";
import type { StateManager } from "./state";

type Library = Pick<ImageLibraryManager, "getAll" | "getById" | "addImage" | "onLibraryChange">;

/**
 * A background from a remote, validated, with a library image resolved to its
 * file. Null when it's malformed or the image isn't in the library.
 */
export function resolveIdleBackground(input: unknown, library: Library): IdleBackground | null {
  const background = validateIdleBackground(input);
  if (background?.kind !== "image") return background;
  const image = library.getById(background.imageId);
  return image ? { ...background, path: image.path } : null;
}

/** The `setIdleBackground` action, for both transports. */
export function applyIdleBackground(
  stateManager: StateManager,
  input: unknown,
  library: Library
): boolean {
  const background = resolveIdleBackground(input, library);
  if (!background) return false;
  stateManager.setIdleBackground(background);
  return true;
}

/** A file picked on the main computer: it joins the Image library, then goes on the idle screen. */
export async function setIdleWallpaperFromFile(
  stateManager: StateManager,
  filePath: string,
  library: Library
): Promise<void> {
  const image = await library.addImage(filePath, "local");
  stateManager.setIdleBackground({ kind: "image", imageId: image.id, path: image.path });
}

/** Keep a library-image background pointing at a file that exists; the default replaces a deleted one. */
function recheckImage(stateManager: StateManager, library: Library): void {
  const background = stateManager.getState().idle.background;
  if (background.kind !== "image") return;
  const image = library.getById(background.imageId);
  if (!image) {
    stateManager.setIdleBackground(DEFAULT_IDLE_BACKGROUND);
  } else if (image.path !== background.path) {
    stateManager.setIdleBackground({ ...background, path: image.path });
  }
}

/**
 * Older versions referenced the user's own file in place, which breaks when
 * it's moved or its USB stick is pulled. Copy it into the Image library (never
 * move: it's the user's original); a file that's already gone falls back to
 * the default.
 */
async function migrateLegacyWallpaper(
  stateManager: StateManager,
  legacyPath: string,
  library: Library
): Promise<void> {
  let background: IdleBackground = DEFAULT_IDLE_BACKGROUND;
  const existing = library.getAll().find((image) => image.path === legacyPath);
  if (existing) {
    background = { kind: "image", imageId: existing.id, path: existing.path };
  } else if (fs.existsSync(legacyPath)) {
    try {
      const image = await library.addImage(legacyPath, "local");
      background = { kind: "image", imageId: image.id, path: image.path };
    } catch (err) {
      console.error("Failed to import the old idle wallpaper:", err);
    }
  }
  // Someone picked a background while the copy ran: theirs wins.
  if (stateManager.getLegacyWallpaper() !== legacyPath) return;
  stateManager.setIdleBackground(background);
}

/** Startup: migrate an old wallpaper, then follow the library so a deleted image isn't left on screen. */
export async function initIdleBackground(
  stateManager: StateManager,
  library: Library
): Promise<void> {
  const legacyPath = stateManager.getLegacyWallpaper();
  if (legacyPath) {
    await migrateLegacyWallpaper(stateManager, legacyPath, library);
  } else {
    recheckImage(stateManager, library);
  }
  library.onLibraryChange(() => recheckImage(stateManager, library));
}
