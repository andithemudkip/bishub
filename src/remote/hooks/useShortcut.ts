import { useEffect, useRef } from "react";
import { SHORTCUTS, type ShortcutName } from "../../shared/shortcuts";

interface ShortcutOptions {
  /** Use capture phase to intercept before global handlers */
  capture?: boolean;
  /** Skip when focus is on an input/select element (default: true) */
  ignoreInputs?: boolean;
  /** Prevent default browser behavior for matched keys */
  preventDefault?: boolean;
  /** Require Cmd (Mac) / Ctrl (other) modifier */
  mod?: boolean;
  /** Only active when true (default: true) */
  enabled?: boolean;
}

/**
 * Register a handler for a named shortcut or custom key list.
 *
 * Usage:
 *   useShortcut("nextSlide", () => handleNext());
 *   useShortcut("goIdle", () => api.goIdle(), { capture: true });
 *   useShortcut(["Enter"], () => submit(), { ignoreInputs: false });
 */
export function useShortcut(
  shortcutOrKeys: ShortcutName | string[],
  handler: (e: KeyboardEvent) => void,
  options: ShortcutOptions = {}
) {
  const {
    capture = false,
    ignoreInputs = true,
    preventDefault = false,
    mod = false,
    enabled = true,
  } = options;

  // Use ref so the handler is always current without re-registering the listener
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const keys = Array.isArray(shortcutOrKeys)
    ? shortcutOrKeys
    : SHORTCUTS[shortcutOrKeys].keys;

  // Stable key set string for dependency
  const keySet = keys.join(",");

  useEffect(() => {
    if (!enabled) return;

    const keySetParsed = new Set(keySet.split(","));

    const listener = (e: KeyboardEvent) => {
      if (
        ignoreInputs &&
        (e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLSelectElement ||
          e.target instanceof HTMLTextAreaElement)
      ) {
        return;
      }

      if (!keySetParsed.has(e.key)) return;

      if (mod) {
        const modPressed = navigator.platform.includes("Mac")
          ? e.metaKey
          : e.ctrlKey;
        if (!modPressed) return;
      }

      if (preventDefault) e.preventDefault();
      handlerRef.current(e);
    };

    window.addEventListener("keydown", listener, capture);
    return () => window.removeEventListener("keydown", listener, capture);
  }, [keySet, capture, ignoreInputs, preventDefault, mod, enabled]);
}
