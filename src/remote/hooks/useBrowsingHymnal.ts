import { useCallback, useState } from "react";

const STORAGE_KEY = "browsing-hymnal";

/** A book picked on this remote, and the default it was picked against. */
interface Choice {
  slug: string;
  against: string;
}

function readChoice(): Choice | null {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    if (
      parsed &&
      typeof (parsed as Choice).slug === "string" &&
      typeof (parsed as Choice).against === "string"
    ) {
      return parsed as Choice;
    }
  } catch {
    // Unreadable or blocked: start from the default.
  }
  return null;
}

/**
 * The hymnal this remote is browsing. Each remote picks its own book — someone
 * on a phone looking ahead in another book mustn't swap the operator's list —
 * so the choice stays here and never reaches the shared settings.
 *
 * It starts from the default and lasts the tab's session (phones reload the
 * page when the screen locks). A choice only holds against the default it was
 * made against: changing the default in Settings brings every remote to it.
 */
export function useBrowsingHymnal(defaultSlug: string) {
  const [choice, setChoice] = useState<Choice | null>(readChoice);

  const hymnal = choice && choice.against === defaultSlug ? choice.slug : defaultSlug;

  const selectHymnal = useCallback(
    (slug: string) => {
      const next = { slug, against: defaultSlug };
      setChoice(next);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Not persisted; the choice still holds until the page reloads.
      }
    },
    [defaultSlug]
  );

  return { hymnal, selectHymnal };
}
