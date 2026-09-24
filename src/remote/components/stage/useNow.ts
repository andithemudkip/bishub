import { useEffect, useState } from "react";

/** How often countdown labels ("in 14m", "8m") refresh. */
const TICK_MS = 15_000;

/**
 * `Date.now()`, with a re-render every 15s while `active`. Countdown labels
 * depend only on the clock, which nothing else would re-render them for —
 * without this they stay stale until unrelated data changes.
 */
export function useNow(active: boolean): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => clearInterval(id);
  }, [active]);
  return Date.now();
}
