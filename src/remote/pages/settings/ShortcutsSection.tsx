import { SHORTCUTS } from "../../../shared/shortcuts";
import { isMacPlatform } from "../../../shared/utils";
import { renderTip } from "../../components/ui/renderTip";
import { SettingsGroup } from "./SettingRow";
import type { SectionProps } from "./types";

const kbdClass = "px-2 py-1 bg-gray-700 rounded text-gray-300";

export function ShortcutsSection({ t }: SectionProps) {
  const mac = isMacPlatform();

  return (
    <SettingsGroup tip={renderTip(t.settings.keyboardShortcutsTip)}>
      <div data-setting="shortcuts" className="text-sm">
        {Object.values(SHORTCUTS).map((shortcut) => {
          const modifier =
            "mod" in shortcut && shortcut.mod
              ? mac ? "⌘" : "Ctrl"
              : "alt" in shortcut && shortcut.alt
                ? mac ? "⌥" : "Alt"
                : null;
          return (
            <div
              key={shortcut.display.join(",")}
              className="flex items-center justify-between gap-4 py-2.5 border-b border-gray-700/50 last:border-b-0"
            >
              <span className="text-gray-300">{shortcut.label(t)}</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                {modifier ? (
                  <>
                    <kbd className={kbdClass}>{modifier}</kbd>
                    <span className="text-gray-500">+</span>
                    {shortcut.display.map((key) => (
                      <kbd key={key} className={kbdClass}>
                        {key}
                      </kbd>
                    ))}
                  </>
                ) : (
                  shortcut.display.map((key, i) => (
                    <span key={key} className="flex items-center gap-1">
                      {i > 0 && <span className="text-gray-500">/</span>}
                      <kbd className={kbdClass}>{key}</kbd>
                    </span>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </SettingsGroup>
  );
}
