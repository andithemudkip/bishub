import type { DisplayMode, LayerKind } from "../../../shared/types";
import type { ActivityTarget } from "../../../shared/stage.types";

/** Sections the rail can open the panel to. */
export type StageSection = "preview" | "loaded" | "volume" | "activity" | "comingUp";

/** Display actions the Stage offers — all existing `useRemoteAPI` methods. */
export interface StageActions {
  setMode: (mode: DisplayMode) => void;
  clearLayer: (kind: LayerKind) => void;
  playAudio: () => void;
  pauseAudio: () => void;
  stopAudio: () => void;
  /** Seconds into the loaded audio. */
  seekAudio: (time: number) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  /** Seconds into the loaded video. */
  seekVideo: (time: number) => void;
  /** 0–1, like `VideoState.volume` / `AudioState.volume`. */
  setVideoVolume: (volume: number) => void;
  setAudioVolume: (volume: number) => void;
}

export type NavigateTo = (page: ActivityTarget) => void;
