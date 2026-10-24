import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_STATE, type DisplayState, type VerseReminderState } from "../../../shared/types";
import { getTranslations } from "../../../shared/i18n";
import { VerseReminderNotice } from "./VerseReminderNotice";
import { HIDDEN_NOTICE_MS, verseNotice } from "./verseNotice";

const MIN = 60_000;
const START = new Date(2026, 9, 25, 10, 0).getTime();
const en = getTranslations("en");

const reminder = (hideAt: number | null = START + 11 * MIN): VerseReminderState => ({
  since: START,
  remindAt: START + 10 * MIN,
  hideAt,
});

function verseState(text: Partial<DisplayState["text"]>, mode: DisplayState["mode"] = "text") {
  return {
    ...DEFAULT_STATE,
    mode,
    text: {
      ...DEFAULT_STATE.text,
      title: "Ioan 3",
      slides: ["16 Fiindcă"],
      contentType: "bible",
      ...text,
    },
  } satisfies DisplayState;
}

describe("verseNotice", () => {
  it("says nothing before the reminder is due", () => {
    expect(verseNotice(verseState({ verseReminder: reminder() }), START + 10 * MIN - 1)).toBeNull();
  });

  it("counts down to the hide once it's due", () => {
    expect(verseNotice(verseState({ verseReminder: reminder() }), START + 10 * MIN + 18_500)).toEqual({
      kind: "reminding",
      minutes: 10,
      secondsLeft: 42,
    });
  });

  it("has no countdown when the setting only reminds", () => {
    expect(verseNotice(verseState({ verseReminder: reminder(null) }), START + 25 * MIN)).toEqual({
      kind: "reminding",
      minutes: 25,
      secondsLeft: null,
    });
  });

  it("offers a hidden verse back for a while, only while idle", () => {
    const hiddenAt = START;
    expect(verseNotice(verseState({ autoHiddenAt: hiddenAt }, "idle"), START + MIN)).toEqual({
      kind: "hidden",
      hiddenAt,
    });
    expect(verseNotice(verseState({ autoHiddenAt: hiddenAt }, "idle"), START + HIDDEN_NOTICE_MS)).toBeNull();
    expect(verseNotice(verseState({ autoHiddenAt: hiddenAt }, "video"), START + MIN)).toBeNull();
  });
});

describe("VerseReminderNotice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const handlers = () => ({ onKeepShowing: vi.fn(), onHide: vi.fn(), onShowAgain: vi.fn() });

  it("appears when the reminder is due and counts down", () => {
    const on = handlers();
    render(<VerseReminderNotice state={verseState({ verseReminder: reminder() })} t={en} {...on} />);
    expect(screen.queryByRole("alert")).toBeNull();

    act(() => vi.advanceTimersByTime(10 * MIN));
    expect(screen.getByRole("alert").textContent).toContain("Hiding in 1:00");
    act(() => vi.advanceTimersByTime(18_000));
    expect(screen.getByRole("alert").textContent).toContain("Hiding in 0:42");

    fireEvent.click(screen.getByRole("button", { name: "Keep showing" }));
    expect(on.onKeepShowing).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(on.onHide).toHaveBeenCalled();
  });

  it("says how long the verse has been up when it only reminds", () => {
    vi.setSystemTime(START + 12 * MIN);
    render(
      <VerseReminderNotice state={verseState({ verseReminder: reminder(null) })} t={en} {...handlers()} />
    );
    expect(screen.getByRole("alert").textContent).toContain("Verse on screen for 12 min");
  });

  it("offers the hidden verse back until dismissed", () => {
    const on = handlers();
    render(
      <VerseReminderNotice state={verseState({ autoHiddenAt: START }, "idle")} t={en} {...on} />
    );
    expect(screen.getByRole("status").textContent).toContain("Verse hidden");

    fireEvent.click(screen.getByRole("button", { name: "Show again" }));
    expect(on.onShowAgain).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: en.stage.dismiss }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("stops offering the hidden verse once the offer lapses", () => {
    render(
      <VerseReminderNotice state={verseState({ autoHiddenAt: START }, "idle")} t={en} {...handlers()} />
    );
    act(() => vi.advanceTimersByTime(HIDDEN_NOTICE_MS));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
