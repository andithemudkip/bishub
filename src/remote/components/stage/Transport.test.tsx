import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  DEFAULT_SETTINGS,
  DEFAULT_STATE,
  type DisplayState,
  type VideoState,
} from "../../../shared/types";
import { getTranslations } from "../../../shared/i18n";
import { Transport } from "./Transport";
import { StageSections } from "./StageSections";
import { StageContext, type StageData } from "./stageContext";

const t = getTranslations("en");

function makeActions() {
  return {
    setMode: vi.fn(),
    clearLayer: vi.fn(),
    playAudio: vi.fn(),
    pauseAudio: vi.fn(),
    stopAudio: vi.fn(),
    seekAudio: vi.fn(),
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    stopVideo: vi.fn(),
    seekVideo: vi.fn(),
    setVideoVolume: vi.fn(),
    setAudioVolume: vi.fn(),
  };
}

const video = (overrides: Partial<VideoState>): VideoState => ({
  ...DEFAULT_STATE.video,
  src: "/v.mp4",
  videoId: "v1",
  currentTime: 20,
  duration: 120,
  ...overrides,
});

interface Media {
  playing: boolean;
  currentTime: number;
  duration: number;
}

function setup(media: Partial<Media>) {
  const handlers = { onPlay: vi.fn(), onPause: vi.fn(), onStop: vi.fn(), onSeek: vi.fn() };
  const view = (m: Partial<Media>) => (
    <Transport
      playing={false}
      currentTime={20}
      duration={120}
      {...m}
      {...handlers}
      seekLabel="Position"
      t={t}
    />
  );
  const utils = render(view(media));
  return { ...handlers, rerender: (m: Partial<Media>) => utils.rerender(view(m)) };
}

const slider = () => screen.getByRole("slider", { name: "Position" });

describe("Transport", () => {
  it("pauses when playing and plays when paused", () => {
    const { onPause, onPlay, rerender } = setup({ playing: true });
    fireEvent.click(screen.getByRole("button", { name: t.stage.pause }));
    expect(onPause).toHaveBeenCalled();

    rerender({ playing: false });
    fireEvent.click(screen.getByRole("button", { name: t.stage.play }));
    expect(onPlay).toHaveBeenCalled();
  });

  it("stops", () => {
    const { onStop } = setup({ playing: true });
    fireEvent.click(screen.getByRole("button", { name: t.stage.stop }));
    expect(onStop).toHaveBeenCalled();
  });

  it("seeks to where the slider is dragged", () => {
    const { onSeek } = setup({ playing: true });
    fireEvent.change(slider(), { target: { value: "75" } });
    expect(onSeek).toHaveBeenCalledWith(75);
  });

  it("holds the dragged position against lagging time ticks until released", () => {
    const { rerender } = setup({ playing: true });

    fireEvent.change(slider(), { target: { value: "75" } });
    // A tick from before the seek lands mid-drag.
    rerender({ playing: true, currentTime: 21 });
    expect(slider()).toHaveProperty("value", "75");

    fireEvent.pointerUp(slider());
    expect(slider()).toHaveProperty("value", "21");
  });

  it("can't seek before the duration is known", () => {
    setup({ duration: 0 });
    expect(slider()).toHaveProperty("disabled", true);
  });
});

describe("StageSections video transport", () => {
  const stage: StageData = {
    activities: [],
    dismiss: vi.fn(),
    upcomingSchedules: [],
    recentScheduleEvents: [],
    displayWindowOpen: true,
    monitorMissing: false,
    health: "ok",
    acknowledgedErrors: new Set(),
    acknowledgeErrors: vi.fn(),
  };

  function renderSections(state: DisplayState, variant: "panel" | "sheet") {
    const actions = makeActions();
    render(
      <StageContext.Provider value={stage}>
        <StageSections
          state={state}
          settings={DEFAULT_SETTINGS}
          t={t}
          actions={actions}
          onNavigate={vi.fn()}
          variant={variant}
        />
      </StageContext.Provider>,
    );
    return actions;
  }

  const showingVideo: DisplayState = { ...DEFAULT_STATE, mode: "video", video: video({}) };

  it.each(["panel", "sheet"] as const)("offers transport for the video on screen (%s)", (variant) => {
    const actions = renderSections(showingVideo, variant);
    fireEvent.change(screen.getByRole("slider", { name: t.stage.seekVideo }), {
      target: { value: "75" },
    });
    expect(actions.seekVideo).toHaveBeenCalledWith(75);
    fireEvent.click(screen.getByRole("button", { name: t.stage.stop }));
    expect(actions.stopVideo).toHaveBeenCalled();
  });

  it("offers none when the video isn't what's showing", () => {
    renderSections({ ...showingVideo, mode: "idle" }, "panel");
    expect(screen.queryByRole("slider", { name: t.stage.seekVideo })).toBeNull();
  });
});
