import { useEffect, useState } from "react";
import type { DisplayState, AppSettings } from "../../../shared/types";
import type { Translations } from "../../../shared/i18n";
import { CloseIcon } from "../icons/ui";
import { StageSections } from "./StageSections";
import { StageFooter } from "./StageFooter";
import type { NavigateTo, StageActions } from "./types";

interface Props {
  open: boolean;
  onClose: () => void;
  state: DisplayState;
  settings: AppSettings;
  t: Translations;
  actions: StageActions;
  onNavigate: NavigateTo;
  connectedDeviceCount: number;
}

/** Matches the `duration-300` classes below; the sheet unmounts after closing. */
const TRANSITION_MS = 300;

/**
 * The Stage on phones: a bottom sheet over the page, opened only from the
 * header chip and closed by its button or the backdrop — never by a gesture,
 * so a stray swipe mid-service can't open or dismiss it.
 */
export function StageSheet({
  open,
  onClose,
  state,
  settings,
  t,
  actions,
  onNavigate,
  connectedDeviceCount,
}: Props) {
  // Stay mounted through the closing slide, and start the opening one from
  // off-screen: `shown` flips a frame after mounting so the browser has
  // painted the starting position to transition from.
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      className={`md:hidden fixed inset-0 z-40 flex flex-col justify-end ${
        shown ? "" : "pointer-events-none"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={t.stage.title}
    >
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 motion-reduce:transition-none ${
          shown ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`relative max-h-[85vh] flex flex-col bg-gray-800 border-t border-gray-700 rounded-t-2xl safe-area-pb transition-transform duration-300 ease-out motion-reduce:transition-none ${
          shown ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex items-center justify-between pl-4 pr-1 py-1 border-b border-gray-700 flex-shrink-0">
          <span className="text-sm font-medium text-gray-300">{t.stage.title}</span>
          <button
            onClick={onClose}
            className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-gray-400 active:text-white active:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={t.stage.close}
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-4">
          <StageSections
            state={state}
            settings={settings}
            t={t}
            actions={actions}
            onNavigate={(page) => {
              onClose();
              onNavigate(page);
            }}
            variant="sheet"
          />
        </div>

        <div className="flex-shrink-0 border-t border-gray-700 px-4 py-2">
          <StageFooter
            serverPort={settings.serverPort}
            connectedDeviceCount={connectedDeviceCount}
            t={t}
          />
        </div>
      </div>
    </div>
  );
}
