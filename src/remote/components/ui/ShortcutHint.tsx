import { SHORTCUTS, type ShortcutName } from "../../../shared/shortcuts";
import { isMacPlatform } from "../../../shared/utils";

interface Props {
  shortcut: ShortcutName;
  /** Which key to show when the shortcut has several (switchPage: "1"…"7"). */
  keyLabel?: string;
  /**
   * Fainter, for lists of hints (the nav) where a column of them at full
   * strength would shout. Brightens when a `group` ancestor is hovered.
   */
  quiet?: boolean;
  className?: string;
}

/**
 * A shortcut shown faintly beside the control it triggers — "⌘1" by Hymns,
 * "Esc" on Go Idle. Keys and the ⌘/Ctrl modifier come from `SHORTCUTS`, the
 * same table the handlers and Settings use, so a hint can't drift from what
 * the key actually does. Hidden below `md:`, where there's no keyboard.
 *
 * It takes the colour of whatever it sits in — a red outline on Go Idle, blue
 * on the active nav item — so pass a text colour only where the surrounding
 * text isn't the one to match (e.g. inside an input's wrapper).
 */
export function ShortcutHint({ shortcut, keyLabel, quiet = false, className = "" }: Props) {
  const definition = SHORTCUTS[shortcut];
  const key = keyLabel ?? definition.display[0];
  const mod = "mod" in definition && definition.mod;
  const label = mod ? (isMacPlatform() ? `⌘${key}` : `Ctrl+${key}`) : key;

  return (
    <kbd
      className={`hidden md:inline-flex flex-shrink-0 items-center px-1 rounded border border-current text-[10px] leading-4 font-sans tabular-nums transition-opacity ${
        quiet ? "opacity-40 group-hover:opacity-70" : "opacity-60"
      } ${className}`}
    >
      {label}
    </kbd>
  );
}
