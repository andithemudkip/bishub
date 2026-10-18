import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_STATE, type DisplayState } from "../../../shared/types";
import { getTranslations } from "../../../shared/i18n";
import { VolumeSection } from "./VolumeSection";

const t = getTranslations("en");

function setup(state: DisplayState) {
  const actions = {
    setMode: vi.fn(),
    clearLayer: vi.fn(),
    playAudio: vi.fn(),
    pauseAudio: vi.fn(),
    stopAudio: vi.fn(),
    setVideoVolume: vi.fn(),
    setAudioVolume: vi.fn(),
  };
  const { container } = render(<VolumeSection state={state} actions={actions} t={t} />);
  return { actions, container };
}

const withVideo = (state: DisplayState): DisplayState => ({
  ...state,
  video: { ...state.video, src: "/v.mp4", volume: 0.5 },
});
const withAudio = (state: DisplayState): DisplayState => ({
  ...state,
  audio: { ...state.audio, src: "/a.mp3", volume: 0.8 },
});

describe("VolumeSection", () => {
  it("stays out of the way while nothing that makes sound is loaded", () => {
    const { container } = setup(DEFAULT_STATE);
    expect(container.innerHTML).toBe("");
  });

  it("offers the video's volume even while it's the one on screen", () => {
    setup(withVideo({ ...DEFAULT_STATE, mode: "video" }));
    expect(screen.getByRole("slider", { name: "Video volume" })).toBeTruthy();
    expect(screen.queryByRole("slider", { name: t.audioLibrary.volume })).toBeNull();
    expect(screen.getByText("50%")).toBeTruthy();
  });

  it("sets each volume through its own action", () => {
    const { actions } = setup(withAudio(withVideo(DEFAULT_STATE)));
    fireEvent.change(screen.getByRole("slider", { name: t.audioLibrary.volume }), {
      target: { value: "0.3" },
    });
    expect(actions.setAudioVolume).toHaveBeenCalledWith(0.3);
    expect(actions.setVideoVolume).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("slider", { name: "Video volume" }), {
      target: { value: "0.9" },
    });
    expect(actions.setVideoVolume).toHaveBeenCalledWith(0.9);
  });
});
