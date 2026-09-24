import type { Translations } from "../../../shared/i18n";
import type { ActivityTarget } from "../../../shared/stage.types";
import { ProgressRingIcon } from "../icons/ui";
import { useStage } from "./stageContext";
import { navBadge } from "./stageStatus";
import { useNow } from "./useNow";

interface Props {
  /** One page, or every page behind the mobile More button. */
  pages: readonly ActivityTarget[];
  t: Translations;
}

/**
 * Status where it belongs: a dot, ring or countdown on the icon of the page
 * that owns it. Render inside a `relative` wrapper around the nav icon.
 */
export function NavBadge({ pages, t }: Props) {
  const { activities, upcomingSchedules, acknowledgedErrors } = useStage();
  // Only Audio shows a countdown, and only it needs the clock to re-render it.
  const now = useNow(pages.includes("audio") && upcomingSchedules.length > 0);
  const badge = navBadge(pages, activities, upcomingSchedules, acknowledgedErrors, now);
  if (!badge) return null;

  if (badge.kind === "error") {
    return (
      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-gray-900" />
    );
  }
  if (badge.kind === "progress") {
    return (
      <span className="absolute -top-1 -right-1 rounded-full bg-gray-900 p-px">
        <ProgressRingIcon className="w-3.5 h-3.5 text-blue-400" progress={badge.progress} />
      </span>
    );
  }
  return (
    // Opaque, with a background-coloured ring: it sits over the icon's corner,
    // so a see-through pill would let the icon's strokes run through the digits.
    <span className="absolute -top-1.5 -right-3 rounded-full bg-amber-400 ring-2 ring-gray-900 px-1 text-[9px] leading-[14px] font-semibold tabular-nums text-gray-900">
      {badge.minutes}
      {t.audioSchedule.unitMinute}
    </span>
  );
}
