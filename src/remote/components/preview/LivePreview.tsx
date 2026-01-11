import { useEffect, useState, useRef, useLayoutEffect } from "react";
import type { DisplayState, AppSettings } from "../../../shared/types";
import { getTranslations, type Language } from "../../../shared/i18n";

const MAX_PREVIEW_FONT = 32;
const MIN_PREVIEW_FONT = 6;

interface Props {
  state: DisplayState;
  settings: AppSettings;
}

const LANGUAGE_LOCALES: Record<Language, string> = {
  ro: "ro-RO",
  en: "en-US",
};

export default function LivePreview({ state, settings }: Props) {
  if (state.mode === "idle") {
    return <IdlePreview state={state} language={settings.language} />;
  }

  if (state.mode === "text") {
    return <TextPreview state={state} settings={settings} />;
  }

  if (state.mode === "video") {
    return <VideoPreview state={state} />;
  }

  return null;
}

// Reusable component for auto-scaling text
function SlideText({
  content,
  align,
  label,
  className = "",
}: {
  content: string;
  align: "left" | "center";
  label?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [fontSize, setFontSize] = useState(12);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Watch for container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Capture initial size immediately
    setContainerSize({
      width: container.clientWidth,
      height: container.clientHeight,
    });

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Calculate optimal font size when text or container changes
  useLayoutEffect(() => {
    const textEl = textRef.current;
    if (!textEl || !content) return;

    // Use captured dimensions - subtract label height estimate if label exists
    const labelHeight = label ? 20 : 0;
    const availableHeight = containerSize.height - labelHeight;
    const availableWidth = containerSize.width;

    if (availableHeight <= 0 || availableWidth <= 0) return;

    // Binary search for optimal font size
    let min = MIN_PREVIEW_FONT;
    let max = MAX_PREVIEW_FONT;
    let optimalSize = MIN_PREVIEW_FONT;

    while (min <= max) {
      const mid = Math.floor((min + max) / 2);
      textEl.style.fontSize = `${mid}px`;

      const fits =
        textEl.scrollHeight <= availableHeight &&
        textEl.scrollWidth <= availableWidth;

      if (fits) {
        optimalSize = mid;
        min = mid + 1;
      } else {
        max = mid - 1;
      }
    }

    setFontSize(Math.max(MIN_PREVIEW_FONT, optimalSize));
  }, [content, containerSize, label]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex flex-col ${className}`}
    >
      {label && (
        <div className="flex-shrink-0 text-[10px] text-white/30 uppercase tracking-widest text-center h-[20px] flex items-center justify-center select-none">
          {label}
        </div>
      )}
      <div
        className={`flex-1 min-h-0 w-full flex items-center overflow-hidden ${
          align === "left" ? "justify-start" : "justify-center"
        }`}
      >
        <p
          ref={textRef}
          className={`text-white leading-snug whitespace-pre-line ${
            align === "left" ? "text-left" : "text-center"
          }`}
          style={{ fontSize: `${fontSize}px` }}
        >
          {content}
        </p>
      </div>
    </div>
  );
}

// Text mode preview with dynamic font scaling
function TextPreview({
  state,
  settings,
}: {
  state: DisplayState;
  settings: AppSettings;
}) {
  const { text } = state;
  const currentSlide = text.slides[text.currentSlide] || "";
  const nextSlide = text.slides[text.currentSlide + 1] || "";
  const align = text.contentType === "bible" ? "left" : "center";
  const t = getTranslations(settings.language);

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-b from-gray-900 to-black p-2 overflow-hidden">
      {/* Title - fixed height */}
      {text.title && (
        <div className="flex-shrink-0 text-[10px] text-white/50 mb-1 truncate w-full text-center">
          {text.title}
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 min-h-0 flex flex-col gap-2">
        {/* Current Slide */}
        <div className="flex-1 min-h-0">
          <SlideText
            content={currentSlide}
            align={align}
            label={t.preview?.current || "Current"}
          />
        </div>

        {/* Next Slide (Desktop Only) */}
        <div className="hidden md:flex flex-1 min-h-0 border-t border-white/10 pt-2">
          {nextSlide ? (
            <SlideText
              content={nextSlide}
              align={align}
              label={t.preview?.next || "Next"}
              className="opacity-70"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/20 text-xs italic">
              {t.preview?.endOfSlides || "End of slides"}
            </div>
          )}
        </div>
      </div>

      {/* Slide indicator - fixed height */}
      <div className="flex-shrink-0 flex items-center justify-center gap-1 mt-1 h-4">
        {text.slides.length <= 10 ? (
          text.slides.map((_, index) => (
            <div
              key={index}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                index === text.currentSlide ? "bg-white w-3" : "bg-white/30"
              }`}
            />
          ))
        ) : (
          <span className="text-[10px] text-white/50">
            {text.currentSlide + 1} / {text.slides.length}
          </span>
        )}
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
    </div>
  );
}

// Video mode preview - static preview (no actual video playback in web context)
function VideoPreview({ state }: { state: DisplayState }) {
  const { video } = state;

  if (!video.src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <span className="text-white/50 text-xs">No video</span>
      </div>
    );
  }

  // Extract filename from path
  const filename =
    video.src
      .split("/")
      .pop()
      ?.replace(/\.[^/.]+$/, "") || "Video";

  // Progress percentage
  const progress =
    video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0;

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="w-full h-full bg-black flex flex-col relative">
      {/* Video placeholder with play state */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Large play/pause icon */}
        <div className="text-4xl text-white/80 mb-2">
          {video.playing ? "▶" : "❚❚"}
        </div>
        {/* Video name */}
        <div className="text-[10px] text-white/60 px-2 text-center truncate max-w-full">
          {filename}
        </div>
      </div>

      {/* Time display */}
      <div className="absolute bottom-3 left-0 right-0 text-center text-[10px] text-white/50">
        {formatTime(video.currentTime)} / {formatTime(video.duration)}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-700 flex-shrink-0">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
