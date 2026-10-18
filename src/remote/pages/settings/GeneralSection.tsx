import { useEffect, useState } from "react";
import { Select } from "../../components/ui/Select";
import { Toggle } from "../../components/ui/Toggle";
import { LANGUAGE_NAMES, AVAILABLE_LANGUAGES, type Language } from "../../../shared/i18n";
import { SettingRow, SettingsGroup } from "./SettingRow";
import type { SectionProps } from "./types";

export function GeneralSection({ settings, onSetLanguage, isElectron, t }: SectionProps) {
  const [openOnStartup, setOpenOnStartup] = useState(false);

  useEffect(() => {
    if (isElectron) window.electronAPI?.getOpenOnStartup().then(setOpenOnStartup);
  }, [isElectron]);

  const handleOpenOnStartup = (enabled: boolean) => {
    setOpenOnStartup(enabled);
    window.electronAPI?.setOpenOnStartup(enabled);
  };

  return (
    <SettingsGroup>
      <SettingRow id="language" label={t.settings.language} hint={t.settings.languageHint}>
        <div className="sm:max-w-xs">
          <Select
            value={settings.language}
            onChange={(e) => onSetLanguage(e.target.value as Language)}
            aria-label={t.settings.language}
          >
            {AVAILABLE_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_NAMES[lang]}
              </option>
            ))}
          </Select>
        </div>
      </SettingRow>

      {isElectron && (
        <SettingRow
          id="openOnStartup"
          label={t.settings.openOnStartup}
          hint={t.settings.openOnStartupHint}
          control={
            <Toggle
              checked={openOnStartup}
              onChange={handleOpenOnStartup}
              label={t.settings.openOnStartup}
            />
          }
        />
      )}
    </SettingsGroup>
  );
}
