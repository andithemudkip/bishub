import { useEffect, type RefObject } from "react";

/**
 * Listens for the global "focusSearch" custom event and focuses the given input ref.
 * Optionally runs a callback before focusing (e.g. to switch views).
 */
export function useFocusSearch(
  inputRef: RefObject<HTMLInputElement | null>,
  onBeforeFocus?: () => void
) {
  useEffect(() => {
    const handler = () => {
      onBeforeFocus?.();
      inputRef.current?.focus();
    };
    window.addEventListener("focusSearch", handler);
    return () => window.removeEventListener("focusSearch", handler);
  });
}
