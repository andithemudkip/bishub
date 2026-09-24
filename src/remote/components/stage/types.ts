import type { DisplayMode, LayerKind } from "../../../shared/types";
import type { ActivityTarget } from "../../../shared/stage.types";

/** Sections the rail can open the panel to. */
export type StageSection = "preview" | "loaded" | "activity" | "comingUp";

/** Display actions the Stage offers — all existing `useRemoteAPI` methods. */
export interface StageActions {
  setMode: (mode: DisplayMode) => void;
  clearLayer: (kind: LayerKind) => void;
  playAudio: () => void;
  pauseAudio: () => void;
  stopAudio: () => void;
}

export type NavigateTo = (page: ActivityTarget) => void;
