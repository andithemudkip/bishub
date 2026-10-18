import type { Translations } from "../../../shared/i18n";
import { WarningIcon } from "../icons/ui";
import { sendPageIntent } from "../../hooks/usePageIntent";
import type { NavigateTo } from "./types";

interface Props {
  displayWindowOpen: boolean | null;
  monitorMissing: boolean;
  onNavigate: NavigateTo;
  t: Translations;
}

interface Problem {
  message: string;
  tone: string;
  fix?: { label: string; run: () => void };
}

/**
 * Quiet unless something is wrong; red for a closed display, amber for a
 * missing monitor — which links to where the screen is picked.
 */
export function HealthBanner({ displayWindowOpen, monitorMissing, onNavigate, t }: Props) {
  const problems = [
    displayWindowOpen === false && {
      message: t.stage.displayClosed,
      tone: "bg-red-600/20 text-red-300 border-red-600/40",
    },
    monitorMissing && {
      message: t.stage.monitorMissing,
      tone: "bg-amber-600/20 text-amber-300 border-amber-600/40",
      fix: {
        label: t.stage.chooseScreen,
        run: () => {
          onNavigate("settings");
          sendPageIntent({ page: "settings", section: "display", settingId: "displayMonitor" });
        },
      },
    },
  ].filter((p): p is Problem => !!p);

  if (problems.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {problems.map((p) => (
        <div
          key={p.message}
          role="alert"
          className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs ${p.tone}`}
        >
          <WarningIcon className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 min-w-0">
            {p.message}
            {p.fix && (
              <button
                type="button"
                onClick={p.fix.run}
                className="block mt-1 underline underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
              >
                {p.fix.label}
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

