import { useEffect, useState, useRef, useLayoutEffect } from "react";
import type { DisplayState, AppSettings } from "../../../shared/types";
import { getTranslations, type Language } from "../../../shared/i18n";
import { formatDuration, findOptimalFontSize, getApiUrl } from "../../../shared/utils";
import { ImageIcon } from "../icons/image";

// Virtual resolution matching a typical display (used for scaled-down preview)
const VIRTUAL_WIDTH = 1920;
const VIRTUAL_HEIGHT = 1080;

// Must match TextMode.tsx constants
const MAX_FONT_SIZE = 120;
const MIN_FONT_SIZE = 24;

interface Props {
  state: DisplayState;
  settings: AppSettings;
  showLabels?: boolean;
}

const LANGUAGE_LOCALES: Record<Language, string> = {
  ro: "ro-RO",
  en: "en-US",
};

export default function LivePreview({
  state,
  settings,
  showLabels = true,
}: Props) {
  if (state.mode === "idle") {
    return <IdlePreview state={state} language={settings.language} />;
  }

  if (state.mode === "text") {
    return (
      <TextPreview state={state} settings={settings} showLabels={showLabels} />
    );
  }

  if (state.mode === "video") {
    return <VideoPreview state={state} />;
  }

  if (state.mode === "image") {
    return <ImagePreview state={state} />;
  }

  return null;
}

/**
 * Renders a single slide at virtual (1920×1080) resolution with the exact same
 * structure and styling as TextMode.tsx, then scales it down to fit the preview.
 */
function ScaledSlide({
  content,
  title,
  contentType,
  slides,
  currentSlide,
}: {
  content: string;
  title: string;
  contentType: string;
  slides: string[];
  currentSlide: number;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [scale, setScale] = useState(0);
  const [fontSize, setFontSize] = useState(MAX_FONT_SIZE);

  // Track preview container size to compute scale
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const update = () => {
      const s = Math.min(
        el.clientWidth / VIRTUAL_WIDTH,
        el.clientHeight / VIRTUAL_HEIGHT,
      );
      setScale(s);
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Compute font size using TextMode's exact algorithm at virtual resolution
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const text = textRef.current;
    if (!wrapper || !text || !content || scale === 0) return;

    const isHymn = contentType === "hymn";
    const availableHeight = VIRTUAL_HEIGHT - 160;
    const availableWidth = VIRTUAL_WIDTH - 96;

    let optimalSize: number;

    if (isHymn) {
      const origMaxWidth = wrapper.style.maxWidth;
      const origWidth = wrapper.style.width;
      wrapper.style.maxWidth = "none";
      wrapper.style.width = "max-content";
      text.style.whiteSpace = "pre";

      optimalSize = findOptimalFontSize(MIN_FONT_SIZE, MAX_FONT_SIZE, (size) => {
        text.style.fontSize = `${size}px`;
        return text.scrollHeight <= availableHeight && text.scrollWidth <= availableWidth;
      });

      wrapper.style.maxWidth = origMaxWidth;
      wrapper.style.width = origWidth;
      text.style.whiteSpace = "pre-line";
    } else {
      text.style.whiteSpace = "pre-line";

      optimalSize = findOptimalFontSize(MIN_FONT_SIZE, MAX_FONT_SIZE, (size) => {
        text.style.fontSize = `${size}px`;
        return text.scrollHeight <= availableHeight;
      });
    }

    setFontSize(optimalSize);
  }, [content, contentType, scale]);

  return (
    <div ref={outerRef} className="w-full h-full overflow-hidden relative">
      <div
        style={{
          width: VIRTUAL_WIDTH,
          height: VIRTUAL_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {/* Exact replica of TextMode's render output */}
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black p-12">
          {title && (
            <div className="absolute top-8 left-0 right-0 text-center">
              <h1 className="text-3xl font-light text-white/60 tracking-wide">
                {title}
              </h1>
            </div>
          )}

          <div
            ref={wrapperRef}
            className={`w-full ${
              contentType === "bible" ? "text-left" : "text-center"
            }`}
          >
            <p
              ref={textRef}
              style={{ fontSize: `${fontSize}px` }}
              className="font-display leading-relaxed text-white whitespace-pre-line"
            >
              {content}
            </p>
          </div>

          <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2">
            {slides.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentSlide ? "bg-white w-6" : "bg-white/30"
                }`}
              />
            ))}
          </div>

          <div className="absolute bottom-8 right-8 text-white/40 text-lg">
            {currentSlide + 1} / {slides.length}
          </div>
        </div>
      </div>
    </div>
  );
}

// Text mode preview — renders a scaled-down replica of the real display
function TextPreview({
  state,
  settings,
  showLabels,
}: {
  state: DisplayState;
  settings: AppSettings;
  showLabels: boolean;
}) {
  const { text } = state;
  const currentSlideContent = text.slides[text.currentSlide] || "";
  const nextSlideContent = text.slides[text.currentSlide + 1] || "";
  const t = getTranslations(settings.language);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Current Slide */}
      <div className="flex-1 min-h-0 flex flex-col relative">
        {showLabels && (
          <div className="flex-shrink-0 text-[10px] text-white/30 uppercase tracking-widest text-center h-[20px] flex items-center justify-center select-none hidden md:flex">
            {t.preview?.current || "Current"}
          </div>
        )}
        <div className="flex-1 min-h-0">
          <ScaledSlide
            content={currentSlideContent}
            title={text.title}
            contentType={text.contentType}
            slides={text.slides}
            currentSlide={text.currentSlide}
          />
        </div>
      </div>

      {/* Next Slide (Desktop Only) */}
      <div className="hidden md:flex flex-1 min-h-0 flex-col border-t border-white/10 pt-1">
        {showLabels && (
          <div className="flex-shrink-0 text-[10px] text-white/30 uppercase tracking-widest text-center h-[20px] flex items-center justify-center select-none">
            {t.preview?.next || "Next"}
          </div>
        )}
        <div className="flex-1 min-h-0">
          {nextSlideContent ? (
            <div className="w-full h-full opacity-70">
              <ScaledSlide
                content={nextSlideContent}
                title={text.title}
                contentType={text.contentType}
                slides={text.slides}
                currentSlide={text.currentSlide + 1}
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/20 text-xs italic">
              {t.preview?.endOfSlides || "End of slides"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Idle mode preview
function IdlePreview({
  state,
  language,
}: {
  state: DisplayState;
  language: Language;
}) {
  const { idle } = state;
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const locale = LANGUAGE_LOCALES[language] || "en-US";

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: language === "en",
    });
  };

  // In web context, file:// URLs don't work, so just show gradient
  const backgroundStyle = {
    background:
      "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  };

  return (
    <div
      className="w-full h-full flex items-center justify-center relative"
      style={backgroundStyle}
    >
      <div className="absolute inset-0 bg-black/30" />
      {idle.showClock && (
        <div className="relative z-10 text-white text-center">
          <div className="text-2xl font-light">{formatTime(time)}</div>
        </div>
      )}
      {/* Wallpaper indicator */}
      {idle.wallpaper && (
        <div className="absolute bottom-1 left-1 text-[8px] text-white/40">
          🖼
        </div>
      )}
      {/* Audio overlay (mirrors the real AudioWidget) */}
      <AudioOverlay audio={state.audio} />
    </div>
  );
}

// Miniature audio widget overlay (mirrors AudioWidget on the real display)
function AudioOverlay({ audio }: { audio: DisplayState["audio"] }) {
  if (!audio.src) return null;

  const progress =
    audio.duration > 0 ? (audio.currentTime / audio.duration) * 100 : 0;

  const { queue } = audio;
  const hasQueue = queue.source !== null && queue.tracks.length > 0;
  const upNextName = hasQueue
    ? queue.index + 1 < queue.tracks.length
      ? queue.tracks[queue.index + 1].name
      : queue.loop
        ? queue.tracks[0].name
        : null
    : null;

  return (
    <div className="absolute bottom-2 right-2 z-10 bg-black/60 backdrop-blur-sm rounded px-2 py-1 max-w-[60%]">
      <div className="flex items-center gap-1.5">
        <span className="text-[8px] text-white/70 flex-shrink-0">
          {audio.playing ? "♫" : "❚❚"}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <div className="text-[7px] text-white/60 truncate">
              {audio.name || "Audio"}
            </div>
            {hasQueue && (
              <div className="text-[6px] text-white/40 flex-shrink-0 tabular-nums">
                {queue.index + 1}/{queue.tracks.length}
              </div>
            )}
          </div>
          {hasQueue && upNextName && (
            <div className="text-[6px] text-white/35 truncate">
              {upNextName}
            </div>
          )}
          <div className="h-[3px] bg-white/20 rounded-full overflow-hidden mt-0.5">
            <div
              className="h-full bg-white/70 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <span className="text-[7px] text-white/40 flex-shrink-0 tabular-nums">
          {formatDuration(audio.currentTime)}
        </span>
      </div>
    </div>
  );
}

// Video mode preview — shows thumbnail or streams video when available
function VideoPreview({ state }: { state: DisplayState }) {
  const { video } = state;
  const [thumbError, setThumbError] = useState(false);

  // Reset thumb error when video changes
  useEffect(() => {
    setThumbError(false);
  }, [video.videoId, video.src]);

  if (!video.src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <span className="text-white/50 text-xs">No video</span>
      </div>
    );
  }

  const filename =
    video.src
      .split("/")
      .pop()
      ?.replace(/\.[^/.]+$/, "") || "Video";

  const progress =
    video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0;

  const thumbnailUrl = video.videoId
    ? getApiUrl(`/api/videos/thumbnail/${video.videoId}`)
    : null;

  return (
    <div className="w-full h-full bg-black flex flex-col relative overflow-hidden">
      {/* Thumbnail background */}
      {thumbnailUrl && !thumbError && (
        <img
          src={thumbnailUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-contain"
          onError={() => setThumbError(true)}
        />
      )}

      {/* Overlay with controls info */}
      <div className="flex-1 flex flex-col items-center justify-center gap-1 px-3 relative z-10">
        {/* Play/pause indicator — only show prominently when paused or no thumbnail */}
        <div
          className={`flex items-center justify-center rounded-full ${
            thumbnailUrl && !thumbError
              ? "bg-black/50 w-8 h-8"
              : ""
          }`}
        >
          <svg
            className={`${thumbnailUrl && !thumbError ? "w-4 h-4" : "w-5 h-5"} text-white/80`}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            {video.playing ? (
              <path d="M8 5v14l11-7z" />
            ) : (
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            )}
          </svg>
        </div>

        {/* Filename — show below if no thumbnail */}
        {(!thumbnailUrl || thumbError) && (
          <span className="text-[10px] text-white/50 truncate max-w-[90%]">
            {filename}
          </span>
        )}
      </div>

      {/* Bottom bar with time and progress */}
      <div className="relative z-10 flex-shrink-0">
        <div className="flex items-center justify-between px-2 py-0.5 bg-gradient-to-t from-black/80 to-transparent">
          <span className="text-[9px] text-white/60 tabular-nums">
            {formatDuration(video.currentTime)}
          </span>
          <span className="text-[9px] text-white/60 tabular-nums">
            {formatDuration(video.duration)}
          </span>
        </div>
        <div className="h-1 bg-gray-800">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Image mode preview
function ImagePreview({ state }: { state: DisplayState }) {
  const { image } = state;
  const [thumbError, setThumbError] = useState(false);

  useEffect(() => {
    setThumbError(false);
  }, [image.imageId]);

  if (!image.src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <span className="text-white/50 text-xs">No image</span>
      </div>
    );
  }

  const isSlideshow = image.slideshowImages.length > 1;
  const imageUrl = image.imageId
    ? getApiUrl(`/api/images/thumbnail/${image.imageId}`)
    : null;

  return (
    <div className="w-full h-full bg-black relative overflow-hidden">
      {imageUrl && !thumbError ? (
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: image.fit === "fill" ? "cover" : "contain" }}
          onError={() => setThumbError(true)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-white/30" />
        </div>
      )}

      {/* Slide counter */}
      {isSlideshow && (
        <div className="absolute bottom-1.5 right-1.5 bg-black/60 px-1.5 rounded z-10 flex items-center h-5">
          <span className="text-[9px] text-white/80 tabular-nums">
            {image.currentIndex + 1} / {image.slideshowImages.length}
          </span>
        </div>
      )}
    </div>
  );
}
