import { useState, useEffect } from "react";
import type { DisplayState } from "../../shared/types";

type Page = "hymns" | "bible" | "video" | "settings";

interface Props {
  children: (page: Page) => React.ReactNode;
  state: DisplayState;
  onGoIdle: () => void;
  onNextSlide: () => void;
  onPrevSlide: () => void;
}

const NAV_ITEMS: { id: Page; label: string; icon: string }[] = [
  { id: "hymns", label: "Hymns", icon: "♪" },
  { id: "bible", label: "Bible", icon: "✝" },
  { id: "video", label: "Video", icon: "▶" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}

export default function Layout({
  children,
  state,
  onGoIdle,
  onNextSlide,
  onPrevSlide,
}: Props) {
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = useState<Page>("hymns");
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  // Update sidebar state when switching between mobile/desktop
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const getStatusText = () => {
    switch (state.mode) {
      case "idle":
        return "Idle";
      case "text":
        return `${state.text.title} (${state.text.currentSlide + 1}/${
          state.text.slides.length
        })`;
      case "video":
        return state.video.playing ? "Playing video" : "Video paused";
      default:
        return "";
    }
  };

  return (
    <div className="h-screen-safe flex flex-col md:flex-row bg-gray-900 text-white overflow-hidden overscroll-none">
      {/* Sidebar - hidden on mobile, shown on desktop */}
      <div
        className={`hidden md:flex ${
          sidebarOpen ? "w-48" : "w-14"
        } bg-gray-800 flex-col transition-all duration-200`}
      >
        {/* Toggle button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-4 text-gray-400 hover:text-white hover:bg-gray-700 text-left"
        >
          {sidebarOpen ? "◀" : "▶"}
        </button>

        {/* Nav items */}
        <nav className="flex-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full p-4 flex items-center gap-3 transition-colors ${
                currentPage === item.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-700"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Status bar at bottom */}
        <div className="p-3 bg-gray-900 border-t border-gray-700">
          <div
            className={`flex items-center gap-2 ${
              sidebarOpen ? "" : "justify-center"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                state.mode === "idle"
                  ? "bg-gray-500"
                  : state.mode === "text"
                  ? "bg-blue-500"
                  : "bg-green-500"
              }`}
            />
            {sidebarOpen && (
              <span className="text-xs text-gray-400 truncate">
                {getStatusText()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header with controls */}
        <header className="flex-shrink-0 bg-gray-800 px-3 md:px-4 py-2 md:py-3 flex flex-col sm:flex-row sm:items-center gap-2 border-b border-gray-700">
          <h1 className="text-lg font-semibold hidden md:block">
            {NAV_ITEMS.find((i) => i.id === currentPage)?.label}
          </h1>

          {/* Quick controls - centered on mobile */}
          <div className="flex items-center justify-center sm:justify-end gap-2 sm:gap-2 flex-1">
            {state.mode === "text" && state.text.slides.length > 0 && (
              <>
                <button
                  onClick={onPrevSlide}
                  disabled={state.text.currentSlide === 0}
                  className="w-14 h-12 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg sm:rounded text-xl sm:text-sm flex items-center justify-center flex-shrink-0"
                >
                  ←
                </button>
                <span className="text-sm text-gray-400 px-2 whitespace-nowrap min-w-[3rem] text-center">
                  {state.text.currentSlide + 1}/{state.text.slides.length}
                </span>
                <button
                  onClick={onNextSlide}
                  className="w-14 h-12 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-400 rounded-lg sm:rounded text-xl sm:text-sm flex items-center justify-center flex-shrink-0"
                >
                  →
                </button>
              </>
            )}
            <button
              onClick={onGoIdle}
              className={`w-14 h-12 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-lg sm:rounded text-xl sm:text-sm flex items-center justify-center flex-shrink-0 ${
                state.mode === "idle"
                  ? "bg-gray-600 text-gray-400"
                  : "bg-red-600 hover:bg-red-500 active:bg-red-400"
              }`}
            >
              {isMobile ? "■" : "Go Idle"}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-4 min-h-0">
          {children(currentPage)}
        </main>
      </div>

      {/* Bottom navigation - mobile only */}
      <nav className="md:hidden flex-shrink-0 bg-gray-800 border-t border-gray-700 flex safe-area-pb">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
              currentPage === item.id
                ? "bg-blue-600 text-white"
                : "text-gray-400 active:bg-gray-700"
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-xs">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
