import type { Activity } from "../../../shared/stage.types";
import type { AudioSchedule } from "../../../shared/audioSchedule.types";

/** A schedule this close shows on the rail and the mobile chip. */
const SOON_MS = 30 * 60_000;

/** The next schedule if it's due within half an hour, else null. */
export function soonSchedule(
  upcoming: AudioSchedule[],
  now: number
): (AudioSchedule & { nextRunAt: number }) | null {
  const next = upcoming[0];
  if (!next || next.nextRunAt === null) return null;
  return next.nextRunAt - now <= SOON_MS ? { ...next, nextRunAt: next.nextRunAt } : null;
}

/** Mean progress of the running activities that report one, or null if none do. */
export function aggregateProgress(activities: Activity[]): number | null {
  const measured = activities.filter((a) => a.status === "running" && a.progress !== null);
  if (measured.length === 0) return null;
  return measured.reduce((sum, a) => sum + (a.progress ?? 0), 0) / measured.length;
}

/**
 * What the activity list amounts to at a glance. Completed rows linger for a
 * few seconds before fading; with nothing still running they read as "done",
 * not as an indeterminate spinner.
 */
export function activitySummary(activities: Activity[]): "error" | "running" | "done" | null {
  if (activities.length === 0) return null;
  if (activities.some((a) => a.status === "error")) return "error";
  if (activities.some((a) => a.status === "running" || a.status === "pending")) return "running";
  return "done";
}
