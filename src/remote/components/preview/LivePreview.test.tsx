import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { DEFAULT_SETTINGS, DEFAULT_STATE, type DisplayState } from "../../../shared/types";
import LivePreview from "./LivePreview";

let intersect: (isIntersecting: boolean) => void = () => {};

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: IntersectionObserverCallback) {
        intersect = (isIntersecting) =>
          act(() =>
            cb([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver),
          );
      }
      observe() {}
      disconnect() {}
    },
  );
  // happy-dom doesn't implement media playback.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockReturnValue();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const showingVideo = (videoId: string | null): DisplayState => ({
  ...DEFAULT_STATE,
  mode: "video",
  video: { ...DEFAULT_STATE.video, src: "/videos/hymn.mp4", videoId, playing: true, duration: 60 },
});

const renderPreview = (state: DisplayState) =>
  render(<LivePreview state={state} settings={DEFAULT_SETTINGS} />).container;

describe("LivePreview video", () => {
  it("streams the library file only while the preview is on screen", () => {
    const container = renderPreview(showingVideo("v1"));
    expect(container.querySelector("video")).toBeNull();

    intersect(true);
    const video = container.querySelector("video");
    expect(video?.getAttribute("src")).toBe("/api/videos/file/v1");
    expect(video?.muted).toBe(true);

    // Unmounting the element is what stops the download, not just pausing.
    intersect(false);
    expect(container.querySelector("video")).toBeNull();
  });

  it("falls back to the thumbnail when the video can't be played", () => {
    const container = renderPreview(showingVideo("v1"));
    intersect(true);
    fireEvent.error(container.querySelector("video")!);

    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/api/videos/thumbnail/v1");
  });

  it("shows only the still for a video without a library id", () => {
    const container = renderPreview(showingVideo(null));
    intersect(true);
    expect(container.querySelector("video")).toBeNull();
  });
});

describe("LivePreview idle", () => {
  const idle = (overrides: Partial<DisplayState["idle"]>): DisplayState => ({
    ...DEFAULT_STATE,
    idle: { ...DEFAULT_STATE.idle, ...overrides },
  });
  const screen = (container: HTMLElement) =>
    container.querySelector<HTMLElement>("[data-testid=idle-background]")!;

  it("shows the wallpaper itself, fetched over the API", () => {
    const container = renderPreview(
      idle({ background: { kind: "image", imageId: "img 1", path: "/Users/me/x.jpg" } })
    );
    expect(screen(container).style.backgroundImage).toContain("/api/images/file/img%201");
  });

  it("paints a solid color", () => {
    const container = renderPreview(idle({ background: { kind: "color", color: "#336699" } }));
    expect(screen(container).style.background).toContain("#336699");
  });

  it("blurs an image without blurring the clock", () => {
    const container = renderPreview(
      idle({ background: { kind: "image", imageId: "a", path: null }, blur: 50 })
    );
    expect(screen(container).style.filter).toBe("blur(12px)");
    expect(screen(container).parentElement!.style.filter).toBe("");
  });

  it("leaves gradients and colors unblurred", () => {
    const container = renderPreview(idle({ blur: 100 }));
    expect(screen(container).style.filter).toBe("");
  });

  it("dims by the configured amount", () => {
    const container = renderPreview(idle({ dim: 55 }));
    expect(container.querySelector<HTMLElement>("[data-testid=idle-dim]")!.style.opacity).toBe("0.55");
  });

  it("hides the date when turned off", () => {
    const date = new Date().toLocaleDateString("ro-RO", { weekday: "long" });
    expect(renderPreview(idle({ showDate: true })).textContent).toContain(date);
    expect(renderPreview(idle({ showDate: false })).textContent).not.toContain(date);
  });
});

describe("IdleScreen", () => {
  it("fills a box that's only roughly 16:9, leaving no sliver", () => {
    // A 1px border on a 16:9 box leaves a slightly wider inner area.
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(446);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(249);
    const container = renderPreview(DEFAULT_STATE);
    const virtual = container.querySelector<HTMLElement>("[data-testid=idle-dim]")!.parentElement!
      .parentElement!;
    expect(virtual.style.transform).toBe(`scale(${446 / 1920}, ${249 / 1080})`);
  });
});
