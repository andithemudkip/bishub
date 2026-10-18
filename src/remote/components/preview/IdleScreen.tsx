import { useEffect, useRef, useState } from "react";
import type { AudioState, IdleBackground, IdleState } from "../../../shared/types";
import type { Language } from "../../../shared/i18n";
import { getApiUrl } from "../../../shared/utils";
import IdleMode from "../../../display/modes/IdleMode";

// The display's own idle screen, laid out at this resolution and scaled down,
// so a preview can't drift from the projector.
const VIRTUAL_WIDTH = 1920;
const VIRTUAL_HEIGHT = 1080;

/** Remotes, web ones included, fetch a library image over the HTTP API. */
function idleImageApiUrl(background: IdleBackground): string | null {
  return background.kind === "image"
    ? getApiUrl(`/api/images/file/${encodeURIComponent(background.imageId)}`)
    : null;
}

export default function IdleScreen({
  idle,
  language,
  audioState,
}: {
  idle: IdleState;
  language: Language;
  audioState?: AudioState;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    // Each axis on its own: a box that's 16:9 only to the pixel (borders,
    // rounding) would otherwise leave a sliver of the container showing.
    const update = () =>
      setScale({ x: el.clientWidth / VIRTUAL_WIDTH, y: el.clientHeight / VIRTUAL_HEIGHT });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={outerRef} className="w-full h-full overflow-hidden relative">
      <div
        style={{
          width: VIRTUAL_WIDTH,
          height: VIRTUAL_HEIGHT,
          transform: `scale(${scale.x}, ${scale.y})`,
          transformOrigin: "top left",
        }}
      >
        <IdleMode
          config={idle}
          language={language}
          imageUrl={idleImageApiUrl(idle.background)}
          audioState={audioState}
        />
      </div>
    </div>
  );
}
