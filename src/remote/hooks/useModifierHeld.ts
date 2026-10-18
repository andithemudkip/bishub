import { useEffect, useState } from "react";
import { isMacPlatform } from "../../shared/utils";

/** Long enough that a quick ⌘C or ⌘1 never flashes the hints. */
export const MODIFIER_REVEAL_DELAY_MS = 400;

/**
 * True while ⌘ (Mac) / Ctrl (elsewhere) is held on its own for a moment —
 * the cue to reveal shortcut hints that are otherwise hidden. Pressing any
 * other key, releasing the modifier or leaving the window hides them again.
 */
export function useModifierHeld(enabled = true): boolean {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const modifier = isMacPlatform() ? "Meta" : "Control";
    let timer: ReturnType<typeof setTimeout> | undefined;

    const reset = () => {
      clearTimeout(timer);
      timer = undefined;
      setHeld(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== modifier) return reset();
      // Key repeat fires keydown again while held; keep the running timer.
      if (timer === undefined) {
        timer = setTimeout(() => setHeld(true), MODIFIER_REVEAL_DELAY_MS);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === modifier) reset();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    // The keyup is lost if the window loses focus mid-hold (⌘Tab).
    window.addEventListener("blur", reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", reset);
      setHeld(false);
    };
  }, [enabled]);

  return held;
}
