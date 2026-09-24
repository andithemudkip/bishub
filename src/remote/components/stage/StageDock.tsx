import { useCallback, useMemo, useState } from "react";
import type { DisplayState, AppSettings, MonitorInfo } from "../../../shared/types";
import { getTranslations } from "../../../shared/i18n";
import { getLoadedLayers } from "../../../shared/stage";
import { useActivity } from "../../useActivity";
import { useSystemHealth } from "../../useSystemHealth";
import { StagePanel } from "./StagePanel";
import { StageRail } from "./StageRail";
import { HealthBanner } from "./HealthBanner";
import { LoadedSection } from "./LoadedSection";
import { ActivitySection } from "./ActivitySection";
import { UpcomingSection } from "./UpcomingSection";
import { StageFooter } from "./StageFooter";
import type { NavigateTo, StageActions, StageSection } from "./types";

interface PreviewControls {
  isOpen: boolean;
  panelWidth: number;
  isResizing: boolean;
  toggle: () => void;
  open: () => void;
  setWidth: (width: number) => void;
  startResize: () => void;
  endResize: () => void;
}

interface Props {
  state: DisplayState;
  settings: AppSettings;
  /** null until the first list arrives. */
  monitors: MonitorInfo[] | null;
  connectedDeviceCount: number;
  actions: StageActions;
  onNavigate: NavigateTo;
  preview: PreviewControls;
}

/**
 * The desktop Stage: open panel or collapsed rail. It owns the Stage's
 * subscriptions so that a progress tick re-renders this dock, not the page
 * beside it.
 */
export function StageDock({
  state,
  settings,
  monitors,
  connectedDeviceCount,
  actions,
  onNavigate,
  preview,
}: Props) {
  const t = getTranslations(settings.language);
  const { activities, dismiss, upcomingSchedules, recentScheduleEvents } = useActivity();
  const { displayWindowOpen, monitorMissing } = useSystemHealth(settings, monitors);
  const layers = useMemo(() => getLoadedLayers(state), [state]);
  const [focusSection, setFocusSection] = useState<StageSection | null>(null);
  const clearFocus = useCallback(() => setFocusSection(null), []);

  const health =
    displayWindowOpen === false ? "error" : monitorMissing ? "warning" : "ok";

  if (!preview.isOpen) {
    return (
      <StageRail
        state={state}
        t={t}
        activities={activities}
        upcomingSchedules={upcomingSchedules}
        health={health}
        onOpen={(section) => {
          preview.open();
          setFocusSection(section);
        }}
      />
    );
  }

  const isEmpty =
    layers.length === 0 &&
    activities.length === 0 &&
    upcomingSchedules.length === 0 &&
    recentScheduleEvents.length === 0;

  return (
    <StagePanel
      state={state}
      settings={settings}
      t={t}
      width={preview.panelWidth}
      isResizing={preview.isResizing}
      onCollapse={preview.toggle}
      onWidthChange={preview.setWidth}
      onResizeStart={preview.startResize}
      onResizeEnd={preview.endResize}
      focusSection={focusSection}
      onFocusHandled={clearFocus}
      isEmpty={isEmpty}
      banner={
        <HealthBanner
          displayWindowOpen={displayWindowOpen}
          monitorMissing={monitorMissing}
          t={t}
        />
      }
      footer={
        <StageFooter
          serverPort={settings.serverPort}
          connectedDeviceCount={connectedDeviceCount}
          t={t}
        />
      }
    >
      <LoadedSection
        layers={layers}
        state={state}
        actions={actions}
        onNavigate={onNavigate}
        t={t}
      />
      <ActivitySection
        activities={activities}
        onDismiss={dismiss}
        onNavigate={onNavigate}
        t={t}
      />
      <UpcomingSection
        schedules={upcomingSchedules}
        recentEvents={recentScheduleEvents}
        onNavigate={onNavigate}
        t={t}
      />
    </StagePanel>
  );
}
