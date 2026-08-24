import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AudioPlaylist } from "../../shared/audioPlaylist.types";
import type { Translations } from "../../shared/i18n";
import { PlusIcon, ChevronRightIcon, PlayIcon, QueueListIcon } from "./icons/ui";

interface Props {
  playlists: AudioPlaylist[];
  onPlayNext: () => void;
  onAddToQueue: () => void;
  onAddToPlaylist: (playlistId: string) => void;
  onCreatePlaylist: () => void;
  t: Translations;
  /** Optional extra classes for the trigger button. */
  className?: string;
}

interface MenuPosition {
  left: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

const MENU_WIDTH = 208; // w-52
const VIEWPORT_MARGIN = 8;
const TRIGGER_GAP = 4;
/** Below this much room underneath the trigger, the menu flips above it. */
const FLIP_THRESHOLD = 180;

/**
 * Anchors the menu to the trigger using fixed coordinates so it can be
 * portalled to <body>. Rendering it in place would clip it twice over — the
 * library row sets `overflow-hidden` and the list is inside an
 * `overflow-y-auto` scroll container.
 */
function computePosition(trigger: HTMLElement): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
  const spaceAbove = rect.top - VIEWPORT_MARGIN;
  const flipUp = spaceBelow < FLIP_THRESHOLD && spaceAbove > spaceBelow;

  // Right-align to the trigger, then clamp so narrow viewports can't push it
  // off either edge.
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN)
  );

  return flipUp
    ? {
        left,
        bottom: window.innerHeight - rect.top + TRIGGER_GAP,
        maxHeight: spaceAbove - TRIGGER_GAP,
      }
    : {
        left,
        top: rect.bottom + TRIGGER_GAP,
        maxHeight: spaceBelow - TRIGGER_GAP,
      };
}

/**
 * Per-row "+" popover: Play next · Add to queue · Add to playlist (inline
 * accordion of existing playlists + New playlist…).
 */
export default function AudioTrackAddMenu({
  playlists,
  onPlayNext,
  onAddToQueue,
  onAddToPlaylist,
  onCreatePlaylist,
  t,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setSubmenuOpen(false);
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    setPosition(computePosition(triggerRef.current));
  }, [open]);

  useEffect(() => {
    if (!open) return;

    // The menu lives in a portal, so it is outside triggerRef in the DOM —
    // both refs have to be consulted or the first click inside would close it.
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      close();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    // Capture phase so the library's own scroll container is caught too.
    const handleScroll = () => close();

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", close);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  const itemClass =
    "w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors text-left";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setSubmenuOpen(false);
          setOpen((v) => !v);
        }}
        className={`p-2 sm:p-2.5 hover:bg-gray-700 rounded transition-colors ${className}`}
        title={t.audioLibrary.addToQueue}
        aria-label={t.audioLibrary.addToQueue}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <PlusIcon className="w-4 h-4" />
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: "fixed",
              left: position.left,
              top: position.top,
              bottom: position.bottom,
              width: MENU_WIDTH,
              maxHeight: position.maxHeight,
            }}
            className="z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 overflow-y-auto overscroll-contain"
            // React portals bubble events through the React tree, so without
            // this the row's onSelect would fire and start playing the track.
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onPlayNext();
                close();
              }}
              className={itemClass}
            >
              <PlayIcon className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
              {t.audioLibrary.playNext}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onAddToQueue();
                close();
              }}
              className={itemClass}
            >
              <QueueListIcon className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
              {t.audioLibrary.addToQueue}
            </button>

            {/* Inline accordion rather than a flyout: a second 208px panel
                beside this one does not fit a 320px viewport. */}
            <button
              type="button"
              role="menuitem"
              onClick={() => setSubmenuOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors text-left"
              aria-expanded={submenuOpen}
            >
              <span className="truncate">{t.audioLibrary.addToPlaylist}</span>
              <ChevronRightIcon
                className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 transition-transform ${
                  submenuOpen ? "rotate-90" : ""
                }`}
              />
            </button>

            {submenuOpen && (
              <div className="border-t border-gray-700/50 mt-1 pt-1">
                {playlists.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-500">
                    {t.audioLibrary.noPlaylists}
                  </div>
                )}
                {playlists.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onAddToPlaylist(p.id);
                      close();
                    }}
                    className="w-full pl-6 pr-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors text-left truncate"
                  >
                    {p.name}
                  </button>
                ))}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onCreatePlaylist();
                    close();
                  }}
                  className="w-full flex items-center gap-2 pl-6 pr-3 py-2 text-sm text-blue-400 hover:bg-gray-700 transition-colors text-left"
                >
                  <PlusIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  {t.audioLibrary.newPlaylist}
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
