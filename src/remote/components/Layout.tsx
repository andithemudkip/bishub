import { useState, useEffect, useMemo } from "react";
import type { DisplayState, AppSettings } from "../../shared/types";
import { getTranslations } from "../../shared/i18n";

type Page = "hymns" | "bible" | "video" | "audio" | "settings";

interface Props {
  children: (page: Page) => React.ReactNode;
  state: DisplayState;
  settings: AppSettings;
  onGoIdle: () => void;
  onNextSlide: () => void;
  onPrevSlide: () => void;
}

const NAV_ICONS: Record<Page, string> = {
  hymns: "♪",
  bible: "✝",
  video: "▶",
  audio: "🎵",
  settings: "⚙",
};

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
  settings,
  onGoIdle,
  onNextSlide,
  onPrevSlide,
}: Props) {
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = useState<Page>("hymns");
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  const t = getTranslations(settings.language);

  const navItems = useMemo(
    () => [
      { id: "hymns" as Page, label: t.nav.hymns, icon: NAV_ICONS.hymns },
      { id: "bible" as Page, label: t.nav.bible, icon: NAV_ICONS.bible },
      { id: "video" as Page, label: t.nav.video, icon: NAV_ICONS.video },
      { id: "audio" as Page, label: t.nav.audio, icon: NAV_ICONS.audio },
      {
        id: "settings" as Page,
        label: t.nav.settings,
        icon: NAV_ICONS.settings,
      },
    ],
    [t]
  );

  // Update sidebar state when switching between mobile/desktop
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const getStatusText = () => {
    switch (state.mode) {
      case "idle":
        return t.status.idle;
      case "text":
        return `${state.text.title} (${state.text.currentSlide + 1}/${
          state.text.slides.length
        })`;
      case "video":
        return state.video.playing
          ? t.status.playingVideo
          : t.status.videoPaused;
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
          {navItems.map((item) => (
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
            {navItems.find((i) => i.id === currentPage)?.label}
          </h1>

          {/* Quick controls - centered on mobile */}
          <div className="flex items-center justify-around sm:justify-end gap-4 sm:gap-2 flex-1 min-h-8">
            <h1 className="text-lg font-semibold block md:hidden min-h-12 flex items-center">
              {navItems.find((i) => i.id === currentPage)?.label}
            </h1>
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
            {state.mode !== "idle" && (
              <button
                onClick={onGoIdle}
                className={`w-14 h-12 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-lg sm:rounded text-xl sm:text-sm flex items-center justify-center flex-shrink-0 bg-red-600 hover:bg-red-500 active:bg-red-400`}
              >
                {isMobile ? "■" : t.header.goIdle}
              </button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-4 min-h-0">
          {children(currentPage)}
        </main>
      </div>

      {/* Bottom navigation - mobile only */}
      <nav className="md:hidden flex-shrink-0 bg-gray-800 border-t border-gray-700 flex safe-area-pb">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`flex-1 py-2 flex flex-col items-center gap-1 transition-colors ${
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
