import type { DisplayState } from "../../../shared/types";

/** How long "Verse hidden · Show again" stays offered after the reminder hid a verse. */
export const HIDDEN_NOTICE_MS = 5 * 60_000;

export type VerseNotice =
  | {
      kind: "reminding";
      /** Whole minutes since the verse last changed. */
      minutes: number;
      /** Seconds left before it hides; null when the setting only reminds. */
      secondsLeft: number | null;
    }
  | { kind: "hidden"; hiddenAt: number };

/**
 * What the remotes should say about a Bible verse left on screen, if anything.
 * Everything comes from `DisplayState`, so every remote shows the same thing.
 */
export function verseNotice(state: DisplayState, now: number): VerseNotice | null {
  const { mode, text } = state;
  const reminder = text.verseReminder;
  if (mode === "text" && reminder && now >= reminder.remindAt) {
    return {
      kind: "reminding",
      minutes: Math.floor((now - reminder.since) / 60_000),
      secondsLeft:
        reminder.hideAt === null ? null : Math.max(0, Math.ceil((reminder.hideAt - now) / 1000)),
    };
  }
  const hiddenAt = text.autoHiddenAt;
  if (mode === "idle" && hiddenAt !== undefined && now - hiddenAt < HIDDEN_NOTICE_MS) {
    return { kind: "hidden", hiddenAt };
  }
  return null;
}
