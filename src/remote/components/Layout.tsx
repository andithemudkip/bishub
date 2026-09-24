import { useState, useEffect, useMemo, useRef } from "react";
import type { DisplayState, AppSettings, MonitorInfo } from "../../shared/types";
import { getTranslations } from "../../shared/i18n";
import { PAGE_ORDER } from "../../shared/shortcuts";
import { useShortcut } from "../hooks/useShortcut";
import { PreviewHeader, usePreviewState } from "./preview";
import {
  StageProvider,
  StageDock,
  StageChip,
  StageSheet,
  StageToasts,
  StageNavSync,
  NavBadge,
  type StageActions,
} from "./stage";
import { QuickSearch, type QuickSearchActions } from "./search/QuickSearch";
import { ShortcutHint } from "./ui/ShortcutHint";
import { HymnsIcon } from "./icons/hymns";
import { BibleIcon } from "./icons/bible";
import { ImageIcon } from "./icons/image";
import { VideoIcon } from "./icons/video";
import { AudioIcon } from "./icons/audio";
import { TransferIcon } from "./icons/transfer";
import { SettingsIcon } from "./icons/settings";
import { ChevronLeftIcon, ChevronRightIcon, StopIcon, MoreIcon, FitFillIcon, FitContainIcon, SearchIcon } from "./icons/ui";

type Page = "hymns" | "bible" | "images" | "video" | "audio" | "transfer" | "settings";

interface Props {
  children: (page: Page, navigateTo: (page: Page) => void) => React.ReactNode;
  state: DisplayState;
  settings: AppSettings;
  onGoIdle: () => void;
  onNextSlide: () => void;
  onPrevSlide: () => void;
  onNextImage: () => void;
  onPrevImage: () => void;
  onSetImageFit: (fit: "fill" | "fit") => void;
  /** null until the first list arrives. */
  monitors: MonitorInfo[] | null;
  connectedDeviceCount: number;
  stageActions: StageActions;
  quickSearchActions: QuickSearchActions;
}

const NAV_ICONS: Record<Page, React.ReactNode> = {
  hymns: <HymnsIcon className="w-6 h-6" />,
  bible: <BibleIcon className="w-6 h-6" />,
  images: <ImageIcon className="w-6 h-6" />,
  video: <VideoIcon className="w-6 h-6" />,
  audio: <AudioIcon className="w-6 h-6" />,
  transfer: <TransferIcon className="w-6 h-6" />,
  settings: <SettingsIcon className="w-6 h-6" />,
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
  onNextImage,
  onPrevImage,
  onSetImageFit,
  monitors,
  connectedDeviceCount,
  stageActions,
  quickSearchActions,
}: Props) {
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = useState<Page>("hymns");
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [stageSheetOpen, setStageSheetOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const preview = usePreviewState({ isMobile });

  const t = getTranslations(settings.language);
  const isElectron = !!window.electronAPI;

  const navItems = useMemo(
    () => [
      { id: "hymns" as Page, label: t.nav.hymns, icon: NAV_ICONS.hymns },
      { id: "bible" as Page, label: t.nav.bible, icon: NAV_ICONS.bible },
      { id: "video" as Page, label: t.nav.video, icon: NAV_ICONS.video },
      { id: "audio" as Page, label: t.nav.audio, icon: NAV_ICONS.audio },
      { id: "images" as Page, label: t.nav.images, icon: NAV_ICONS.images },
      {
        id: "transfer" as Page,
        label: t.nav.transfer,
        icon: NAV_ICONS.transfer,
      },
      {
        id: "settings" as Page,
        label: t.nav.settings,
        icon: NAV_ICONS.settings,
      },
    ],
    [t]
  );

  const MOBILE_PRIMARY_COUNT = 4;
  const primaryNavItems = navItems.slice(0, MOBILE_PRIMARY_COUNT);
  const overflowNavItems = navItems.slice(MOBILE_PRIMARY_COUNT);
  const isOverflowPage = overflowNavItems.some((item) => item.id === currentPage);

  // Close more menu when clicking outside
  useEffect(() => {
    if (!moreMenuOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [moreMenuOpen]);

  // Cmd/Ctrl + 1-6 to switch pages
  // Quick Search: Cmd/Ctrl+K from anywhere, even mid-typing in a page's own
  // search box; or just start typing with nothing focused.
  const [quickSearch, setQuickSearch] = useState<{ open: boolean; initial: string }>({
    open: false,
    initial: "",
  });
  const openQuickSearch = (initial = "") => setQuickSearch({ open: true, initial });
  useShortcut("quickSearch", () => openQuickSearch(), {
    mod: true,
    ignoreInputs: false,
    preventDefault: true,
  });
  useEffect(() => {
    if (quickSearch.open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      // A plain printable character — no shortcuts, no Space (nothing to search for).
      if (e.key.length !== 1 || e.key === " ") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable ||
        document.querySelector('[aria-modal="true"]')
      ) {
        return;
      }
      e.preventDefault();
      setQuickSearch({ open: true, initial: e.key });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [quickSearch.open]);

  useShortcut(
    "switchPage",
    (e) => {
      const index = parseInt(e.key) - 1;
      if (index >= 0 && index < PAGE_ORDER.length) {
        e.preventDefault();
        setCurrentPage(PAGE_ORDER[index]);
      }
    },
    { mod: true, ignoreInputs: false }
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
      case "image":
        if (state.image.slideshowImages.length > 1) {
          return `${t.status.presentingSlideshow} (${state.image.currentIndex + 1}/${state.image.slideshowImages.length})`;
        }
        return t.status.presentingImage;
      default:
        return "";
    }
  };

  return (
    <StageProvider settings={settings} monitors={monitors}>
      <div className="h-screen-safe safe-area-pt flex flex-col md:flex-row bg-gray-900 text-white overflow-hidden overscroll-none">
        {/* Sidebar - hidden on mobile, shown on desktop */}
        <div
          className={`hidden md:flex ${
            sidebarOpen ? "w-48" : "w-14"
          } bg-gray-900 border-r border-gray-800 flex-col transition-all duration-200`}
        >
          {/* Toggle button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-4 text-gray-500 hover:text-gray-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 text-left"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <ChevronLeftIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
          </button>

          {/* Nav items */}
          <nav className={`flex-1 ${sidebarOpen ? "px-2" : "px-1"} space-y-1`}>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`group w-full px-3 py-2.5 flex items-center gap-3 rounded-lg transition-colors overflow-hidden ${
                  currentPage === item.id
                    ? "bg-blue-600/20 text-blue-400"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                }`}
              >
                <span className="relative flex-shrink-0">
                  {item.icon}
                  <NavBadge pages={[item.id]} t={t} />
                </span>
                <span className="text-sm whitespace-nowrap overflow-hidden">{item.label}</span>
                {/* Browsers keep ⌘1–⌘7 for switching tabs, so the page-switch
                    shortcut only really works in the app. */}
                {sidebarOpen && isElectron && (
                  <ShortcutHint
                    shortcut="switchPage"
                    keyLabel={String(PAGE_ORDER.indexOf(item.id) + 1)}
                    quiet
                    className="ml-auto"
                  />
                )}
              </button>
            ))}
          </nav>

          {/* Status bar at bottom */}
          <div className="p-3 border-t border-gray-800">
            <div
              className={`flex items-center gap-2 ${
                sidebarOpen ? "" : "justify-center"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  state.mode === "idle"
                    ? "bg-gray-600"
                    : state.mode === "text"
                    ? "bg-blue-400"
                    : state.mode === "image"
                    ? "bg-purple-400"
                    : "bg-green-400"
                }`}
              />
              {sidebarOpen && (
                <span className="text-xs text-gray-500 truncate">
                  {getStatusText()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Mobile Preview Header - only on mobile */}
          <div className="md:hidden">
            <PreviewHeader
              state={state}
              settings={settings}
              isOpen={preview.isOpen}
              onToggle={preview.toggle}
            />
          </div>

          {/* Header with controls */}
          <header className="flex-shrink-0 bg-gray-900 px-3 md:px-4 py-2 md:py-3 flex flex-col sm:flex-row sm:items-center gap-2 border-b border-gray-800">
            {/* Desktop: the search field takes the title's place — the sidebar
                already marks the current page — so it sits in the same spot,
                at the same width, on every page. */}
            <button
              onClick={() => openQuickSearch()}
              className="hidden md:flex flex-1 max-w-md min-w-0 items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/50 border border-gray-700/50 text-sm text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <SearchIcon className="w-4 h-4" />
              <span className="flex-1 min-w-0 text-left truncate">{t.quickSearch.placeholder}</span>
              <ShortcutHint shortcut="quickSearch" />
            </button>

            {/* Quick controls */}
            <div className="flex items-center justify-end gap-2 sm:gap-3 flex-1 min-h-8">
              {/* While presenting on phones the title gives way to the controls —
                  the bottom nav already shows which page this is */}
              <h1 className={`text-lg font-semibold md:hidden mr-auto min-w-0 truncate ${state.mode === "idle" ? "block" : "hidden sm:block"}`}>
                {navItems.find((i) => i.id === currentPage)?.label}
              </h1>
              <button
                onClick={() => openQuickSearch()}
                className="md:hidden min-w-11 min-h-11 flex items-center justify-center flex-shrink-0 rounded-lg bg-gray-800/50 border border-gray-700/50 text-gray-300 active:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label={t.quickSearch.button}
              >
                <SearchIcon className="w-5 h-5" />
              </button>
              <StageChip state={state} t={t} onOpen={() => setStageSheetOpen(true)} />
              {state.mode === "text" && state.text.slides.length > 0 && (
                <div className="flex items-center bg-gray-800/50 border border-gray-700/50 rounded-lg overflow-hidden">
                  <button
                    onClick={onPrevSlide}
                    disabled={state.text.currentSlide === 0}
                    className="min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 px-3 py-2.5 sm:px-2.5 sm:py-1.5 hover:bg-gray-700 active:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  >
                    <ChevronLeftIcon className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-gray-400 px-2 whitespace-nowrap tabular-nums border-x border-gray-700/50">
                    {state.text.currentSlide + 1} / {state.text.slides.length}
                  </span>
                  <button
                    onClick={onNextSlide}
                    className="min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 px-3 py-2.5 sm:px-2.5 sm:py-1.5 hover:bg-gray-700 active:bg-gray-600 transition-colors flex items-center justify-center text-blue-400"
                  >
                    <ChevronRightIcon className="w-4 h-4" />
                  </button>
                </div>
              )}
              {state.mode === "image" && state.image.slideshowImages.length > 1 && (
                <div className="flex items-center bg-gray-800/50 border border-gray-700/50 rounded-lg overflow-hidden">
                  <button
                    onClick={onPrevImage}
                    disabled={state.image.currentIndex === 0 && !state.image.loop}
                    className="min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 px-3 py-2.5 sm:px-2.5 sm:py-1.5 hover:bg-gray-700 active:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  >
                    <ChevronLeftIcon className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-gray-400 px-2 whitespace-nowrap tabular-nums border-x border-gray-700/50">
                    {state.image.currentIndex + 1} / {state.image.slideshowImages.length}
                  </span>
                  <button
                    onClick={onNextImage}
                    disabled={state.image.currentIndex === state.image.slideshowImages.length - 1 && !state.image.loop}
                    className="min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 px-3 py-2.5 sm:px-2.5 sm:py-1.5 hover:bg-gray-700 active:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-blue-400"
                  >
                    <ChevronRightIcon className="w-4 h-4" />
                  </button>
                </div>
              )}
              {state.mode === "image" && (
                <div className="flex items-center bg-gray-800/50 border border-gray-700/50 rounded-lg overflow-hidden">
                  <button
                    onClick={() => onSetImageFit("fill")}
                    className={`min-h-11 sm:min-h-0 px-2.5 py-2.5 sm:px-2.5 sm:py-1.5 transition-colors flex items-center justify-center ${
                      state.image.fit === "fill"
                        ? "text-blue-400 bg-blue-600/20"
                        : "text-gray-400 hover:bg-gray-700"
                    }`}
                    title={t.imageLibrary.fitFill}
                  >
                    <FitFillIcon className="w-4 h-4 sm:hidden" />
                    <span className="hidden sm:inline text-xs">{t.imageLibrary.fitFill}</span>
                  </button>
                  <button
                    onClick={() => onSetImageFit("fit")}
                    className={`min-h-11 sm:min-h-0 px-2.5 py-2.5 sm:px-2.5 sm:py-1.5 transition-colors flex items-center justify-center ${
                      state.image.fit === "fit"
                        ? "text-blue-400 bg-blue-600/20"
                        : "text-gray-400 hover:bg-gray-700"
                    }`}
                    title={t.imageLibrary.fitContain}
                  >
                    <FitContainIcon className="w-4 h-4 sm:hidden" />
                    <span className="hidden sm:inline text-xs">{t.imageLibrary.fitContain}</span>
                  </button>
                </div>
              )}
              {/* On phones, go-idle sits at the far left — away from Next, the
                  most-pressed button, so a slip can't blank the screen */}
              {state.mode !== "idle" && (
                <button
                  onClick={onGoIdle}
                  aria-label={t.header.goIdle}
                  className="order-first sm:order-none mr-auto sm:mr-0 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 px-3 py-2.5 sm:px-3 sm:py-1.5 rounded-lg flex items-center justify-center gap-1.5 flex-shrink-0 bg-red-600/20 text-red-400 hover:bg-red-600/30 active:bg-red-600/40 border border-red-600/40 transition-colors text-sm"
                >
                  <StopIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.header.goIdle}</span>
                  <ShortcutHint shortcut="goIdle" className="ml-0.5" />
                </button>
              )}
            </div>
          </header>

          {/* Page content with optional preview panel */}
          <div className="flex-1 flex min-h-0 min-w-0">
            {/* Main page content */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-4 min-h-0 min-w-0">
              {children(currentPage, setCurrentPage)}
            </main>

            {/* Desktop Stage: live preview + loaded layers, activity and
                schedules; collapses to a rail of status icons */}
            <div className="hidden md:flex">
              <StageDock
                state={state}
                settings={settings}
                connectedDeviceCount={connectedDeviceCount}
                actions={stageActions}
                onNavigate={setCurrentPage}
                preview={preview}
              />
            </div>
          </div>
        </div>

        {/* Bottom navigation - mobile only */}
        <nav className="md:hidden flex-shrink-0 bg-gray-900 border-t border-gray-800 safe-area-pb">
          <div className="flex relative" ref={moreMenuRef}>
            {primaryNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setCurrentPage(item.id); setMoreMenuOpen(false); }}
                className={`flex-1 py-2.5 flex flex-col items-center gap-1 transition-colors ${
                  currentPage === item.id
                    ? "text-blue-400"
                    : "text-gray-500 active:text-gray-300"
                }`}
              >
                <span className="relative">
                  {item.icon}
                  <NavBadge pages={[item.id]} t={t} />
                </span>
                <span className={`text-xs ${currentPage === item.id ? "font-medium" : ""}`}>{item.label}</span>
              </button>
            ))}

            {/* More button */}
            <button
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className={`flex-1 py-2.5 flex flex-col items-center gap-1 transition-colors ${
                isOverflowPage || moreMenuOpen
                  ? "text-blue-400"
                  : "text-gray-500 active:text-gray-300"
              }`}
            >
              <span className="relative">
                <MoreIcon className="w-6 h-6" />
                <NavBadge pages={overflowNavItems.map((item) => item.id)} t={t} />
              </span>
              <span className={`text-xs ${isOverflowPage ? "font-medium" : ""}`}>{t.nav.more}</span>
            </button>

            {/* More menu backdrop + popup */}
            {moreMenuOpen && (
              <>
              <div className="fixed inset-0 bg-black/40 z-10" style={{ bottom: moreMenuRef.current?.offsetHeight ?? 0 }} onClick={() => setMoreMenuOpen(false)} />
              <div className="absolute bottom-full right-0 mb-2 mr-2 bg-gray-800 border border-gray-700 rounded-xl shadow-lg overflow-hidden min-w-48 z-20">
                {overflowNavItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setCurrentPage(item.id); setMoreMenuOpen(false); }}
                    className={`w-full px-4 py-3 flex items-center gap-3 transition-colors ${
                      currentPage === item.id
                        ? "bg-blue-600/20 text-blue-400"
                        : "text-gray-300 active:bg-gray-700"
                    }`}
                  >
                    <span className="relative">
                      {item.icon}
                      <NavBadge pages={[item.id]} t={t} />
                    </span>
                    <span className="text-sm">{item.label}</span>
                  </button>
                ))}
              </div>
              </>
            )}
          </div>
        </nav>

        <QuickSearch
          open={quickSearch.open}
          initialQuery={quickSearch.initial}
          onClose={() => setQuickSearch((q) => ({ ...q, open: false }))}
          onNavigate={setCurrentPage}
          actions={quickSearchActions}
          t={t}
        />

        <StageNavSync page={currentPage} />
        <StageToasts currentPage={currentPage} onNavigate={setCurrentPage} t={t} />

        <StageSheet
          open={stageSheetOpen}
          onClose={() => setStageSheetOpen(false)}
          state={state}
          settings={settings}
          t={t}
          actions={stageActions}
          onNavigate={setCurrentPage}
          connectedDeviceCount={connectedDeviceCount}
        />
      </div>
    </StageProvider>
  );
}
