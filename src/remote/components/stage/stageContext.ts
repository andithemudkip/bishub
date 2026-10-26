import { createContext, useContext } from "react";
import type { Activity } from "../../../shared/stage.types";
import type { AudioSchedule, ScheduleEvent } from "../../../shared/audioSchedule.types";

/** Everything the Stage shows beyond `DisplayState`, from one set of subscriptions. */
export interface StageData {
  activities: Activity[];
  dismiss: (id: string) => void;
  upcomingSchedules: AudioSchedule[];
  recentScheduleEvents: ScheduleEvent[];
  displayWindowOpen: boolean | null;
  monitorMissing: boolean;
  /** error: display window closed · warning: configured monitor missing. */
  health: "ok" | "warning" | "error";
  /** Failures already seen on their page (`errorKey`), which no longer badge. */
  acknowledgedErrors: ReadonlySet<string>;
  acknowledgeErrors: (keys: string[]) => void;
  /** Resolution of the monitor the display window is on; null until monitors arrive. */
  displaySize: DisplaySize | null;
}

export interface DisplaySize {
  width: number;
  height: number;
}

/** What the preview assumes before the monitor list arrives (or outside the Stage). */
export const DEFAULT_DISPLAY_SIZE: DisplaySize = { width: 1920, height: 1080 };

export const StageContext = createContext<StageData | null>(null);

export function useStage(): StageData {
  const data = useContext(StageContext);
  if (!data) throw new Error("useStage must be used inside <StageProvider>");
  return data;
}

/**
 * Size the display renders at, for previews that replicate it. Unlike
 * `useStage` it works outside `<StageProvider>` (falling back to 1080p), so a
 * preview can be rendered on its own.
 */
export function useDisplaySize(): DisplaySize {
  return useContext(StageContext)?.displaySize ?? DEFAULT_DISPLAY_SIZE;
}
