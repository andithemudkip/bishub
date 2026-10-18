import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_STATE, type DisplayState } from "../../../shared/types";
import { getTranslations } from "../../../shared/i18n";
import { StageChip } from "./StageChip";
import { StageContext, type StageData } from "./stageContext";

const t = getTranslations("en");

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

function renderChip(state: DisplayState) {
  const onOpen = vi.fn();
  render(
    <StageContext.Provider value={stage}>
      <StageChip state={state} t={t} onOpen={onOpen} />
    </StageContext.Provider>,
  );
  return onOpen;
}

describe("StageChip", () => {
  it("stays out of the way while presenting with nothing to report", () => {
    renderChip({ ...DEFAULT_STATE, mode: "text" });
    expect(screen.queryByRole("button", { name: t.stage.open })).toBeNull();
  });

  it.each([true, false])(
    "opens the sheet, and the video's transport, while a video is showing (playing: %s)",
    (playing) => {
      const onOpen = renderChip({
        ...DEFAULT_STATE,
        mode: "video",
        video: { ...DEFAULT_STATE.video, src: "/v.mp4", videoId: "v1", playing },
      });
      fireEvent.click(screen.getByRole("button", { name: t.stage.open }));
      expect(onOpen).toHaveBeenCalled();
    },
  );
});
