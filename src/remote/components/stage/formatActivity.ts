import type { Translations } from "../../../shared/i18n";
import type { Activity } from "../../../shared/stage.types";
import { getTranslationById } from "../../../shared/bibleTranslations";

/**
 * `Activity` carries structured data, not UI copy (see stage.types.ts) — this
 * is where it becomes text, in the operator's language.
 */
export function activityTitle(activity: Activity, t: Translations): string {
  if (activity.grouped) return t.stage.hymnMp3Bulk;
  switch (activity.kind) {
    case "hymn-mp3":
      return t.stage.hymnMp3.replace("{n}", activity.label.replace(/^0+(?=\d)/, ""));
    case "bible-translation":
      return getTranslationById(activity.label)?.name ?? activity.label;
    case "audio-import":
      // A directory path; its last segment is what the operator picked.
      return activity.label.split(/[\\/]/).filter(Boolean).pop() ?? activity.label;
    default:
      return activity.label;
  }
}

export function activityDetail(activity: Activity, t: Translations): string {
  const { grouped } = activity;
  if (grouped) {
    const progress = t.stage.bulkProgress
      .replace("{done}", String(grouped.done))
      .replace("{count}", String(grouped.count));
    return grouped.failed > 0
      ? `${progress} · ${t.stage.bulkFailed.replace("{n}", String(grouped.failed))}`
      : progress;
  }

  switch (activity.status) {
    case "pending":
      return t.stage.queued;
    case "error":
      return activity.error || t.stage.failed;
    case "complete":
      if (activity.kind === "audio-import") {
        return t.stage.importSummary
          .replace("{ok}", String(activity.succeeded ?? 0))
          .replace("{failed}", String(activity.failed ?? 0));
      }
      return t.stage.done;
    case "running":
      if (activity.stage) return t.youtubeDownload[activity.stage];
      if (activity.current !== undefined && activity.total) {
        return `${activity.current} / ${activity.total}`;
      }
      if (activity.progress !== null) {
        return activity.progress >= 100
          ? t.stage.processing
          : `${Math.round(activity.progress)}%`;
      }
      return "";
  }
}

export function isUpload(activity: Activity): boolean {
  return (
    activity.kind === "video-upload" ||
    activity.kind === "audio-upload" ||
    activity.kind === "image-upload" ||
    activity.kind === "transfer"
  );
}
