import { useCallback, useState } from "react";

/**
 * A per-device list of recent searches in `localStorage`, newest first.
 * Recents belong to the device, not the room — they're never broadcast.
 * Storage can be unavailable (private mode, blocked), so every access is
 * guarded and the list simply doesn't persist then.
 */
export function useSearchHistory<T extends { id: string }>(
  storageKey: string,
  max: number,
  /** Which older entry a new one replaces; by id unless given. */
  isSame: (a: T, b: T) => boolean = (a, b) => a.id === b.id
) {
  const [entries, setEntries] = useState<T[]>(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  });

  const persist = useCallback(
    (next: T[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Not persisted this time; the in-memory list still updates.
      }
    },
    [storageKey]
  );

  const add = useCallback(
    (entry: T) => {
      setEntries((prev) => {
        const next = [entry, ...prev.filter((e) => !isSame(e, entry))].slice(0, max);
        persist(next);
        return next;
      });
    },
    [isSame, max, persist]
  );

  const clear = useCallback(() => {
    setEntries([]);
    persist([]);
  }, [persist]);

  return { entries, add, clear };
}
