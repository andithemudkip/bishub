import { useEffect, useCallback, useRef, type ReactNode } from "react";
import type { DisplayState, AppSettings } from "../../../shared/types";
import type { Translations } from "../../../shared/i18n";
import LivePreview from "../preview/LivePreview";
import { MIN_WIDTH } from "../preview/usePreviewState";
import { CollapseRightIcon } from "../icons/ui";
import type { StageSection } from "./types";

interface Props {
  state: DisplayState;
  settings: AppSettings;
  t: Translations;
  width: number;
  isResizing: boolean;
  onCollapse: () => void;
  onWidthChange: (width: number) => void;
  onResizeStart: () => void;
  onResizeEnd: () => void;
  /** Section the rail asked for; scrolled into view once, then cleared. */
  focusSection: StageSection | null;
  onFocusHandled: () => void;
  /** Health banner, pinned above the scrolling content. */
  banner: ReactNode;
  /** Loaded / Activity / Coming up — each renders nothing when empty. */
  children: ReactNode;
  /** Shown when every section is empty. */
  isEmpty: boolean;
  footer: ReactNode;
}

export function StagePanel({
  state,
  settings,
  t,
  width,
  isResizing,
  onCollapse,
  onWidthChange,
  onResizeStart,
  onResizeEnd,
  focusSection,
  onFocusHandled,
  banner,
  children,
  isEmpty,
  footer,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      onResizeStart();
    },
    [width, onResizeStart]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      startXRef.current = e.touches[0].clientX;
      startWidthRef.current = width;
      onResizeStart();
    },
    [width, onResizeStart]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      onWidthChange(startWidthRef.current + startXRef.current - e.clientX);
    };
    const handleTouchMove = (e: TouchEvent) => {
      onWidthChange(startWidthRef.current + startXRef.current - e.touches[0].clientX);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", onResizeEnd);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", onResizeEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", onResizeEnd);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", onResizeEnd);
    };
  }, [isResizing, onWidthChange, onResizeEnd]);

  useEffect(() => {
    if (!focusSection) return;
    scrollRef.current
      ?.querySelector(`[data-stage-section="${focusSection}"]`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
    onFocusHandled();
  }, [focusSection, onFocusHandled]);

  const isIdle = state.mode === "idle";

  return (
    <div
      className={`relative flex-shrink-0 h-full bg-gray-800 border-l border-gray-700 flex flex-col ${
        isResizing ? "select-none" : ""
      }`}
      style={{ width, minWidth: MIN_WIDTH }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500/50 active:bg-blue-500 z-10"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      />

      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 flex-shrink-0">
        <span className="text-sm text-gray-400">{t.stage.title}</span>
        <button
          onClick={onCollapse}
          className="text-gray-400 hover:text-white p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          title={t.preview.collapse}
          aria-label={t.preview.collapse}
        >
          <CollapseRightIcon />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
        {banner}

        {/* Full preview while presenting; while idle it shrinks to a row so
            the sections below get the space. */}
        <div data-stage-section="preview" className="scroll-mt-2">
          {isIdle ? (
            <div className="flex items-center gap-3">
              <div
                className="relative w-24 flex-shrink-0 rounded-md overflow-hidden border border-gray-700"
                style={{ aspectRatio: "16/9" }}
              >
                <LivePreview state={state} settings={settings} showLabels={false} />
              </div>
              <span className="text-sm text-gray-400">{t.status.idle}</span>
            </div>
          ) : (
            <>
              <div
                className="relative w-full rounded-lg overflow-hidden border border-gray-700"
                style={{ aspectRatio: state.mode === "text" ? "3/4" : "16/9" }}
              >
                <LivePreview state={state} settings={settings} />
              </div>
              <div className="mt-2 text-xs text-gray-500 text-center truncate">
                {presentingStatus(state, t)}
              </div>
            </>
          )}
        </div>

        {children}

        {isEmpty && (
          <p className="px-1 text-xs text-gray-500">{t.stage.nothingRunning}</p>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-gray-700 px-3 py-2">{footer}</div>
    </div>
  );
}

function presentingStatus(state: DisplayState, t: Translations): string {
  switch (state.mode) {
    case "text":
      return state.text.title;
    case "video": {
      const status = state.video.playing ? t.status.playingVideo : t.status.videoPaused;
      return state.video.name ? `${state.video.name} · ${status}` : status;
    }
    case "image":
      return state.image.slideshowImages.length > 1
        ? `${t.status.presentingSlideshow} · ${state.image.currentIndex + 1}/${state.image.slideshowImages.length}`
        : t.status.presentingImage;
    default:
      return "";
  }
}
