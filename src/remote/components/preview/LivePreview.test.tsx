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
