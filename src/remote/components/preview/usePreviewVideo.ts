import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Playing, the preview closes small gaps by running a little fast or slow
 * (it's muted, so nobody hears it) instead of jumping: on a web remote every
 * jump rebuffers, and rebuffering is exactly what opens a gap. Only a real
 * seek — a gap too big to catch up by speed — is jumped to.
 */
const PLAYING_SEEK_THRESHOLD = 2;
/** Gaps under this are noise (tick latency) and left alone. */
const PLAYING_DEAD_BAND = 0.1;
/** Playback-rate change per second of gap, capped either way. */
const RATE_GAIN = 0.5;
const MAX_RATE_CHANGE = 0.5;
/** Paused, nothing moves, so a seek should land where it was aimed. */
const PAUSED_TOLERANCE = 0.25;

export interface SyncStep {
  /** Where to jump, or null to stay. */
  seekTo: number | null;
  playbackRate: number;
}

/** How to bring the preview at `previewTime` to the display at `targetTime`. */
export function syncStep(previewTime: number, targetTime: number, playing: boolean): SyncStep {
  const gap = targetTime - previewTime;
  if (!playing) {
    return { seekTo: Math.abs(gap) > PAUSED_TOLERANCE ? targetTime : null, playbackRate: 1 };
  }
  if (Math.abs(gap) > PLAYING_SEEK_THRESHOLD) return { seekTo: targetTime, playbackRate: 1 };
  if (Math.abs(gap) <= PLAYING_DEAD_BAND) return { seekTo: null, playbackRate: 1 };
  const change = Math.max(-MAX_RATE_CHANGE, Math.min(MAX_RATE_CHANGE, gap * RATE_GAIN));
  return { seekTo: null, playbackRate: 1 + change };
}

/**
 * Where the display is now, from the last time it reported: while playing it
 * has moved on since, by however long ago that report arrived.
 */
export function expectedDisplayTime(
  reportedTime: number,
  reportedAt: number,
  now: number,
  playing: boolean,
): number {
  return playing ? reportedTime + (now - reportedAt) / 1000 : reportedTime;
}

/**
 * Whether an element is on screen: intersecting the viewport and in a tab or
 * window that isn't hidden. Streaming the preview video costs bandwidth on
 * web remotes and a second decoder on the main computer, so it only runs
 * while someone could be looking at it.
 */
export function useOnScreen<T extends Element>(): [(el: T | null) => void, boolean] {
  const [el, setEl] = useState<T | null>(null);
  const [intersecting, setIntersecting] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState !== "hidden");

  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setIntersecting(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      setIntersecting(entries[entries.length - 1].isIntersecting);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);

  return [setEl, intersecting && pageVisible];
}

/**
 * Keeps a muted preview `<video>` following the display: playing when it
 * plays, and converging on where it is now (see `syncStep`) whenever a time
 * report arrives. A seek from any remote shows up the same way. The preview
 * never seeks the display.
 *
 * Returns the ref for the element and handlers for `loadedmetadata` (line a
 * freshly mounted video up with the display) and `playing` (catch up after
 * buffering, which the display didn't wait for).
 */
export function usePreviewVideoSync(playing: boolean, currentTime: number) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const report = useRef({ playing, currentTime, at: performance.now() });
  if (report.current.currentTime !== currentTime || report.current.playing !== playing) {
    report.current = { playing, currentTime, at: performance.now() };
  }

  const sync = useCallback(() => {
    const el = ref.current;
    // Before metadata there's nothing to seek; onLoadedMetadata catches up.
    if (!el || el.readyState < 1) return;
    const { playing, currentTime, at } = report.current;
    const target = expectedDisplayTime(currentTime, at, performance.now(), playing);
    const step = syncStep(el.currentTime, target, playing);
    if (step.seekTo !== null) el.currentTime = step.seekTo;
    el.playbackRate = step.playbackRate;
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (playing) {
      // Autoplay can be refused (e.g. power saving on phones); the thumbnail
      // underneath and the time readout still tell the story.
      el.play()?.catch(() => {});
    } else {
      el.pause();
    }
  }, [playing]);

  useEffect(sync, [currentTime, playing, sync]);

  const onLoadedMetadata = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // A fresh video jumps straight there, however small the gap; any lag
    // from buffering is caught up by speed once it starts (onPlaying).
    const { playing, currentTime, at } = report.current;
    el.currentTime = expectedDisplayTime(currentTime, at, performance.now(), playing);
    if (playing) el.play()?.catch(() => {});
  }, []);

  return { ref, onLoadedMetadata, onPlaying: sync };
}
