import { useCallback, useMemo, useState, type ReactNode } from "react";
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
  const [acknowledgedErrors, setAcknowledgedErrors] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const acknowledgeErrors = useCallback((keys: string[]) => {
    setAcknowledgedErrors((prev) => {
      if (keys.every((k) => prev.has(k))) return prev;
      return new Set([...prev, ...keys]);
    });
  }, []);

  const value = useMemo<StageData>(
    () => ({
      activities,
      dismiss,
      upcomingSchedules,
      recentScheduleEvents,
      displayWindowOpen,
      monitorMissing,
      health: displayWindowOpen === false ? "error" : monitorMissing ? "warning" : "ok",
      acknowledgedErrors,
      acknowledgeErrors,
    }),
    [
      activities,
      dismiss,
      upcomingSchedules,
      recentScheduleEvents,
      displayWindowOpen,
      monitorMissing,
      acknowledgedErrors,
      acknowledgeErrors,
    ]
  );

  return <StageContext.Provider value={value}>{children}</StageContext.Provider>;
}
