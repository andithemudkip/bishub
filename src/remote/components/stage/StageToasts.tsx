import { useCallback, useEffect, useRef, useState } from "react";
import type { Translations } from "../../../shared/i18n";
import type { ActivityTarget } from "../../../shared/stage.types";
import { ToastStack, type ToastItem } from "../ui/Toast";
import { useStage } from "./stageContext";
import { activityDetail, activityTitle } from "./formatActivity";
import type { NavigateTo } from "./types";

interface Props {
  currentPage: ActivityTarget;
  onNavigate: NavigateTo;
  t: Translations;
}

const SUCCESS_MS = 4000;
const ERROR_MS = 7000;
/** Enough to notice a burst; more would bury the page. */
const MAX_TOASTS = 3;

/**
 * A toast when background work finishes or fails — never for progress.
 *
 * Only work this remote saw running toasts: a row that first appears already
 * finished (the MP3 rows a bulk run leaves behind as its group dissolves, or
 * a burst of instant failures) has nothing to announce the end of, and the
 * bulk run itself is one grouped row, so it ends in one toast. Nothing
 * toasts for the page you're on — you can see it there.
 */
export function StageToasts({ currentPage, onNavigate, t }: Props) {
  const { activities } = useStage();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seenLive = useRef(new Set<string>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    const finished: ToastItem[] = [];
    for (const activity of activities) {
      const live = activity.status === "running" || activity.status === "pending";
      if (live) {
        seenLive.current.add(activity.id);
        continue;
      }
      if (!seenLive.current.delete(activity.id)) continue;
      if (activity.target === currentPage) continue;

      const isError = activity.status === "error";
      finished.push({
        id: `${activity.id}@${activity.updatedAt}`,
        tone: isError ? "error" : "success",
        title: activityTitle(activity, t),
        detail: activityDetail(activity, t),
        onSelect: () => onNavigate(activity.target),
      });
    }
    if (finished.length === 0) return;

    for (const toast of finished) {
      const timer = setTimeout(
        () => dismiss(toast.id),
        toast.tone === "error" ? ERROR_MS : SUCCESS_MS
      );
      timers.current.set(toast.id, timer);
    }
    setToasts((prev) => [...prev, ...finished].slice(-MAX_TOASTS));
  }, [activities, currentPage, onNavigate, t, dismiss]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return <ToastStack toasts={toasts} onDismiss={dismiss} />;
}
