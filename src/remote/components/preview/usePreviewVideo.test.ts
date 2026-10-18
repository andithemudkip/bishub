import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  expectedDisplayTime,
  syncStep,
  useOnScreen,
  usePreviewVideoSync,
} from "./usePreviewVideo";

/** Just the parts of a `<video>` the sync touches, with readable state. */
function fakeVideo(readyState = 1) {
  return {
    readyState,
    currentTime: 0,
    playbackRate: 1,
    paused: true,
    play: vi.fn(function (this: { paused: boolean }) {
      this.paused = false;
      return Promise.resolve();
    }),
    pause: vi.fn(function (this: { paused: boolean }) {
      this.paused = true;
    }),
  };
}

/** A controllable clock in ms, as `performance.now()` reads it. */
function stubClock(start = 1000) {
  let now = start;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  return { advance: (ms: number) => (now += ms) };
}

function renderSync(initial: { playing: boolean; currentTime: number }, el = fakeVideo()) {
  const hook = renderHook(
    ({ playing, currentTime }) => {
      const sync = usePreviewVideoSync(playing, currentTime);
      // Attach before the effects run, as React would for a mounted <video>.
      sync.ref.current = el as unknown as HTMLVideoElement;
      return sync;
    },
    { initialProps: initial },
  );
  return { ...hook, el };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("syncStep", () => {
  it("leaves tick-latency noise alone while playing", () => {
    expect(syncStep(10, 10.05, true)).toEqual({ seekTo: null, playbackRate: 1 });
  });

  it("closes a small gap by speed, not by jumping, faster for a bigger gap", () => {
    const behind = syncStep(10, 10.8, true);
    expect(behind.seekTo).toBeNull();
    expect(behind.playbackRate).toBeGreaterThan(1);
    expect(syncStep(10, 11.5, true).playbackRate).toBeGreaterThan(behind.playbackRate);

    const ahead = syncStep(10.8, 10, true);
    expect(ahead.seekTo).toBeNull();
    expect(ahead.playbackRate).toBeLessThan(1);
  });

  it("jumps to a real seek while playing", () => {
    expect(syncStep(10, 42, true)).toEqual({ seekTo: 42, playbackRate: 1 });
  });

  it("lands paused seeks precisely, at normal speed", () => {
    expect(syncStep(10, 10.5, false)).toEqual({ seekTo: 10.5, playbackRate: 1 });
    expect(syncStep(10, 10.1, false)).toEqual({ seekTo: null, playbackRate: 1 });
  });
});

describe("expectedDisplayTime", () => {
  it("moves a playing display on by the time since it reported", () => {
    expect(expectedDisplayTime(10, 1000, 1800, true)).toBeCloseTo(10.8);
  });

  it("keeps a paused display where it reported", () => {
    expect(expectedDisplayTime(10, 1000, 1800, false)).toBe(10);
  });
});

describe("usePreviewVideoSync", () => {
  it("plays and pauses with the display", () => {
    const { el, rerender } = renderSync({ playing: true, currentTime: 0 });
    expect(el.paused).toBe(false);

    rerender({ playing: false, currentTime: 0 });
    expect(el.paused).toBe(true);
  });

  it("jumps when the display seeks", () => {
    const { el, rerender } = renderSync({ playing: true, currentTime: 0 });
    rerender({ playing: true, currentTime: 42 });
    expect(el.currentTime).toBeCloseTo(42);
  });

  it("doesn't seek before metadata, then catches up once it loads", () => {
    const { el, result, rerender } = renderSync(
      { playing: true, currentTime: 0 },
      fakeVideo(0),
    );
    el.play.mockClear();

    rerender({ playing: true, currentTime: 30 });
    expect(el.currentTime).toBe(0);

    el.readyState = 1;
    act(() => result.current.onLoadedMetadata());
    expect(el.currentTime).toBeCloseTo(30);
    expect(el.play).toHaveBeenCalled();
  });

  it("a remote opened mid-video catches up with the display, not its last report", () => {
    const clock = stubClock();
    const { el, result } = renderSync({ playing: true, currentTime: 10 }, fakeVideo(0));

    // Metadata takes a while to arrive; the display has played on meanwhile.
    clock.advance(800);
    el.readyState = 1;
    act(() => result.current.onLoadedMetadata());
    expect(el.currentTime).toBeCloseTo(10.8);

    // Then buffering holds the preview still for another moment before it
    // starts — it must notice it's behind and speed up to close the gap.
    clock.advance(800);
    act(() => result.current.onPlaying());
    expect(el.playbackRate).toBeGreaterThan(1);
  });

  it("returns to normal speed once caught up, and when paused", () => {
    const clock = stubClock();
    const { el, rerender } = renderSync({ playing: true, currentTime: 10 });
    el.currentTime = 9.2;
    rerender({ playing: true, currentTime: 10.0001 });
    expect(el.playbackRate).toBeGreaterThan(1);

    clock.advance(250);
    el.currentTime = 10.25;
    rerender({ playing: true, currentTime: 10.25 });
    expect(el.playbackRate).toBe(1);

    el.currentTime = 9;
    rerender({ playing: false, currentTime: 10.25 });
    expect(el.playbackRate).toBe(1);
    expect(el.currentTime).toBe(10.25);
  });

  it("a video mounted while paused loads at the display's time without playing", () => {
    const { el, result } = renderSync({ playing: false, currentTime: 12 }, fakeVideo(0));
    act(() => result.current.onLoadedMetadata());
    expect(el.currentTime).toBe(12);
    expect(el.play).not.toHaveBeenCalled();
  });

  it("survives a refused autoplay", async () => {
    const el = fakeVideo();
    el.play.mockImplementation(() => Promise.reject(new Error("NotAllowedError")));
    renderSync({ playing: true, currentTime: 0 }, el);
    // An unhandled rejection would fail the run.
    await act(async () => {});
    expect(el.play).toHaveBeenCalled();
  });
});

describe("useOnScreen", () => {
  let observerCallback: IntersectionObserverCallback | null = null;
  const disconnect = vi.fn();

  function stubIntersectionObserver() {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: IntersectionObserverCallback) {
          observerCallback = cb;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
  }

  function intersect(isIntersecting: boolean) {
    act(() =>
      observerCallback!(
        [{ isIntersecting } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
  }

  function setPageHidden(hidden: boolean) {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue(hidden ? "hidden" : "visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    observerCallback = null;
  });

  function renderOnScreen() {
    const hook = renderHook(() => useOnScreen<HTMLDivElement>());
    act(() => hook.result.current[0](document.createElement("div")));
    return hook;
  }

  it("is on screen only while intersecting the viewport", () => {
    stubIntersectionObserver();
    const { result } = renderOnScreen();
    expect(result.current[1]).toBe(false);

    intersect(true);
    expect(result.current[1]).toBe(true);

    intersect(false);
    expect(result.current[1]).toBe(false);
  });

  it("is off screen while the tab or window is hidden", () => {
    stubIntersectionObserver();
    const { result } = renderOnScreen();
    intersect(true);

    setPageHidden(true);
    expect(result.current[1]).toBe(false);

    setPageHidden(false);
    expect(result.current[1]).toBe(true);
  });

  it("stops observing on unmount", () => {
    stubIntersectionObserver();
    const { unmount } = renderOnScreen();
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it("assumes on screen where IntersectionObserver is missing", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { result } = renderOnScreen();
    expect(result.current[1]).toBe(true);
  });
});
