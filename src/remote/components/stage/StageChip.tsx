import type { DisplayState } from "../../../shared/types";
import type { Translations } from "../../../shared/i18n";
import { formatTimeUntil } from "../../../shared/utils";
import { WarningIcon, ProgressRingIcon, MusicNoteIcon, ClockIcon, CheckIcon } from "../icons/ui";
import { useStage } from "./stageContext";
import { activitySummary, aggregateProgress, soonSchedule } from "./stageStatus";
import { useNow } from "./useNow";

interface Props {
  state: DisplayState;
  t: Translations;
  onOpen: () => void;
}

/**
 * The phone's way into the Stage. It sits in the header row's spare space,
 * so it costs no height: always there while idle ("Idle", which also opens
 * the preview), and while presenting only when there's something to report.
 * The icon is the single most important thing going on.
 */
export function StageChip({ state, t, onOpen }: Props) {
  const { activities, upcomingSchedules, health } = useStage();
  const isIdle = state.mode === "idle";
  const now = useNow(upcomingSchedules.length > 0);
  const soon = soonSchedule(upcomingSchedules, now);

  const summary = activitySummary(activities);
  let status = null;
  if (health === "error" || summary === "error") {
    status = <WarningIcon className="w-5 h-5 text-red-400" />;
  } else if (health === "warning") {
    status = <WarningIcon className="w-5 h-5 text-amber-400" />;
  } else if (summary === "running") {
    status = (
      <ProgressRingIcon className="w-5 h-5 text-blue-400" progress={aggregateProgress(activities)} />
    );
  } else if (summary === "done") {
    status = <CheckIcon className="w-5 h-5 text-green-400" />;
  } else if (state.audio.playing) {
    status = <MusicNoteIcon className="w-5 h-5 text-blue-400" />;
  } else if (soon) {
    status = (
      <span className="flex items-center gap-1 text-amber-300 text-xs tabular-nums">
        <ClockIcon className="w-4 h-4" />
        {formatTimeUntil(soon.nextRunAt, t.common)}
      </span>
    );
  }

  if (!isIdle && !status) return null;

  return (
    <button
      onClick={onOpen}
      aria-label={t.stage.open}
      className="md:hidden min-h-11 min-w-11 px-3 flex items-center justify-center gap-2 flex-shrink-0 rounded-lg bg-gray-800/50 border border-gray-700/50 text-sm text-gray-300 active:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
    >
      {isIdle && (
        <>
          <span className="w-2 h-2 rounded-full bg-gray-500" />
          <span>{t.status.idle}</span>
        </>
      )}
      {status}
    </button>
  );
}
