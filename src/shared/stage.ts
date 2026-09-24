import type { DisplayState } from "./types";
import type { LoadedLayer } from "./stage.types";

/**
 * `DisplayState` holds text, video, audio and image sub-states side by side;
 * `mode` names only the one currently on screen. The rest keep their state
 * invisibly — a paused video at 0:47 survives switching to Hymns — so the
 * Stage needs a single place both the panel and the rail agree on for "what
 * else is loaded".
 *
 * Lists every non-empty sub-state other than the one `mode` currently shows
 * (that one is already the live preview). Audio is the exception: it's not a
 * `DisplayMode` at all, it plays *under* every mode, so it's listed whenever
 * loaded regardless of `mode`.
 */
export function getLoadedLayers(state: DisplayState): LoadedLayer[] {
  const layers: LoadedLayer[] = [];

  if (state.mode !== "text" && state.text.slides.length > 0) {
    layers.push({ kind: "text" });
  }
  if (state.mode !== "video" && state.video.src !== null) {
    layers.push({ kind: "video" });
  }
  if (
    state.mode !== "image" &&
    (state.image.src !== null || state.image.slideshowImages.length > 0)
  ) {
    layers.push({ kind: "image" });
  }
  if (state.audio.src !== null) {
    layers.push({ kind: "audio" });
  }

  return layers;
}
