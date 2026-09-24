import { useEffect } from "react";
import type { ActivityTarget } from "../../../shared/stage.types";
import { useStage } from "./stageContext";
import { errorKey } from "./stageStatus";

/**
 * Being on a page counts as having seen its failures, so their nav dots
 * clear — including ones that arrive while you're there. The rows stay in
 * the Stage until dismissed. A component rather than a Layout effect, so
 * its re-renders on every activity tick stay out of the page tree.
 */
export function StageNavSync({ page }: { page: ActivityTarget }) {
  const { activities, acknowledgeErrors } = useStage();

  useEffect(() => {
    const keys = activities
      .filter((a) => a.status === "error" && a.target === page)
      .map(errorKey);
    if (keys.length > 0) acknowledgeErrors(keys);
  }, [page, activities, acknowledgeErrors]);

  return null;
}
