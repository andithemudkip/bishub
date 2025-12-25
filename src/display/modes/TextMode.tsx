import { useEffect, useState, useRef, useLayoutEffect } from "react";
import type { TextState } from "../../shared/types";

interface Props {
  config: TextState;
}

const MAX_FONT_SIZE = 120;
const MIN_FONT_SIZE = 24;

export default function TextMode({ config }: Props) {
  const [visible, setVisible] = useState(true);
  const [displayedSlide, setDisplayedSlide] = useState(config.currentSlide);
  const [fontSize, setFontSize] = useState(MAX_FONT_SIZE);

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  const currentText = config.slides[displayedSlide] || "";

  // Handle slide transitions
  useEffect(() => {
    if (config.currentSlide !== displayedSlide) {
      setVisible(false);
      const timer = setTimeout(() => {
        setDisplayedSlide(config.currentSlide);
        setVisible(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [config.currentSlide, displayedSlide]);

  // Calculate optimal font size when text changes
  useLayoutEffect(() => {
    const container = containerRef.current;
    const wrapper = wrapperRef.current;
    const text = textRef.current;
    if (!container || !wrapper || !text || !currentText) return;

    const isHymn = config.contentType === "hymn";

    // Get available space
    const availableHeight = container.clientHeight - 160; // Reserve space for title and slide indicators
    // max-w-5xl = 64rem = 1024px, but also respect container width
    const availableWidth = Math.min(1024, container.clientWidth - 96);

    // Binary search for optimal font size
    let min = MIN_FONT_SIZE;
    let max = MAX_FONT_SIZE;
    let optimalSize = MIN_FONT_SIZE;

    // For hymns: prevent line wrapping to keep each line on one line
    // For bible: allow wrapping, just fit height
    if (isHymn) {
      const origMaxWidth = wrapper.style.maxWidth;
      const origWidth = wrapper.style.width;
      wrapper.style.maxWidth = "none";
      wrapper.style.width = "max-content";
      text.style.whiteSpace = "pre";

      while (min <= max) {
        const mid = Math.floor((min + max) / 2);
        text.style.fontSize = `${mid}px`;

        const fits =
          text.scrollHeight <= availableHeight &&
          text.scrollWidth <= availableWidth;

        if (fits) {
          optimalSize = mid;
          min = mid + 1;
        } else {
          max = mid - 1;
        }
      }

      wrapper.style.maxWidth = origMaxWidth;
      wrapper.style.width = origWidth;
      text.style.whiteSpace = "pre-line";
    } else {
      // Bible/custom: allow wrapping, just constrain to height
      text.style.whiteSpace = "pre-line";

      while (min <= max) {
        const mid = Math.floor((min + max) / 2);
        text.style.fontSize = `${mid}px`;

        const fits = text.scrollHeight <= availableHeight;

        if (fits) {
          optimalSize = mid;
          min = mid + 1;
        } else {
          max = mid - 1;
        }
      }
    }

    setFontSize(optimalSize);
  }, [currentText, displayedSlide, config.contentType]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black p-12"
    >
      {/* Title */}
      {config.title && (
        <div className="absolute top-8 left-0 right-0 text-center">
          <h1 className="text-3xl font-light text-white/60 tracking-wide">
            {config.title}
          </h1>
        </div>
      )}

      {/* Main text content */}
      <div
        ref={wrapperRef}
        className={`w-full max-w-5xl transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        } ${config.contentType === "bible" ? "text-left" : "text-center"}`}
      >
        <p
          ref={textRef}
          style={{ fontSize: `${fontSize}px` }}
          className="font-display leading-relaxed text-white whitespace-pre-line"
        >
          {currentText}
        </p>
      </div>

      {/* Slide indicator */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2">
        {config.slides.map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-all ${
              index === displayedSlide ? "bg-white w-6" : "bg-white/30"
            }`}
          />
        ))}
      </div>

      {/* Slide number */}
      <div className="absolute bottom-8 right-8 text-white/40 text-lg">
        {displayedSlide + 1} / {config.slides.length}
      </div>
    </div>
  );
}
