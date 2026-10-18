import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { DEFAULT_STATE, type AudioState } from "../../shared/types";
import AudioPlayer from "./AudioPlayer";

beforeEach(() => {
  // happy-dom doesn't implement media playback.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockReturnValue();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const audio = (overrides: Partial<AudioState>): AudioState => ({
  ...DEFAULT_STATE.audio,
  ...overrides,
});

describe("AudioPlayer volume", () => {
  it("plays a newly loaded track at the saved volume, not full", () => {
    // The saved volume arrives at startup, before anything is loaded.
    const { container, rerender } = render(
      <AudioPlayer config={audio({ volume: 0.3 })} onTimeUpdate={vi.fn()} />,
    );
    rerender(
      <AudioPlayer
        config={audio({ volume: 0.3, src: "/a.mp3", playing: true })}
        onTimeUpdate={vi.fn()}
      />,
    );
    expect(container.querySelector("audio")!.volume).toBeCloseTo(0.3);
  });

  it("keeps the volume across a stop and the next load", () => {
    const view = (src: string | null) => (
      <AudioPlayer config={audio({ volume: 0.5, src })} onTimeUpdate={vi.fn()} />
    );
    const { container, rerender } = render(view("/a.mp3"));
    rerender(view(null));
    rerender(view("/b.mp3"));
    expect(container.querySelector("audio")!.volume).toBeCloseTo(0.5);
  });

  it("follows volume changes", () => {
    const view = (volume: number) => (
      <AudioPlayer config={audio({ volume, src: "/a.mp3" })} onTimeUpdate={vi.fn()} />
    );
    const { container, rerender } = render(view(0.5));
    rerender(view(0.8));
    expect(container.querySelector("audio")!.volume).toBeCloseTo(0.8);
  });
});
