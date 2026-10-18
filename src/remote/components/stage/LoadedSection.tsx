import type { DisplayState } from "../../../shared/types";
import type { Translations } from "../../../shared/i18n";
import type { LoadedLayer } from "../../../shared/stage.types";
import { formatDuration } from "../../../shared/utils";
import { HymnsIcon } from "../icons/hymns";
import { BibleIcon } from "../icons/bible";
import { VideoIcon } from "../icons/video";
import { ImageIcon } from "../icons/image";
import { AudioIcon } from "../icons/audio";
import { CloseIcon, PencilIcon } from "../icons/ui";
import { Section } from "./Section";
import { ghostButton } from "./styles";
import { Transport } from "./Transport";
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
  video: VideoIcon,
  image: ImageIcon,
  audio: AudioIcon,
};

const TEXT_ICONS = {
  hymn: HymnsIcon,
  bible: BibleIcon,
  custom: PencilIcon,
};

/**
 * What the display holds but isn't showing — the showing layer is already the
 * preview above. Hidden layers get Show and Clear; audio, which plays rather
 * than shows, gets the same transport row as the video on screen. The name opens the layer's page,
 * for everything the row doesn't do (volume, seeking, the rest of a playlist).
 */
export function LoadedSection({ layers, state, actions, onNavigate, t }: Props) {
  if (layers.length === 0) return null;

  return (
    <Section section="loaded" title={t.stage.loaded}>
      <ul className="space-y-1.5">
        {layers.map(({ kind }) => {
          const Icon = kind === "text" ? TEXT_ICONS[state.text.contentType] : ICONS[kind];
          const page = layerPage(kind, state);
          const detail = layerDetail(kind, state, t);
          const label = (
            <>
              <div className="text-sm truncate">{layerTitle(kind, state, t)}</div>
              {detail && <div className="text-xs text-gray-500 truncate">{detail}</div>}
            </>
          );
          return (
            <li
              key={kind}
              className="bg-gray-900/50 border border-gray-700/30 rounded-lg pl-2.5 pr-1 py-1.5"
            >
              <div className="flex items-center gap-2">
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
                {kind !== "audio" && (
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
              </div>
              {kind === "audio" && (
                <div className="mt-1 -ml-1.5">
                  <Transport
                    playing={state.audio.playing}
                    currentTime={state.audio.currentTime}
                    duration={state.audio.duration}
                    onPlay={actions.playAudio}
                    onPause={actions.pauseAudio}
                    onStop={actions.stopAudio}
                    onSeek={actions.seekAudio}
                    seekLabel={t.stage.seekAudio}
                    t={t}
                  />
                </div>
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

function layerDetail(
  kind: LoadedLayer["kind"],
  state: DisplayState,
  t: Translations,
): string | null {
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
    case "audio":
      // Its transport row shows the time and whether it's playing.
      return null;
  }
}
