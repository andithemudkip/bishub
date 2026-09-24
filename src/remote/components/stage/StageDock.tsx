import { useCallback, useState } from "react";
import type { DisplayState, AppSettings } from "../../../shared/types";
import { getTranslations } from "../../../shared/i18n";
import { StagePanel } from "./StagePanel";
import { StageRail } from "./StageRail";
import { StageSections } from "./StageSections";
import { StageFooter } from "./StageFooter";
import { useStage } from "./stageContext";
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
  connectedDeviceCount: number;
  actions: StageActions;
  onNavigate: NavigateTo;
  preview: PreviewControls;
}

/** The desktop Stage: open panel or collapsed rail. */
export function StageDock({
  state,
  settings,
  connectedDeviceCount,
  actions,
  onNavigate,
  preview,
}: Props) {
  const t = getTranslations(settings.language);
  const { activities, upcomingSchedules, health } = useStage();
  const [focusSection, setFocusSection] = useState<StageSection | null>(null);
  const clearFocus = useCallback(() => setFocusSection(null), []);

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

  return (
    <StagePanel
      t={t}
      width={preview.panelWidth}
      isResizing={preview.isResizing}
      onCollapse={preview.toggle}
      onWidthChange={preview.setWidth}
      onResizeStart={preview.startResize}
      onResizeEnd={preview.endResize}
      focusSection={focusSection}
      onFocusHandled={clearFocus}
      footer={
        <StageFooter
          serverPort={settings.serverPort}
          connectedDeviceCount={connectedDeviceCount}
          t={t}
        />
      }
    >
      <StageSections
        state={state}
        settings={settings}
        t={t}
        actions={actions}
        onNavigate={onNavigate}
        variant="panel"
      />
    </StagePanel>
  );
}
