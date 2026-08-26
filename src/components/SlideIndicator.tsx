import { forwardRef, useEffect, useState } from "react";
import type { ChromeMetrics } from "../shared/utils";
import { getSlideIndicatorLayout, slideCounterGutter } from "../shared/utils";
import type { SlideTheme } from "../shared/slideTheme";

/**
 * The row of slide dots along the bottom of a slide.
 *
 * Lives in `src/components/` — shared by both renderers — because it is drawn
 * identically by the real display (`TextMode`, `KaraokeMode`) and by
 * `ScaledSlide` in the remote's `LivePreview`, the one piece of slide chrome
 * where a mirrored copy would be most likely to drift. Not `src/shared/`: that
 * is also compiled by `tsconfig.node.json` for the main process, which has no
 * JSX and no business importing a component.
 *
 * Two things it has to survive that plain dots did not: a Bible chapter is one
 * slide per verse, so the count runs to 176 for Psalm 119, and the operator can
 * scale the dots up to 250%. Past the point where dots fit the band between the
 * counter gutters it switches to a progress bar, which reads better at a
 * distance than a smear of dots and cannot overflow at any count.
 */
interface Props {
  count: number;
  current: number;
  chrome: ChromeMetrics;
  theme: SlideTheme;
  /**
   * Width of the slide. Pass it where it is already known exactly (the preview
   * renders at a fixed virtual resolution); omit it on the real display, where
   * the component tracks its own width instead.
   */
  width?: number;
}

const SlideIndicator = forwardRef<HTMLDivElement, Props>(function SlideIndicator(
  { count, current, chrome, theme, width },
  ref,
) {
  // Seeded from the window rather than 0 so the very first paint already knows
  // whether the dots fit: the slide container is fullscreen, so this is exact,
  // and a wrong first frame would show the overflow this component prevents.
  const [measured, setMeasured] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerWidth,
  );

  useEffect(() => {
    if (width !== undefined) return;
    const update = () => setMeasured(window.innerWidth);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [width]);

  const containerWidth = width ?? measured;
  const gutter = slideCounterGutter(count, chrome);
  const { mode, available } = getSlideIndicatorLayout(
    count,
    containerWidth,
    chrome,
  );

  // Inset by the gutter on both sides: still centred, but now unable to reach
  // the counter no matter how many slides there are.
  const rowStyle = {
    left: `${gutter}px`,
    right: `${gutter}px`,
  };

  if (mode === "bar") {
    const progress = count > 0 ? ((current + 1) / count) * 100 : 0;
    return (
      <div
        ref={ref}
        className="absolute bottom-8 flex justify-center items-center"
        style={rowStyle}
      >
        <div
          className="overflow-hidden"
          style={{
            width: `${available}px`,
            height: `${chrome.dotSize}px`,
            borderRadius: `${chrome.dotSize / 2}px`,
            background: theme.dotInactive,
          }}
        >
          <div
            className="h-full transition-all"
            style={{
              width: `${progress}%`,
              borderRadius: `${chrome.dotSize / 2}px`,
              background: theme.dotActive,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="absolute bottom-8 flex justify-center items-center"
      style={{ ...rowStyle, gap: `${chrome.dotGap}px` }}
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-full transition-all"
          style={{
            height: `${chrome.dotSize}px`,
            width: `${
              index === current ? chrome.dotActiveWidth : chrome.dotSize
            }px`,
            background: index === current ? theme.dotActive : theme.dotInactive,
          }}
        />
      ))}
    </div>
  );
});

export default SlideIndicator;
