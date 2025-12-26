import type { DisplayState, AppSettings } from "../../../shared/types";
import { getTranslations } from "../../../shared/i18n";
import LivePreview from "./LivePreview";

interface Props {
  state: DisplayState;
  settings: AppSettings;
  isOpen: boolean;
  onToggle: () => void;
}

const PREVIEW_HEIGHT = 150;

export default function PreviewHeader({
  state,
  settings,
  isOpen,
  onToggle,
}: Props) {
  const t = getTranslations(settings.language);
  const isDisplaying = state.mode !== "idle";

  return (
    <div
      className={`bg-gray-850 border-b border-gray-700 overflow-hidden transition-all duration-300 ease-in-out ${
        isOpen ? "opacity-100" : "opacity-0"
      }`}
      style={{ height: isOpen ? PREVIEW_HEIGHT : 0 }}
    >
      {isDisplaying && (
        <div className="h-full flex flex-col p-2">
          {/* Preview container with 16:9 aspect */}
          <div className="flex-1 flex items-center justify-center min-h-0">
            <div
              className="h-full rounded-lg overflow-hidden border border-gray-700 relative"
              style={{ aspectRatio: "16/9" }}
              onClick={onToggle}
            >
              <LivePreview state={state} settings={settings} />
              {/* Tap to collapse hint */}
              <div className="absolute bottom-1 right-1 text-[8px] text-white/30 bg-black/50 px-1 rounded">
                {t.preview?.tapToCollapse || "Tap to hide"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { PREVIEW_HEIGHT };
