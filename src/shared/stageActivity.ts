import type { DownloadProgress, UploadProgress } from "./videoLibrary.types";
import type {
  AudioDownloadProgress,
  AudioUploadProgress,
  DirectoryImportProgress,
} from "./audioLibrary.types";
import type { ImageUploadProgress } from "./imageLibrary.types";
import type { TransferUploadProgress } from "./transfer.types";
import type {
  AudioSchedule,
  ScheduleEvent,
} from "./audioSchedule.types";
import type { BibleTranslationStatus, MP3DownloadProgress } from "./types";
import type { Activity, ActivityStatus } from "./stage.types";

/**
 * Every payload above spells "still working" a different way
 * (downloading/processing/uploading/scanning/importing, queued/pending) and
 * "finished, not an error" a different way (complete, cancelled). Collapsing
 * them here means every normalizer below, and every consumer of `Activity`,
 * only ever has to branch on four states.
 *
 * `cancelled` maps to `complete` on purpose: a cancelled download is over,
 * not an error, so it should fade with the completed rows rather than
 * persist and demand a dismiss.
 */
function collapseStatus(status: string): ActivityStatus {
  switch (status) {
    case "complete":
    case "cancelled":
      return "complete";
    case "error":
      return "error";
    case "pending":
    case "queued":
      return "pending";
    default:
      // downloading | processing | uploading | scanning | importing
      return "running";
  }
}

/**
 * `DownloadProgress.stage`/`AudioDownloadProgress.stage` (preparing → fetching
 * → downloading → extracting → merging) is only meaningful before there's a
 * real percentage to show — surfacing it once `progress` is moving would just
 * be stale, since the field isn't guaranteed to be cleared once downloading
 * starts.
 */
function stageWhileZero<T extends { progress: number; stage?: DownloadProgress["stage"] }>(
  progress: T,
): DownloadProgress["stage"] | undefined {
  return progress.progress === 0 ? progress.stage : undefined;
}

export function normalizeVideoDownload(
  progress: DownloadProgress,
  now: number,
): Activity {
  return {
    id: `video-download:${progress.id}`,
    kind: "video-download",
    status: collapseStatus(progress.status),
    label: progress.filename ?? progress.url,
    progress: progress.progress,
    stage: stageWhileZero(progress),
    error: progress.error,
    startedAt: now,
    updatedAt: now,
    target: "video",
  };
}

export function normalizeVideoUpload(progress: UploadProgress, now: number): Activity {
  return {
    id: `video-upload:${progress.id}`,
    kind: "video-upload",
    status: collapseStatus(progress.status),
    label: progress.filename,
    progress: progress.progress,
    error: progress.error,
    startedAt: now,
    updatedAt: now,
    target: "video",
  };
}

export function normalizeAudioDownload(
  progress: AudioDownloadProgress,
  now: number,
): Activity {
  return {
    id: `audio-download:${progress.id}`,
    kind: "audio-download",
    status: collapseStatus(progress.status),
    label: progress.filename ?? progress.url,
    progress: progress.progress,
    stage: stageWhileZero(progress),
    error: progress.error,
    startedAt: now,
    updatedAt: now,
    target: "audio",
  };
}

export function normalizeAudioUpload(progress: AudioUploadProgress, now: number): Activity {
  return {
    id: `audio-upload:${progress.id}`,
    kind: "audio-upload",
    status: collapseStatus(progress.status),
    label: progress.filename,
    progress: progress.progress,
    error: progress.error,
    startedAt: now,
    updatedAt: now,
    target: "audio",
  };
}

/**
 * Electron-only: `addLocalAudioDirectory` goes through the native folder
 * picker, so there is no web-remote equivalent of this stream at all — the
 * feature itself can't run remotely, per the web-remote-parity invariant.
 */
export function normalizeAudioImport(
  progress: DirectoryImportProgress,
  now: number,
): Activity {
  return {
    id: `audio-import:${progress.id}`,
    kind: "audio-import",
    status: collapseStatus(progress.status),
    label: progress.directory,
    progress: progress.total > 0 ? (progress.current / progress.total) * 100 : null,
    current: progress.current,
    total: progress.total,
    currentItem: progress.currentFile,
    succeeded: progress.completed.length,
    failed: progress.errors.length,
    startedAt: now,
    updatedAt: now,
    target: "audio",
  };
}

export function normalizeImageUpload(progress: ImageUploadProgress, now: number): Activity {
  return {
    id: `image-upload:${progress.id}`,
    kind: "image-upload",
    status: collapseStatus(progress.status),
    label: progress.filename,
    progress: progress.progress,
    error: progress.error,
    startedAt: now,
    updatedAt: now,
    target: "images",
  };
}

/**
 * `MP3DownloadProgress` reports bytes, not a percentage — and `bytesTotal`
 * starts at 0 before the response headers arrive, so a naive divide would
 * flash 0/0 = NaN% for an instant on every download.
 */
export function normalizeHymnMp3(progress: MP3DownloadProgress, now: number): Activity {
  return {
    id: `hymn-mp3:${progress.hymnNumber}`,
    kind: "hymn-mp3",
    status: collapseStatus(progress.status),
    label: progress.hymnNumber,
    progress:
      progress.bytesTotal > 0
        ? (progress.bytesDownloaded / progress.bytesTotal) * 100
        : null,
    error: progress.error,
    startedAt: now,
    updatedAt: now,
    target: "hymns",
  };
}

/**
 * No `label` on purpose — there's no single hymn name to show for a bulk row,
 * and the count/done/failed triple is structured data the UI sentence
 * ("Downloading 47 hymn MP3s — 12 done") is built from via `getTranslations`.
 */
export const BULK_MP3_ID = "hymn-mp3:bulk";
/** More than this many `hymn-mp3` rows at once collapse into one row. */
export const BULK_MP3_THRESHOLD = 3;

function isLive(a: Activity): boolean {
  return a.status === "pending" || a.status === "running";
}

/**
 * `downloadAllMissingMP3s` emits "queued" for every missing hymn up front and
 * then one stream per hymn, so a bulk run produces hundreds of rows — and a
 * failed disk-space check produces hundreds of *errors* at once. Collapse
 * every `hymn-mp3` row into one synthetic row whenever there are more than
 * `BULK_MP3_THRESHOLD` of them, whatever their status.
 *
 * The counts stay accurate across a long run because `pruneActivities` keeps
 * completed MP3 rows while any MP3 is still live, and fades them as a batch.
 */
export function groupHymnMp3Activities(activities: Activity[]): Activity[] {
  const mp3s = activities.filter((a) => a.kind === "hymn-mp3");
  if (mp3s.length <= BULK_MP3_THRESHOLD) return activities;

  const others = activities.filter((a) => a.kind !== "hymn-mp3");
  const done = mp3s.filter((a) => a.status === "complete").length;
  const failed = mp3s.filter((a) => a.status === "error").length;
  const status: ActivityStatus = mp3s.some(isLive)
    ? "running"
    : failed > 0
      ? "error"
      : "complete";

  const grouped: Activity = {
    id: BULK_MP3_ID,
    kind: "hymn-mp3",
    status,
    label: "",
    progress: ((done + failed) / mp3s.length) * 100,
    grouped: { count: mp3s.length, done, failed },
    startedAt: Math.min(...mp3s.map((a) => a.startedAt)),
    updatedAt: Math.max(...mp3s.map((a) => a.updatedAt)),
    target: "hymns",
  };

  return [...others, grouped];
}

/** Dismissing the synthetic bulk row dismisses every MP3 row it stands for. */
export function dismissActivity(list: Activity[], id: string): Activity[] {
  if (id === BULK_MP3_ID) return list.filter((a) => a.kind !== "hymn-mp3");
  return list.filter((a) => a.id !== id);
}

export function normalizeTransferUpload(
  progress: TransferUploadProgress,
  now: number,
): Activity {
  return {
    id: `transfer:${progress.id}`,
    kind: "transfer",
    status: collapseStatus(progress.status),
    label: progress.filename,
    progress: progress.progress,
    error: progress.error,
    startedAt: now,
    updatedAt: now,
    target: "transfer",
  };
}

function collapseBibleTranslationStatus(
  status: BibleTranslationStatus["status"],
): ActivityStatus {
  if (status === "downloading") return "running";
  if (status === "ready") return "complete";
  return "error";
}

export function normalizeBibleTranslation(
  payload: BibleTranslationStatus,
  now: number,
): Activity {
  return {
    id: `bible-translation:${payload.translationId}`,
    kind: "bible-translation",
    status: collapseBibleTranslationStatus(payload.status),
    label: payload.translationId,
    progress: payload.progress ?? null,
    error: payload.error,
    startedAt: now,
    updatedAt: now,
    target: "bible",
  };
}

/**
 * Upsert by id. A repeated update for the same operation keeps its original
 * `startedAt` (so "running for 40s" stays accurate) while every other field,
 * including `updatedAt`, comes from the latest normalized activity.
 */
export function applyActivity(list: Activity[], activity: Activity, now: number): Activity[] {
  const index = list.findIndex((a) => a.id === activity.id);
  if (index === -1) return [...list, activity];
  const updated = [...list];
  updated[index] = { ...activity, startedAt: list[index].startedAt, updatedAt: now };
  return updated;
}

/** Completed rows fade after this long. Errors persist until dismissed. */
export const ACTIVITY_FADE_MS = 8000;

/**
 * Completed hymn MP3s are the exception: they're kept while any MP3 is still
 * live, then fade together, so the bulk row's done/total stays true for the
 * whole run instead of shrinking as early finishers expire.
 */
export function pruneActivities(list: Activity[], now: number): Activity[] {
  const mp3s = list.filter((a) => a.kind === "hymn-mp3");
  const mp3Live = mp3s.some(isLive);
  const mp3LastUpdate = Math.max(0, ...mp3s.map((a) => a.updatedAt));

  return list.filter((a) => {
    if (a.status !== "complete") return true;
    if (a.kind === "hymn-mp3") {
      return mp3Live || now - mp3LastUpdate < ACTIVITY_FADE_MS;
    }
    return now - a.updatedAt < ACTIVITY_FADE_MS;
  });
}

/**
 * Transient schedule events (`triggered | skipped | missed | deleted`) for
 * the Upcoming section. `ScheduleEvent` already carries everything a row
 * needs (`type`, the full `schedule`, `timestamp`), so this mirrors
 * `recentEvents` in `useAudioScheduler.ts` — a capped, time-pruned buffer of
 * the type itself — rather than inventing a parallel shape.
 */
export const SCHEDULE_EVENT_LIMIT = 10;
export const SCHEDULE_EVENT_TTL_MS = 5000;

export function pushScheduleEvent(
  list: ScheduleEvent[],
  event: ScheduleEvent,
  limit = SCHEDULE_EVENT_LIMIT,
): ScheduleEvent[] {
  return [event, ...list].slice(0, limit);
}

export function pruneScheduleEvents(
  list: ScheduleEvent[],
  now: number,
  ttlMs = SCHEDULE_EVENT_TTL_MS,
): ScheduleEvent[] {
  return list.filter((event) => now - event.timestamp < ttlMs);
}

/** Enabled schedules with a future run, soonest first, capped to `limit`. */
export function getUpcomingSchedules(
  schedules: AudioSchedule[],
  limit = 3,
): AudioSchedule[] {
  return schedules
    .filter((s) => s.enabled && s.nextRunAt !== null)
    .sort((a, b) => (a.nextRunAt ?? 0) - (b.nextRunAt ?? 0))
    .slice(0, limit);
}
