import type { Translations } from "../../../shared/i18n";
import { WarningIcon } from "../icons/ui";

interface Props {
  displayWindowOpen: boolean | null;
  monitorMissing: boolean;
  t: Translations;
}

/** Quiet unless something is wrong; red for a closed display, amber for a missing monitor. */
export function HealthBanner({ displayWindowOpen, monitorMissing, t }: Props) {
  const problems = [
    displayWindowOpen === false && {
      message: t.stage.displayClosed,
      tone: "bg-red-600/20 text-red-300 border-red-600/40",
    },
    monitorMissing && {
      message: t.stage.monitorMissing,
      tone: "bg-amber-600/20 text-amber-300 border-amber-600/40",
    },
  ].filter((p): p is { message: string; tone: string } => !!p);

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
          <span>{p.message}</span>
        </div>
      ))}
    </div>
  );
}

