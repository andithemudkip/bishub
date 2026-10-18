import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { DEFAULT_STATE, type VideoState } from "../../shared/types";
import VideoMode from "./VideoMode";

beforeEach(() => {
  // happy-dom doesn't implement media playback.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockReturnValue();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const video = (overrides: Partial<VideoState>): VideoState => ({
  ...DEFAULT_STATE.video,
  ...overrides,
});

describe("VideoMode volume", () => {
  it("plays a newly loaded video at the saved volume, not full", () => {
    const { container, rerender } = render(
      <VideoMode config={video({ volume: 0.3 })} onTimeUpdate={vi.fn()} />,
    );
    rerender(
      <VideoMode config={video({ volume: 0.3, src: "/v.mp4", playing: true })} onTimeUpdate={vi.fn()} />,
    );
    expect(container.querySelector("video")!.volume).toBeCloseTo(0.3);
  });

  it("follows volume changes", () => {
    const view = (volume: number) => (
      <VideoMode config={video({ volume, src: "/v.mp4" })} onTimeUpdate={vi.fn()} />
    );
    const { container, rerender } = render(view(0.5));
    rerender(view(0.8));
    expect(container.querySelector("video")!.volume).toBeCloseTo(0.8);
  });
});
