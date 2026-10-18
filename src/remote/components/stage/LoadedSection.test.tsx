import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_STATE, type DisplayState, type TextContentType } from "../../../shared/types";
import { getTranslations } from "../../../shared/i18n";
import { HymnsIcon } from "../icons/hymns";
import { BibleIcon } from "../icons/bible";
import { PencilIcon } from "../icons/ui";
import { LoadedSection } from "./LoadedSection";

const actions = {
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

function textLayerIcon(contentType: TextContentType) {
  const state: DisplayState = {
    ...DEFAULT_STATE,
    text: { ...DEFAULT_STATE.text, contentType, title: "Loaded", slides: ["a"] },
  };
  const { container } = render(
    <LoadedSection
      layers={[{ kind: "text" }]}
      state={state}
      actions={actions}
      onNavigate={vi.fn()}
      t={getTranslations("en")}
    />,
  );
  return container.querySelector("li svg")?.outerHTML;
}

const iconHtml = (icon: React.ReactElement) => render(icon).container.innerHTML;

describe("LoadedSection", () => {
  it.each([
    ["bible", BibleIcon],
    ["hymn", HymnsIcon],
    ["custom", PencilIcon],
  ] as const)("gives a loaded %s text layer its own icon", (contentType, Icon) => {
    expect(textLayerIcon(contentType)).toBe(
      iconHtml(<Icon className="w-4 h-4 flex-shrink-0 text-gray-400" />),
    );
  });

  it("gives loaded audio the same transport as the video, seek included", () => {
    const state: DisplayState = {
      ...DEFAULT_STATE,
      audio: {
        ...DEFAULT_STATE.audio,
        src: "/a.mp3",
        name: "Prelude",
        playing: true,
        currentTime: 30,
        duration: 200,
      },
    };
    render(
      <LoadedSection
        layers={[{ kind: "audio" }]}
        state={state}
        actions={actions}
        onNavigate={vi.fn()}
        t={getTranslations("en")}
      />,
    );
    const t = getTranslations("en");

    fireEvent.change(screen.getByRole("slider", { name: t.stage.seekAudio }), {
      target: { value: "90" },
    });
    expect(actions.seekAudio).toHaveBeenCalledWith(90);
    fireEvent.click(screen.getByRole("button", { name: t.stage.pause }));
    expect(actions.pauseAudio).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: t.stage.stop }));
    expect(actions.stopAudio).toHaveBeenCalled();
  });
});
