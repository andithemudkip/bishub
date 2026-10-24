import { useEffect, useState } from "react";
import type { DisplayState } from "../../../shared/types";
import type { Translations } from "../../../shared/i18n";
import { formatDuration } from "../../../shared/utils";
import { BibleIcon } from "../icons/bible";
import { CloseIcon } from "../icons/ui";
import { ghostButton } from "./styles";
import { HIDDEN_NOTICE_MS, verseNotice } from "./verseNotice";

interface Props {
  state: DisplayState;
  t: Translations;
  onKeepShowing: () => void;
  onHide: () => void;
  onShowAgain: () => void;
}

const actionButton =
  "px-3 min-h-9 rounded-lg text-sm border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors";

/**
 * Re-renders when the reminder starts, then every second while it counts
 * down, and once more when the "Show again" offer lapses — and not at all
 * while a verse is simply on screen.
 */
function useVerseClock(state: DisplayState): number {
  const [, setTick] = useState(0);
  const reminder = state.mode === "text" ? state.text.verseReminder : undefined;
  const remindAt = reminder?.remindAt;
  const hiddenAt = state.mode === "idle" ? state.text.autoHiddenAt : undefined;

  useEffect(() => {
    const rerender = () => setTick((n) => n + 1);
    if (remindAt !== undefined) {
      let interval: ReturnType<typeof setInterval> | undefined;
      const timeout = setTimeout(() => {
        rerender();
        interval = setInterval(rerender, 1000);
      }, Math.max(0, remindAt - Date.now()));
      return () => {
        clearTimeout(timeout);
        clearInterval(interval);
      };
    }
    if (hiddenAt !== undefined) {
      const timeout = setTimeout(rerender, Math.max(0, hiddenAt + HIDDEN_NOTICE_MS - Date.now()));
      return () => clearTimeout(timeout);
    }
  }, [remindAt, hiddenAt]);

  return Date.now();
}

/**
 * The reminder for a Bible verse left on screen, on every page of every
 * remote: how long it's been up, the countdown if it's about to hide, and the
 * two answers. After the reminder hides a verse, offers it back for a while.
 */
export function VerseReminderNotice({ state, t, onKeepShowing, onHide, onShowAgain }: Props) {
  const now = useVerseClock(state);
  const notice = verseNotice(state, now);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  const remindAt = notice?.kind === "reminding" ? state.text.verseReminder?.remindAt : undefined;
  useEffect(() => {
    // A buzz for phones in a pocket; Electron and iOS just don't have it.
    if (remindAt !== undefined) navigator.vibrate?.(200);
  }, [remindAt]);

  if (!notice) return null;
  if (notice.kind === "hidden" && dismissedAt === notice.hiddenAt) return null;

  const reminding = notice.kind === "reminding";
  const title = reminding
    ? notice.secondsLeft === null
      ? t.verseReminder.onScreenFor.replace("{n}", String(notice.minutes))
      : t.verseReminder.hidingIn.replace("{time}", formatDuration(notice.secondsLeft))
    : t.verseReminder.hidden;

  return (
    <div
      role={reminding ? "alert" : "status"}
      className={`pointer-events-auto w-full rounded-xl border px-3 py-2.5 shadow-lg backdrop-blur bg-gray-800/95 ${
        reminding ? "border-amber-600/50" : "border-gray-700"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <BibleIcon
          className={`w-5 h-5 flex-shrink-0 ${reminding ? "text-amber-400" : "text-gray-400"}`}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate tabular-nums">{title}</div>
          <div className="text-xs text-gray-400 truncate">{state.text.title}</div>
        </div>
        {!reminding && (
          <button
            type="button"
            onClick={() => setDismissedAt(notice.hiddenAt)}
            aria-label={t.stage.dismiss}
            className={`${ghostButton} -mr-1 -mt-1`}
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        {reminding ? (
          <>
            <button
              type="button"
              onClick={onHide}
              className={`${actionButton} bg-gray-700/40 text-gray-300 hover:bg-gray-700/70 border-gray-600/50`}
            >
              {t.verseReminder.hide}
            </button>
            <button
              type="button"
              onClick={onKeepShowing}
              className={`${actionButton} bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border-blue-600/40`}
            >
              {t.verseReminder.keepShowing}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onShowAgain}
            className={`${actionButton} bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border-blue-600/40`}
          >
            {t.verseReminder.showAgain}
          </button>
        )}
      </div>
    </div>
  );
}
