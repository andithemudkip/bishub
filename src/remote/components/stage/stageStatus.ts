import type { Activity, ActivityTarget } from "../../../shared/stage.types";
import type { AudioSchedule } from "../../../shared/audioSchedule.types";

/** A schedule this close shows on the rail and the mobile chip. */
const SOON_MS = 30 * 60_000;

/** The next schedule if it's due within `windowMs` (half an hour by default), else null. */
export function soonSchedule(
  upcoming: AudioSchedule[],
  now: number,
  windowMs = SOON_MS
): (AudioSchedule & { nextRunAt: number }) | null {
  const next = upcoming[0];
  if (!next || next.nextRunAt === null) return null;
  return next.nextRunAt - now <= windowMs ? { ...next, nextRunAt: next.nextRunAt } : null;
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

export type NavBadge =
  | { kind: "error" }
  | { kind: "progress"; progress: number | null }
  | { kind: "schedule"; minutes: number };

/** Operations shorter than this never badge — a quick upload shouldn't flash a ring. */
const BADGE_DELAY_MS = 2000;
/** A schedule this close puts a countdown on the Audio icon. */
const BADGE_SCHEDULE_MS = 10 * 60_000;

/**
 * Identifies one failure, so seeing it on its page acknowledges exactly that
 * one: a retry that fails again gets a new `updatedAt`, and a new dot.
 */
export function errorKey(activity: Activity): string {
  return `${activity.id}@${activity.updatedAt}`;
}

/**
 * The badge for a nav item covering `pages` (one page, or everything behind
 * the mobile More button). Unseen failure beats running work beats an
 * imminent schedule; nothing shows for work that's only just started.
 */
export function navBadge(
  pages: readonly ActivityTarget[],
  activities: Activity[],
  upcoming: AudioSchedule[],
  acknowledged: ReadonlySet<string>,
  now: number
): NavBadge | null {
  const mine = activities.filter((a) => pages.includes(a.target));
  if (mine.some((a) => a.status === "error" && !acknowledged.has(errorKey(a)))) {
    return { kind: "error" };
  }
  const running = mine.filter(
    (a) =>
      (a.status === "running" || a.status === "pending") && now - a.startedAt >= BADGE_DELAY_MS
  );
  if (running.length > 0) return { kind: "progress", progress: aggregateProgress(running) };
  if (pages.includes("audio")) {
    const soon = soonSchedule(upcoming, now, BADGE_SCHEDULE_MS);
    if (soon) {
      return { kind: "schedule", minutes: Math.max(1, Math.ceil((soon.nextRunAt - now) / 60_000)) };
    }
  }
  return null;
}
