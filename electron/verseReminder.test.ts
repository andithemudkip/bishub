import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BibleContext } from "../src/shared/types";
import { StateManager, VERSE_HIDE_COUNTDOWN_MS } from "./state";

const MIN = 60_000;
const START = new Date(2026, 9, 25, 10, 0).getTime();

const context: BibleContext = { bookId: "JHN", bookName: "Ioan", chapter: 3, verses: [] };

function showVerse(state: StateManager, slide = 0) {
  state.loadBibleChapter("Ioan 3", ["16 Fiindcă", "17 Dumnezeu", "18 Oricine"], slide, context);
}

describe("verse reminder", () => {
  let state: StateManager;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
    state = new StateManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to reminding after ten minutes, then hiding", () => {
    showVerse(state);
    expect(state.getState().text.verseReminder).toEqual({
      since: START,
      remindAt: START + 10 * MIN,
      hideAt: START + 10 * MIN + VERSE_HIDE_COUNTDOWN_MS,
    });
  });

  it("reminds, then hides the verse a countdown later", () => {
    const reminded = vi.fn();
    state.onVerseReminder(reminded);
    showVerse(state, 1);

    vi.advanceTimersByTime(10 * MIN - 1);
    expect(reminded).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(reminded).toHaveBeenCalledTimes(1);
    expect(state.getState().mode).toBe("text");

    vi.advanceTimersByTime(VERSE_HIDE_COUNTDOWN_MS);
    const hidden = state.getState();
    expect(hidden.mode).toBe("idle");
    expect(hidden.text.autoHiddenAt).toBe(START + 10 * MIN + VERSE_HIDE_COUNTDOWN_MS);
    expect(hidden.text.verseReminder).toBeUndefined();
    // Hidden, not cleared, so it can come back as it was.
    expect(hidden.text.currentSlide).toBe(1);
    expect(hidden.text.contentType).toBe("bible");
  });

  it("starts over on every slide change", () => {
    showVerse(state);
    vi.advanceTimersByTime(9 * MIN);
    state.nextSlide();
    expect(state.getState().text.verseReminder?.since).toBe(START + 9 * MIN);

    vi.advanceTimersByTime(10 * MIN + VERSE_HIDE_COUNTDOWN_MS - 1);
    expect(state.getState().mode).toBe("text");
    vi.advanceTimersByTime(1);
    expect(state.getState().mode).toBe("idle");
  });

  it("doesn't start over for state changes that aren't the operator's", () => {
    showVerse(state);
    vi.advanceTimersByTime(5 * MIN);
    state.setAudioVolume(0.5);
    state.setLanguage("en");
    expect(state.getState().text.verseReminder?.since).toBe(START);
  });

  it("gives the verse a full interval again on Keep showing", () => {
    showVerse(state);
    vi.advanceTimersByTime(10 * MIN + 30_000);
    state.keepShowingVerse();
    expect(state.getState().text.verseReminder?.remindAt).toBe(START + 20 * MIN + 30_000);

    vi.advanceTimersByTime(VERSE_HIDE_COUNTDOWN_MS);
    expect(state.getState().mode).toBe("text");
  });

  it("only reminds when auto-hide is off", () => {
    const reminded = vi.fn();
    state.onVerseReminder(reminded);
    state.setVerseReminder(5, false);
    showVerse(state);
    expect(state.getState().text.verseReminder?.hideAt).toBeNull();

    vi.advanceTimersByTime(60 * MIN);
    expect(reminded).toHaveBeenCalledTimes(1);
    expect(state.getState().mode).toBe("text");
  });

  it("is off at zero minutes", () => {
    state.setVerseReminder(0, true);
    showVerse(state);
    expect(state.getState().text.verseReminder).toBeUndefined();
    vi.advanceTimersByTime(120 * MIN);
    expect(state.getState().mode).toBe("text");
  });

  it("re-arms the verse on screen when the setting changes", () => {
    showVerse(state);
    vi.advanceTimersByTime(3 * MIN);
    state.setVerseReminder(5, true);
    expect(state.getState().text.verseReminder?.remindAt).toBe(START + 8 * MIN);
    expect(state.getSettings()).toMatchObject({ verseReminderMinutes: 5, verseAutoHide: true });

    state.setVerseReminder(0, true);
    expect(state.getState().text.verseReminder).toBeUndefined();
    vi.advanceTimersByTime(60 * MIN);
    expect(state.getState().mode).toBe("text");
  });

  it("rejects nonsense from a remote", () => {
    state.setVerseReminder(Number.NaN, true);
    expect(state.getSettings().verseReminderMinutes).toBe(10);
    state.setVerseReminder(-4, true);
    expect(state.getSettings().verseReminderMinutes).toBe(0);
    state.setVerseReminder(10_000, true);
    expect(state.getSettings().verseReminderMinutes).toBe(120);
  });

  it("leaves hymns and custom text alone", () => {
    state.loadText("Anunțuri", "Duminică la 10");
    expect(state.getState().text.verseReminder).toBeUndefined();
    state.loadInstrumentalHymn("1. Imn", ["a", "b"], "/a.mp3");
    expect(state.getState().text.verseReminder).toBeUndefined();
    vi.advanceTimersByTime(120 * MIN);
    expect(state.getState().mode).toBe("text");
  });

  it("stops when the verse goes idle or other content replaces it", () => {
    showVerse(state);
    state.goIdle();
    expect(state.getState().text.verseReminder).toBeUndefined();
    vi.advanceTimersByTime(120 * MIN);
    expect(state.getState().text.autoHiddenAt).toBeUndefined();

    showVerse(state);
    state.loadVideo("/v.mp4");
    vi.advanceTimersByTime(120 * MIN);
    expect(state.getState().mode).toBe("video");
  });

  it("brings the hidden verse back with a fresh reminder on Show again", () => {
    showVerse(state, 2);
    vi.advanceTimersByTime(10 * MIN + VERSE_HIDE_COUNTDOWN_MS);
    const shownAgainAt = Date.now();

    state.setMode("text");
    const shown = state.getState().text;
    expect(shown.currentSlide).toBe(2);
    expect(shown.autoHiddenAt).toBeUndefined();
    expect(shown.verseReminder?.since).toBe(shownAgainAt);
  });
});
