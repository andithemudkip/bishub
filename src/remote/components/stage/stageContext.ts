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
}

export const StageContext = createContext<StageData | null>(null);

export function useStage(): StageData {
  const data = useContext(StageContext);
  if (!data) throw new Error("useStage must be used inside <StageProvider>");
  return data;
}
