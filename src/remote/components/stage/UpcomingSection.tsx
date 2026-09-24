import type { Translations } from "../../../shared/i18n";
import type { AudioSchedule, ScheduleEvent } from "../../../shared/audioSchedule.types";
import { formatTimeAgo, formatTimeUntil } from "../../../shared/utils";
import { ClockIcon, MusicNoteIcon } from "../icons/ui";
import { Section } from "./Section";
import type { NavigateTo } from "./types";
import { useNow } from "./useNow";

interface Props {
  schedules: AudioSchedule[];
  recentEvents: ScheduleEvent[];
  onNavigate: NavigateTo;
  t: Translations;
}

/**
 * Scheduled audio, which otherwise lives in the Audio page's third tab —
 * without this you'd have no idea the app is about to start playing at 09:45.
 * A schedule whose last run went wrong says so, and one firing right now
 * shows as a brief event row.
 */
export function UpcomingSection({ schedules, recentEvents, onNavigate, t }: Props) {
  // Re-render so the "in 14m" labels below keep moving.
  useNow(schedules.length > 0);

  const events = recentEvents.filter(
    (e) => e.type === "triggered" || e.type === "skipped" || e.type === "missed"
  );
  if (schedules.length === 0 && events.length === 0) return null;

  const eventLabel: Record<string, string> = {
    triggered: t.stage.scheduleStarted,
    skipped: t.stage.scheduleSkipped,
    missed: t.stage.scheduleMissed,
  };

  return (
    <Section section="comingUp" title={t.stage.comingUp}>
      <ul className="space-y-1.5">
        {events.map((event) => (
          <li
            key={`${event.schedule.id}:${event.timestamp}`}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border bg-blue-950/20 border-blue-500/30 text-sm"
          >
            <MusicNoteIcon className="w-4 h-4 flex-shrink-0 text-blue-400" />
            <span className="flex-1 min-w-0 truncate">
              {event.schedule.label || event.schedule.audioName}
            </span>
            <span className="text-xs text-blue-300">{eventLabel[event.type]}</span>
          </li>
        ))}
        {schedules.map((schedule) => {
          const warning = lastRunWarning(schedule, t);
          return (
            <li key={schedule.id}>
              <button
                onClick={() => onNavigate("audio")}
                className="w-full flex items-start gap-2 px-2.5 py-1.5 text-left bg-gray-900/50 border border-gray-700/30 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <ClockIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">
                    {schedule.label || schedule.audioName}
                  </div>
                  {warning && (
                    <div className="text-xs text-amber-400/90 truncate">{warning}</div>
                  )}
                </div>
                <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap mt-0.5">
                  {schedule.nextRunAt !== null && formatTimeUntil(schedule.nextRunAt, t.common)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** A schedule that silently failed last Sunday is exactly what this section is for. */
function lastRunWarning(schedule: AudioSchedule, t: Translations): string | null {
  if (!schedule.lastRunAt) return null;
  const time = formatTimeAgo(schedule.lastRunAt, t.common);
  switch (schedule.lastStatus) {
    case "missed":
      return t.audioSchedule.lastMissed.replace("{time}", time);
    case "skipped":
      return t.audioSchedule.lastSkipped.replace("{time}", time);
    case "unavailable":
      return t.audioSchedule.lastUnavailable.replace("{time}", time);
    default:
      return null;
  }
}
