import { useMemo, type ReactNode } from "react";
import type { DisplayState, AppSettings } from "../../../shared/types";
import type { Translations } from "../../../shared/i18n";
import { getLoadedLayers } from "../../../shared/stage";
import LivePreview from "../preview/LivePreview";
import { HealthBanner } from "./HealthBanner";
import { LoadedSection } from "./LoadedSection";
import { VolumeSection } from "./VolumeSection";
import { ActivitySection } from "./ActivitySection";
import { UpcomingSection } from "./UpcomingSection";
import { Transport } from "./Transport";
import { useStage } from "./stageContext";
import type { NavigateTo, StageActions } from "./types";

interface Props {
  state: DisplayState;
  settings: AppSettings;
  t: Translations;
  actions: StageActions;
  onNavigate: NavigateTo;
  /**
   * panel (desktop): full preview while presenting, a compact row while idle.
   * sheet (mobile): the real preview is already atop the screen while
   * presenting, so only the idle preview — full width — appears here, or the
   * video transport while a video is showing.
   */
  variant: "panel" | "sheet";
}

/** The Stage's content, shared by the desktop panel and the mobile sheet. */
export function StageSections({ state, settings, t, actions, onNavigate, variant }: Props) {
  const stage = useStage();
  const layers = useMemo(() => getLoadedLayers(state), [state]);
  const isIdle = state.mode === "idle";
  const videoTransport =
    state.mode === "video" && state.video.src ? (
      <div className="bg-gray-900/50 border border-gray-700/30 rounded-lg px-1 py-1">
        <Transport
          playing={state.video.playing}
          currentTime={state.video.currentTime}
          duration={state.video.duration}
          onPlay={actions.playVideo}
          onPause={actions.pauseVideo}
          onStop={actions.stopVideo}
          onSeek={actions.seekVideo}
          seekLabel={t.stage.seekVideo}
          t={t}
        />
      </div>
    ) : null;

  const isEmpty =
    layers.length === 0 &&
    stage.activities.length === 0 &&
    stage.upcomingSchedules.length === 0 &&
    stage.recentScheduleEvents.length === 0;

  let preview: ReactNode;
  if (variant === "panel" && isIdle) {
    preview = (
      <div className="flex items-center gap-3">
        <div
          className="relative w-24 flex-shrink-0 rounded-md overflow-hidden border border-gray-700"
          style={{ aspectRatio: "16/9" }}
        >
          <LivePreview state={state} settings={settings} showLabels={false} />
        </div>
        <span className="text-sm text-gray-400">{t.status.idle}</span>
      </div>
    );
  } else if (variant === "panel") {
    preview = (
      <>
        <div
          className="relative w-full rounded-lg overflow-hidden border border-gray-700"
          style={{ aspectRatio: state.mode === "text" ? "3/4" : "16/9" }}
        >
          <LivePreview state={state} settings={settings} />
        </div>
        <div className="mt-2 text-xs text-gray-500 text-center truncate">
          {presentingStatus(state, t)}
        </div>
        {videoTransport && <div className="mt-2">{videoTransport}</div>}
      </>
    );
  } else if (isIdle) {
    preview = (
      <div
        className="relative w-full rounded-lg overflow-hidden border border-gray-700"
        style={{ aspectRatio: "16/9" }}
      >
        <LivePreview state={state} settings={settings} showLabels={false} />
      </div>
    );
  } else {
    // The sheet's preview while presenting is the one atop the screen, which
    // stays inert so a stray tap can't seek; the controls live here instead.
    preview = videoTransport;
  }

  return (
    <>
      <HealthBanner
        displayWindowOpen={stage.displayWindowOpen}
        monitorMissing={stage.monitorMissing}
        onNavigate={onNavigate}
        t={t}
      />

      {preview && (
        <div data-stage-section="preview" className="scroll-mt-2">
          {preview}
        </div>
      )}

      {/* Right under the preview, so it never moves as other sections come and go. */}
      <VolumeSection state={state} actions={actions} t={t} />

      <LoadedSection
        layers={layers}
        state={state}
        actions={actions}
        onNavigate={onNavigate}
        t={t}
      />
      <ActivitySection
        activities={stage.activities}
        onDismiss={stage.dismiss}
        onNavigate={onNavigate}
        t={t}
      />
      <UpcomingSection
        schedules={stage.upcomingSchedules}
        recentEvents={stage.recentScheduleEvents}
        onNavigate={onNavigate}
        t={t}
      />

      {isEmpty && <p className="px-1 text-xs text-gray-500">{t.stage.nothingRunning}</p>}
    </>
  );
}

function presentingStatus(state: DisplayState, t: Translations): string {
  switch (state.mode) {
    case "text":
      return state.text.title;
    case "video": {
      const status = state.video.playing ? t.status.playingVideo : t.status.videoPaused;
      return state.video.name ? `${state.video.name} · ${status}` : status;
    }
    case "image":
      return state.image.slideshowImages.length > 1
        ? `${t.status.presentingSlideshow} · ${state.image.currentIndex + 1}/${state.image.slideshowImages.length}`
        : t.status.presentingImage;
    default:
      return "";
  }
}
