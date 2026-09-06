// Pure scheduling helpers shared by the main process (which fires schedules)
// and the remote UI (which previews and describes them). Keep this free of
// Electron/DOM imports so both sides can use it.
import type { AudioSchedule, ScheduleRepeat } from "./audioSchedule.types";
import type { Translations } from "./i18n";

/** Display order for weekday pickers — Monday first, Sunday last. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Only the fields needed to work out when a schedule fires. */
export type ScheduleTiming = {
  repeat: ScheduleRepeat;
  hour: number;
  minute: number;
  daysOfWeek?: number[];
};

function sanitizeDays(days: number[] | undefined): number[] {
  if (!days) return [];
  return [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
}

/**
 * The next moment this schedule should fire, at or after `from`.
 * Uses local wall-clock arithmetic so a 10:25 schedule stays at 10:25 across DST.
 */
export function nextRunFor(timing: ScheduleTiming, from: number): number | null {
  const days = sanitizeDays(timing.daysOfWeek);
  const candidate = new Date(from);
  candidate.setHours(timing.hour, timing.minute, 0, 0);
  if (candidate.getTime() < from) {
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(timing.hour, timing.minute, 0, 0);
  }

  if (timing.repeat !== "weekly" || days.length === 0) return candidate.getTime();

  // Walk forward at most a week looking for an allowed weekday.
  for (let i = 0; i < 7; i++) {
    if (days.includes(candidate.getDay())) return candidate.getTime();
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(timing.hour, timing.minute, 0, 0);
  }
  return null;
}

/** "10:25" — 24-hour, zero padded. Matches what `<input type="time">` shows. */
export function formatClock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Whole days between two timestamps, by calendar day rather than elapsed hours. */
function calendarDaysApart(from: number, to: number): number {
  const a = new Date(from);
  const b = new Date(to);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Human summary of when a schedule fires: "Every Saturday at 10:25". */
export function describeSchedule(
  timing: ScheduleTiming,
  t: Translations,
  nextRunAt?: number | null,
  now: number = Date.now()
): string {
  const time = formatClock(timing.hour, timing.minute);
  const s = t.audioSchedule;

  if (timing.repeat === "daily") {
    return s.everyDayAt.replace("{time}", time);
  }

  if (timing.repeat === "weekly") {
    const days = sanitizeDays(timing.daysOfWeek);
    if (days.length === 0 || days.length === 7) {
      return s.everyDayAt.replace("{time}", time);
    }
    const names = WEEKDAY_ORDER.filter((d) => days.includes(d)).map((d) => s.weekdaysLong[d]);
    return s.everyDaysAt.replace("{days}", names.join(", ")).replace("{time}", time);
  }

  // Once — anchor it to a day the user can recognise. An explicit null means
  // the schedule isn't armed (paused, or already fired), and naming a day it
  // will not actually run would contradict the "paused" badge next to it;
  // undefined means "work it out for me", which the form preview relies on.
  const target = nextRunAt === undefined ? nextRunFor(timing, now) : nextRunAt;
  if (target === null) return s.onceAt.replace("{time}", time);
  const dayOffset = calendarDaysApart(now, target);
  if (dayOffset <= 0) return s.todayAt.replace("{time}", time);
  if (dayOffset === 1) return s.tomorrowAt.replace("{time}", time);
  return s.dayAt.replace("{day}", s.weekdaysLong[new Date(target).getDay()]).replace("{time}", time);
}

/** Countdown to the next run: "2 d 4 h", "3 h 12 m", "8 m", "42 s". */
export function formatTimeUntil(ms: number, t: Translations): string {
  const s = t.audioSchedule;
  if (ms <= 0) return s.dueNow;

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}${s.unitDay} ${hours}${s.unitHour}`;
  if (hours > 0) return `${hours}${s.unitHour} ${minutes}${s.unitMinute}`;
  if (minutes > 0) return `${minutes}${s.unitMinute}`;
  return `${seconds}${s.unitSecond}`;
}

/** Enabled schedules first, soonest run at the top; disabled ones after. */
export function sortSchedules(schedules: AudioSchedule[]): AudioSchedule[] {
  return [...schedules].sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    const aNext = a.nextRunAt ?? Number.MAX_SAFE_INTEGER;
    const bNext = b.nextRunAt ?? Number.MAX_SAFE_INTEGER;
    if (aNext !== bNext) return aNext - bNext;
    return a.createdAt - b.createdAt;
  });
}

export { sanitizeDays };
