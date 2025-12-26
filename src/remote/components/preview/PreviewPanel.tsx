import { useEffect, useCallback, useRef } from "react";
import type { DisplayState, AppSettings } from "../../../shared/types";
import { getTranslations } from "../../../shared/i18n";
import LivePreview from "./LivePreview";
import { MIN_WIDTH } from "./usePreviewState";

interface Props {
  state: DisplayState;
  settings: AppSettings;
  isOpen: boolean;
  width: number;
  isResizing: boolean;
  onToggle: () => void;
  onWidthChange: (width: number) => void;
  onResizeStart: () => void;
  onResizeEnd: () => void;
}

export default function PreviewPanel({
  state,
  settings,
  isOpen,
  width,
  isResizing,
  onToggle,
  onWidthChange,
  onResizeStart,
  onResizeEnd,
}: Props) {
  const t = getTranslations(settings.language);
  const panelRef = useRef<HTMLDivElement>(null);
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
      const delta = startXRef.current - e.clientX;
      onWidthChange(startWidthRef.current + delta);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const delta = startXRef.current - e.touches[0].clientX;
      onWidthChange(startWidthRef.current + delta);
    };

    const handleEnd = () => {
      onResizeEnd();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleEnd);
    };
  }, [isResizing, onWidthChange, onResizeEnd]);

  return (
    <div
      ref={panelRef}
      className={`flex-shrink-0 bg-gray-800 border-l border-gray-700 flex flex-col transition-all duration-300 ${
        isResizing ? "transition-none select-none" : ""
      }`}
      style={{ width: isOpen ? width : 0, minWidth: isOpen ? MIN_WIDTH : 0 }}
    >
      {isOpen && (
        <>
          {/* Resize handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500/50 active:bg-blue-500 z-10"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          />

          {/* Header with toggle */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 flex-shrink-0">
            <span className="text-sm text-gray-400">
              {t.preview?.title || "Preview"}
            </span>
            <button
              onClick={onToggle}
              className="text-gray-400 hover:text-white p-1"
              title={t.preview?.collapse || "Collapse"}
            >
              ▶
            </button>
          </div>

          {/* Preview content - 16:9 aspect ratio container */}
          <div className="flex-1 p-3 flex flex-col min-h-0">
            <div
              className="relative w-full rounded-lg overflow-hidden border border-gray-700"
              style={{ aspectRatio: "16/9" }}
            >
              <LivePreview state={state} settings={settings} />
            </div>

            {/* Status text below preview */}
            <div className="mt-2 text-xs text-gray-500 text-center truncate">
              {state.mode === "text" && state.text.title}
              {state.mode === "video" &&
                (state.video.playing
                  ? t.status.playingVideo
                  : t.status.videoPaused)}
              {state.mode === "idle" && t.status.idle}
            </div>
          </div>
        </>
      )}

      {/* Collapsed state - show expand button */}
      {!isOpen && state.mode !== "idle" && (
        <button
          onClick={onToggle}
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-gray-800 border border-gray-700 border-r-0 rounded-l-lg px-1 py-4 text-gray-400 hover:text-white hover:bg-gray-700"
          title={t.preview?.expand || "Show preview"}
        >
          ◀
        </button>
      )}
    </div>
  );
}
