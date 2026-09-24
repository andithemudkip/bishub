import { useEffect, useState, type ReactNode } from "react";
import type { DisplayState } from "../../../shared/types";
import type { Translations } from "../../../shared/i18n";
import type { Activity } from "../../../shared/stage.types";
import type { AudioSchedule } from "../../../shared/audioSchedule.types";
import { formatTimeUntil } from "../../../shared/utils";
import {
  ExpandLeftIcon,
  MusicNoteIcon,
  ClockIcon,
  WarningIcon,
  ProgressRingIcon,
  CheckIcon,
} from "../icons/ui";
import type { StageSection } from "./types";
import { activitySummary, aggregateProgress, soonSchedule } from "./stageStatus";

interface Props {
  state: DisplayState;
  t: Translations;
  activities: Activity[];
  upcomingSchedules: AudioSchedule[];
  health: "ok" | "warning" | "error";
  onOpen: (section: StageSection | null) => void;
}

const MODE_DOT: Record<DisplayState["mode"], string> = {
  idle: "bg-gray-600",
  text: "bg-blue-400",
  image: "bg-purple-400",
  video: "bg-green-400",
};

/**
 * The collapsed Stage: a strip of status icons instead of nothing. Each icon
 * appears only when it has something to say, and opens the panel at its
 * section.
 */
export function StageRail({ state, t, activities, upcomingSchedules, health, onOpen }: Props) {
  const next = upcomingSchedules[0];
  const nextSoon = soonSchedule(upcomingSchedules, Date.now());

  // Keep the "in 14m" label moving while a schedule is close.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!next) return;
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [next]);

  const summary = activitySummary(activities);

  return (
    <div className="h-full w-12 flex-shrink-0 bg-gray-800 border-l border-gray-700 flex flex-col items-center gap-1 py-2">
      <RailButton label={t.stage.open} onClick={() => onOpen(null)}>
        <ExpandLeftIcon className="w-4 h-4" />
      </RailButton>

      <RailButton label={t.stage.title} onClick={() => onOpen("preview")}>
        <span className={`w-2.5 h-2.5 rounded-full ${MODE_DOT[state.mode]}`} />
      </RailButton>

      {health !== "ok" && (
        <RailButton label={t.stage.railHealth} onClick={() => onOpen("preview")}>
          <WarningIcon
            className={`w-5 h-5 ${health === "error" ? "text-red-400" : "text-amber-400"}`}
          />
        </RailButton>
      )}

      {state.audio.src && (
        <RailButton label={t.stage.railAudio} onClick={() => onOpen("loaded")}>
          <MusicNoteIcon
            className={`w-5 h-5 ${state.audio.playing ? "text-blue-400" : "text-gray-500"}`}
          />
        </RailButton>
      )}

      {summary && (
        <RailButton label={t.stage.railActivity} onClick={() => onOpen("activity")}>
          {summary === "error" ? (
            <WarningIcon className="w-5 h-5 text-red-400" />
          ) : summary === "done" ? (
            <CheckIcon className="w-5 h-5 text-green-400" />
          ) : (
            <ProgressRingIcon
              className="w-5 h-5 text-blue-400"
              progress={aggregateProgress(activities)}
            />
          )}
        </RailButton>
      )}

      {nextSoon && (
        <RailButton label={t.stage.railSchedule} onClick={() => onOpen("comingUp")}>
          <span className="flex flex-col items-center leading-none text-amber-300">
            <ClockIcon className="w-5 h-5" />
            <span className="mt-0.5 text-[9px] tabular-nums">
              {formatTimeUntil(nextSoon.nextRunAt, t.common)}
            </span>
          </span>
        </RailButton>
      )}
    </div>
  );
}

function RailButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-10 min-h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
    >
      {children}
    </button>
  );
}
