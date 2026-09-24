import type { ReactNode } from "react";
import type { StageSection } from "./types";

/** A titled block in the Stage. `section` is what the rail scrolls to. */
export function Section({
  section,
  title,
  children,
}: {
  section: StageSection;
  title: string;
  children: ReactNode;
}) {
  return (
    <section data-stage-section={section} className="space-y-1.5 scroll-mt-2">
      <h3 className="px-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
        {title}
      </h3>
      {children}
    </section>
  );
}
