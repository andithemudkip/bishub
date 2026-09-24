import { useMemo, type ReactNode } from "react";
import type { AppSettings, MonitorInfo } from "../../../shared/types";
import { useActivity } from "../../useActivity";
import { useSystemHealth } from "../../useSystemHealth";
import { StageContext, type StageData } from "./stageContext";

interface Props {
  settings: AppSettings;
  /** null until the first list arrives. */
  monitors: MonitorInfo[] | null;
  children: ReactNode;
}

/**
 * Owns the Stage's subscriptions once, for the desktop dock and the mobile
 * chip and sheet alike. `children` keep their identity when this re-renders,
 * so a progress tick updates only the Stage's consumers — not the page.
 */
export function StageProvider({ settings, monitors, children }: Props) {
  const { activities, dismiss, upcomingSchedules, recentScheduleEvents } = useActivity();
  const { displayWindowOpen, monitorMissing } = useSystemHealth(settings, monitors);

  const value = useMemo<StageData>(
    () => ({
      activities,
      dismiss,
      upcomingSchedules,
      recentScheduleEvents,
      displayWindowOpen,
      monitorMissing,
      health: displayWindowOpen === false ? "error" : monitorMissing ? "warning" : "ok",
    }),
    [
      activities,
      dismiss,
      upcomingSchedules,
      recentScheduleEvents,
      displayWindowOpen,
      monitorMissing,
    ]
  );

  return <StageContext.Provider value={value}>{children}</StageContext.Provider>;
}
