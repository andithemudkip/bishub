import type { DisplayState } from "../../../shared/types";
import type { Translations } from "../../../shared/i18n";
import type { LoadedLayer } from "../../../shared/stage.types";
import { formatDuration } from "../../../shared/utils";
import { HymnsIcon } from "../icons/hymns";
import { VideoIcon } from "../icons/video";
import { ImageIcon } from "../icons/image";
import { AudioIcon } from "../icons/audio";
import { PlayIcon, PauseIcon, StopIcon, CloseIcon } from "../icons/ui";
import { Section } from "./Section";
import type { NavigateTo, StageActions } from "./types";
import type { ActivityTarget } from "../../../shared/stage.types";

interface Props {
  layers: LoadedLayer[];
  state: DisplayState;
  actions: StageActions;
  onNavigate: NavigateTo;
  t: Translations;
}

const ICONS = {
  text: HymnsIcon,
  video: VideoIcon,
  image: ImageIcon,
  audio: AudioIcon,
};

const ghostButton =
  "min-w-8 min-h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-100 hover:bg-gray-700/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors";

/**
 * What the display holds but isn't showing — the showing layer is already the
 * preview above. Hidden layers get Show and Clear; audio, which plays rather
 * than shows, gets its transport controls. The name opens the layer's page,
 * for everything the row doesn't do (volume, seeking, the rest of a playlist).
 */
export function LoadedSection({ layers, state, actions, onNavigate, t }: Props) {
  if (layers.length === 0) return null;

  return (
    <Section section="loaded" title={t.stage.loaded}>
      <ul className="space-y-1.5">
        {layers.map(({ kind }) => {
          const Icon = ICONS[kind];
          const page = layerPage(kind, state);
          const label = (
            <>
              <div className="text-sm truncate">{layerTitle(kind, state, t)}</div>
              <div className="text-xs text-gray-500 truncate">
                {layerDetail(kind, state, t)}
              </div>
            </>
          );
          return (
            <li
              key={kind}
              className="flex items-center gap-2 bg-gray-900/50 border border-gray-700/30 rounded-lg pl-2.5 pr-1 py-1.5"
            >
              <Icon className="w-4 h-4 flex-shrink-0 text-gray-400" />
              {page ? (
                <button
                  onClick={() => onNavigate(page)}
                  className="flex-1 min-w-0 text-left rounded hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {label}
                </button>
              ) : (
                <div className="flex-1 min-w-0">{label}</div>
              )}
              {kind === "audio" ? (
                <>
                  <button
                    onClick={state.audio.playing ? actions.pauseAudio : actions.playAudio}
                    className={ghostButton}
                    aria-label={state.audio.playing ? t.stage.pause : t.stage.play}
                    title={state.audio.playing ? t.stage.pause : t.stage.play}
                  >
                    {state.audio.playing ? (
                      <PauseIcon className="w-4 h-4" />
                    ) : (
                      <PlayIcon className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={actions.stopAudio}
                    className={ghostButton}
                    aria-label={t.stage.stop}
                    title={t.stage.stop}
                  >
                    <StopIcon className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => actions.setMode(kind)}
                    className="px-2 min-h-8 rounded-md text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                  >
                    {t.stage.show}
                  </button>
                  <button
                    onClick={() => actions.clearLayer(kind)}
                    className={ghostButton}
                    aria-label={t.stage.clear}
                    title={t.stage.clear}
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** The page that owns a layer; custom text has none. */
function layerPage(kind: LoadedLayer["kind"], state: DisplayState): ActivityTarget | null {
  switch (kind) {
    case "text":
      return state.text.contentType === "bible"
        ? "bible"
        : state.text.contentType === "hymn"
          ? "hymns"
          : null;
    case "video":
      return "video";
    case "image":
      return "images";
    case "audio":
      return "audio";
  }
}

function layerTitle(kind: LoadedLayer["kind"], state: DisplayState, t: Translations): string {
  switch (kind) {
    case "text":
      return state.text.title || t.stage.layerText;
    case "video":
      return state.video.name || t.stage.layerVideo;
    case "image":
      return t.stage.layerImage;
    case "audio":
      return state.audio.name || t.stage.layerAudio;
  }
}

function layerDetail(kind: LoadedLayer["kind"], state: DisplayState, t: Translations): string {
  switch (kind) {
    case "text":
      return t.stage.slideOf
        .replace("{n}", String(state.text.currentSlide + 1))
        .replace("{total}", String(state.text.slides.length));
    case "video": {
      const { currentTime, duration, playing } = state.video;
      const time = `${formatDuration(currentTime)} / ${formatDuration(duration)}`;
      return playing ? time : `${time} · ${t.stage.paused}`;
    }
    case "image": {
      const { slideshowImages, currentIndex } = state.image;
      return slideshowImages.length > 1
        ? `${t.status.presentingSlideshow} · ${currentIndex + 1}/${slideshowImages.length}`
        : t.status.presentingImage;
    }
    case "audio": {
      const { currentTime, duration, playing } = state.audio;
      const time = `${formatDuration(currentTime)} / ${formatDuration(duration)}`;
      return playing ? time : `${time} · ${t.stage.paused}`;
    }
  }
}
