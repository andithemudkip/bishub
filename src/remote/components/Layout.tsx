import { useState } from "react";
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

export default function Layout({
  children,
  state,
  onGoIdle,
  onNextSlide,
  onPrevSlide,
}: Props) {
  const [currentPage, setCurrentPage] = useState<Page>("hymns");
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
    <div className="h-screen flex bg-gray-900 text-white overflow-hidden">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-48" : "w-14"
        } bg-gray-800 flex flex-col transition-all duration-200`}
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
              className={`w-2 h-2 rounded-full ${
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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with controls */}
        <header className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700">
          <h1 className="text-lg font-semibold">
            {NAV_ITEMS.find((i) => i.id === currentPage)?.label}
          </h1>

          {/* Quick controls */}
          <div className="flex items-center gap-2">
            {state.mode === "text" && state.text.slides.length > 0 && (
              <>
                <button
                  onClick={onPrevSlide}
                  disabled={state.text.currentSlide === 0}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm"
                >
                  ← Prev
                </button>
                <span className="text-sm text-gray-400 px-2">
                  {state.text.currentSlide + 1}/{state.text.slides.length}
                </span>
                <button
                  onClick={onNextSlide}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm"
                >
                  Next →
                </button>
              </>
            )}
            <button
              onClick={onGoIdle}
              className={`px-3 py-1.5 rounded text-sm ${
                state.mode === "idle"
                  ? "bg-gray-600 text-gray-400"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              Go Idle
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4">
          {children(currentPage)}
        </main>
      </div>
    </div>
  );
}
