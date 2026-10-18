import fs from "fs";
import os from "os";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readStore, seedStore } from "../test/mocks/electron-store";
import type { ImageItem } from "../src/shared/imageLibrary.types";
import { DEFAULT_IDLE_BACKGROUND } from "../src/shared/idleBackground";
import { StateManager } from "./state";
import {
  applyIdleBackground,
  initIdleBackground,
  setIdleWallpaperFromFile,
} from "./idleBackground";

const image = (id: string, filePath: string): ImageItem => ({
  id,
  name: id,
  filename: path.basename(filePath),
  path: filePath,
  thumbnailPath: null,
  dateAdded: 0,
  fileSize: 1,
  source: "local",
  slideshowId: null,
  slideshowOrder: null,
});

/** The bits of the Image library the idle background uses, in memory. */
function fakeLibrary(images: ImageItem[] = []) {
  const listeners: ((images: ImageItem[]) => void)[] = [];
  const library = {
    images,
    getAll: () => [...library.images],
    getById: (id: string) => library.images.find((i) => i.id === id) ?? null,
    addImage: vi.fn(async (sourcePath: string) => {
      const added = image(`img${library.images.length + 1}`, `/library/${path.basename(sourcePath)}`);
      library.images.push(added);
      return added;
    }),
    onLibraryChange: (cb: (images: ImageItem[]) => void) => {
      listeners.push(cb);
      return () => {};
    },
    remove(id: string) {
      library.images = library.images.filter((i) => i.id !== id);
      listeners.forEach((cb) => cb(library.images));
    },
  };
  return library;
}

const idleSettings = (extra: Record<string, unknown>) => ({
  idleSettings: {
    clockFontSize: 100,
    clockPosition: "center",
    audioWidgetPosition: "bottom-right",
    ...extra,
  },
});

const storedIdle = () => (readStore("settings")?.idleSettings ?? {}) as Record<string, unknown>;

describe("applyIdleBackground", () => {
  let state: StateManager;
  beforeEach(() => {
    state = new StateManager();
  });

  it("resolves a library image to its file and persists it", () => {
    const library = fakeLibrary([image("a", "/library/a.jpg")]);
    expect(applyIdleBackground(state, { kind: "image", imageId: "a" }, library)).toBe(true);
    expect(state.getState().idle.background).toEqual({
      kind: "image",
      imageId: "a",
      path: "/library/a.jpg",
    });
    expect(storedIdle().background).toEqual({ kind: "image", imageId: "a", path: "/library/a.jpg" });
  });

  it("ignores an image that isn't in the library, and a client's own path", () => {
    const library = fakeLibrary();
    expect(
      applyIdleBackground(state, { kind: "image", imageId: "gone", path: "/etc/passwd" }, library)
    ).toBe(false);
    expect(state.getState().idle.background).toEqual(DEFAULT_IDLE_BACKGROUND);
  });

  it("ignores malformed input", () => {
    expect(applyIdleBackground(state, { kind: "color", color: "red" }, fakeLibrary())).toBe(false);
    expect(state.getState().idle.background).toEqual(DEFAULT_IDLE_BACKGROUND);
  });
});

describe("setIdleWallpaperFromFile", () => {
  it("adds the picked file to the library and shows that copy", async () => {
    const state = new StateManager();
    const library = fakeLibrary();
    await setIdleWallpaperFromFile(state, "/Users/me/Desktop/church.jpg", library);

    expect(library.addImage).toHaveBeenCalledWith("/Users/me/Desktop/church.jpg", "local");
    expect(state.getState().idle.background).toEqual({
      kind: "image",
      imageId: "img1",
      path: "/library/church.jpg",
    });
  });
});

describe("initIdleBackground", () => {
  it("falls back to the default when the wallpaper image is deleted", async () => {
    const library = fakeLibrary([image("a", "/library/a.jpg"), image("b", "/library/b.jpg")]);
    const state = new StateManager();
    await initIdleBackground(state, library);
    applyIdleBackground(state, { kind: "image", imageId: "a" }, library);

    library.remove("b");
    expect(state.getState().idle.background).toMatchObject({ imageId: "a" });

    library.remove("a");
    expect(state.getState().idle.background).toEqual(DEFAULT_IDLE_BACKGROUND);
  });

  it("drops a stored image the library no longer has", async () => {
    seedStore("settings", idleSettings({ background: { kind: "image", imageId: "x", path: "/library/x.jpg" } }));
    const state = new StateManager();
    await initIdleBackground(state, fakeLibrary());
    expect(state.getState().idle.background).toEqual(DEFAULT_IDLE_BACKGROUND);
  });

  it("keeps a stored image the library still has", async () => {
    seedStore("settings", idleSettings({ background: { kind: "image", imageId: "x", path: "/library/x.jpg" } }));
    const state = new StateManager();
    await initIdleBackground(state, fakeLibrary([image("x", "/library/x.jpg")]));
    expect(state.getState().idle.background).toEqual({
      kind: "image",
      imageId: "x",
      path: "/library/x.jpg",
    });
  });

  describe("an older version's wallpaper path", () => {
    let original: string;
    beforeEach(() => {
      original = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bishub-wallpaper-")), "church.jpg");
      fs.writeFileSync(original, "jpeg");
    });

    it("is copied into the library and replaced by the image", async () => {
      seedStore("settings", idleSettings({ wallpaper: original }));
      const state = new StateManager();
      const library = fakeLibrary();
      await initIdleBackground(state, library);

      expect(library.addImage).toHaveBeenCalledWith(original, "local");
      expect(state.getState().idle.background).toEqual({
        kind: "image",
        imageId: "img1",
        path: "/library/church.jpg",
      });
      expect(storedIdle()).not.toHaveProperty("wallpaper");
      expect(state.getLegacyWallpaper()).toBeNull();
    });

    it("runs once", async () => {
      seedStore("settings", idleSettings({ wallpaper: original }));
      await initIdleBackground(new StateManager(), fakeLibrary());

      const library = fakeLibrary([image("img1", "/library/church.jpg")]);
      await initIdleBackground(new StateManager(), library);
      expect(library.addImage).not.toHaveBeenCalled();
    });

    it("reuses the library's own entry when it already points there", async () => {
      seedStore("settings", idleSettings({ wallpaper: original }));
      const state = new StateManager();
      const library = fakeLibrary([image("lib", original)]);
      await initIdleBackground(state, library);

      expect(library.addImage).not.toHaveBeenCalled();
      expect(state.getState().idle.background).toMatchObject({ imageId: "lib" });
    });

    it("becomes the default when the file is gone", async () => {
      seedStore("settings", idleSettings({ wallpaper: "/Volumes/USB/missing.jpg" }));
      const state = new StateManager();
      const library = fakeLibrary();
      await initIdleBackground(state, library);

      expect(library.addImage).not.toHaveBeenCalled();
      expect(state.getState().idle.background).toEqual(DEFAULT_IDLE_BACKGROUND);
      expect(storedIdle()).not.toHaveProperty("wallpaper");
    });

    it("loses to a background picked while it was copying", async () => {
      seedStore("settings", idleSettings({ wallpaper: original }));
      const state = new StateManager();
      const library = fakeLibrary();
      const migration = initIdleBackground(state, library);
      state.setIdleBackground({ kind: "color", color: "#112233" });
      await migration;

      expect(state.getState().idle.background).toEqual({ kind: "color", color: "#112233" });
    });
  });
});

describe("idle display options", () => {
  it("clamps and persists the dim", () => {
    const state = new StateManager();
    state.setIdleDim(95);
    expect(state.getState().idle.dim).toBe(80);
    state.setIdleDim("50" as unknown as number);
    expect(state.getState().idle.dim).toBe(30);
    expect(storedIdle().dim).toBe(30);
  });

  it("clamps and persists the blur", () => {
    const state = new StateManager();
    state.setIdleBlur(140);
    expect(state.getState().idle.blur).toBe(100);
    expect(new StateManager().getState().idle.blur).toBe(100);
  });

  it("persists the clock and date switches", () => {
    const state = new StateManager();
    state.setIdleShowClock(false);
    state.setIdleShowDate(false);
    expect(storedIdle()).toMatchObject({ showClock: false, showDate: false });
    expect(new StateManager().getState().idle).toMatchObject({ showClock: false, showDate: false });
  });
});
