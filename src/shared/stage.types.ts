import type { DownloadStage } from "./videoLibrary.types";
import type { DisplayMode } from "./types";

/**
 * One background operation the Stage can show progress for. Each kind maps to
 * exactly one progress stream normalized in `stageActivity.ts`.
 */
export type ActivityKind =
  | "video-download"
  | "video-upload"
  | "audio-download"
  | "audio-upload"
  | "audio-import"
  | "image-upload"
  | "hymn-mp3"
  | "transfer"
  | "bible-translation";

export type ActivityStatus = "pending" | "running" | "complete" | "error";

/** Page an activity belongs to — tap routes here, and nav badges (Phase 4) attach here. */
export type ActivityTarget =
  | "video"
  | "audio"
  | "images"
  | "hymns"
  | "bible"
  | "transfer"
  | "settings";

/**
 * A normalized, transport-agnostic view of a progress stream, ready for the
 * Stage to render.
 *
 * Deliberately holds no pre-formatted, user-facing strings (no
 * `detail: "44 imported, 3 failed"`): shared code can't know the language, so
 * every field here is structured data the UI formats later through
 * `getTranslations`. `label` is the exception — it's a filename / hymn /
 * track / translation name, i.e. data the backend produced, not UI copy.
 */
export interface Activity {
  /** `${kind}:${sourceId}` — stable across updates for the same operation. */
  id: string;
  kind: ActivityKind;
  status: ActivityStatus;
  label: string;
  /** 0–100, or null when there's no measurable progress. */
  progress: number | null;
  /** `DownloadProgress`/`AudioDownloadProgress` phase, while progress is still 0. */
  stage?: DownloadStage;
  /** "3 of 47" — directory import. */
  current?: number;
  total?: number;
  /** Finished-so-far counts — directory import. */
  succeeded?: number;
  failed?: number;
  /** File currently being processed — directory import. */
  currentItem?: string;
  /** Raw error string the backend sent, if any. */
  error?: string;
  startedAt: number;
  updatedAt: number;
  target: ActivityTarget;
  /**
   * Present only on the synthetic bulk hymn-MP3 row (more than 3 `hymn-mp3`
   * rows collapse into one so the Activity list stays readable).
   */
  grouped?: { count: number; done: number; failed: number };
}

/** Which non-showing sub-state of `DisplayState` is loaded, per A3. */
export interface LoadedLayer {
  kind: Exclude<DisplayMode, "idle"> | "audio";
}
