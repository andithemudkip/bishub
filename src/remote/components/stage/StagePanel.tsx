import { useEffect, useCallback, useRef, type ReactNode } from "react";
import type { Translations } from "../../../shared/i18n";
import { MIN_WIDTH } from "../preview/usePreviewState";
import { CollapseRightIcon } from "../icons/ui";
import type { StageSection } from "./types";

interface Props {
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
  /** The scrolling body — `StageSections`. */
  children: ReactNode;
  footer: ReactNode;
}

export function StagePanel({
  t,
  width,
  isResizing,
  onCollapse,
  onWidthChange,
  onResizeStart,
  onResizeEnd,
  focusSection,
  onFocusHandled,
  children,
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
        {children}
      </div>

      <div className="flex-shrink-0 border-t border-gray-700 px-3 py-2">{footer}</div>
    </div>
  );
}

