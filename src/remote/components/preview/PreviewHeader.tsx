import type { DisplayState, AppSettings } from "../../../shared/types";
import { getTranslations } from "../../../shared/i18n";
import { ChevronUpIcon, ChevronDownIcon } from "../icons/ui";
import LivePreview from "./LivePreview";

interface Props {
  state: DisplayState;
  settings: AppSettings;
  isOpen: boolean;
  onToggle: () => void;
}

const PREVIEW_HEIGHT = 200;
const COLLAPSED_HEIGHT = 44;

export default function PreviewHeader({
  state,
  settings,
  isOpen,
  onToggle,
}: Props) {
  const t = getTranslations(settings.language);
  const isDisplaying = state.mode !== "idle";

  // The preview itself is inert — it's where the operator's eyes and thumb
  // are while following the text, so a stray tap must not hide it. Collapse
  // and expand only through the explicit buttons below.
  const height = !isDisplaying ? 0 : isOpen ? PREVIEW_HEIGHT : COLLAPSED_HEIGHT;

  return (
    <div
      className={`bg-gray-850 border-b border-gray-700 overflow-hidden transition-all duration-300 ease-in-out ${
        isDisplaying ? "opacity-100" : "opacity-0"
      }`}
      style={{ height }}
    >
      {isDisplaying && isOpen && (
        <div className="h-full flex flex-col p-2">
          {/* Preview container with 16:9 aspect */}
          <div className="flex-1 flex items-center justify-center min-h-0">
            <div
              className="h-full rounded-lg overflow-hidden border border-gray-700 relative"
              style={{ aspectRatio: "16/9" }}
            >
              <LivePreview
                state={state}
                settings={settings}
                showLabels={false}
              />
              <button
                onClick={onToggle}
                className="absolute bottom-0 right-0 min-w-11 min-h-11 flex items-end justify-end p-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
                aria-label={t.preview.collapse}
                title={t.preview.collapse}
              >
                <span className="bg-black/60 text-white/70 rounded-md p-1">
                  <ChevronUpIcon className="w-4 h-4" />
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
      {isDisplaying && !isOpen && (
        <button
          onClick={onToggle}
          className="w-full h-full flex items-center justify-center gap-2 text-sm text-gray-400 active:text-gray-200 active:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
        >
          <ChevronDownIcon className="w-4 h-4" />
          {t.preview.expand}
        </button>
      )}
    </div>
  );
}

export { PREVIEW_HEIGHT };
