import { SHORTCUTS, type ShortcutName } from "../../../shared/shortcuts";
import { isMacPlatform } from "../../../shared/utils";

interface Props {
  shortcut: ShortcutName;
  /** Which key to show when the shortcut has several (switchPage: "1"…"7"). */
  keyLabel?: string;
  /**
   * Hidden until its `group` ancestor is hovered or keyboard-focused, for
   * lists (the nav) where a column of hints would clutter. It keeps its space
   * so nothing shifts when it appears.
   */
  onHover?: boolean;
  /** Show an `onHover` hint regardless — e.g. while ⌘/Ctrl is held. */
  revealed?: boolean;
  className?: string;
}

/**
 * A shortcut shown faintly beside the control it triggers — "⌘1" by Hymns,
 * "Esc" on Go Idle. Keys and the ⌘/Ctrl or ⌥/Alt modifier come from `SHORTCUTS`, the
 * same table the handlers and Settings use, so a hint can't drift from what
 * the key actually does. Hidden below `md:`, where there's no keyboard.
 *
 * It takes the colour of whatever it sits in — a red outline on Go Idle, blue
 * on the active nav item — so pass a text colour only where the surrounding
 * text isn't the one to match (e.g. inside an input's wrapper).
 */
export function ShortcutHint({
  shortcut,
  keyLabel,
  onHover = false,
  revealed = false,
  className = "",
}: Props) {
  const definition = SHORTCUTS[shortcut];
  const key = keyLabel ?? definition.display[0];
  const mac = isMacPlatform();
  const label =
    "mod" in definition && definition.mod
      ? mac ? `⌘${key}` : `Ctrl+${key}`
      : "alt" in definition && definition.alt
        ? mac ? `⌥${key}` : `Alt+${key}`
        : key;

  return (
    <kbd
      className={`hidden md:inline-flex flex-shrink-0 items-center px-1 rounded border border-current text-[10px] leading-4 font-sans tabular-nums transition-opacity ${
        !onHover
          ? "opacity-60"
          : revealed
            ? "opacity-70"
            : "opacity-0 group-hover:opacity-70 group-focus-visible:opacity-70"
      } ${className}`}
    >
      {label}
    </kbd>
  );
}
