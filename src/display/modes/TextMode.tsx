import { useEffect, useState, useRef, useLayoutEffect } from "react";
import type { TextState } from "../../shared/types";
import { findOptimalFontSize } from "../../shared/utils";

interface Props {
  config: TextState;
}

const MAX_FONT_SIZE = 120;
const MIN_FONT_SIZE = 24;
// `scrollWidth` is rounded to the nearest integer, so a line that is really
// 1824.4px wide reports 1824 and passes a `<= 1824` fit test — then wraps for
// real once it is laid out. Shave a pixel off so sub-pixel overflow can't slip
// through.
const WIDTH_SAFETY_MARGIN = 1;

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
    const availableWidth = container.clientWidth - 96; // container padding already applied

    // For hymns: prevent line wrapping to keep each line on one line
    // For bible: allow wrapping, just fit height
    let optimalSize: number;

    if (isHymn) {
      const origMaxWidth = wrapper.style.maxWidth;
      const origWidth = wrapper.style.width;
      wrapper.style.maxWidth = "none";
      wrapper.style.width = "max-content";
      text.style.whiteSpace = "pre";

      optimalSize = findOptimalFontSize(MIN_FONT_SIZE, MAX_FONT_SIZE, (size) => {
        text.style.fontSize = `${size}px`;
        return (
          text.scrollHeight <= availableHeight &&
          text.scrollWidth <= availableWidth - WIDTH_SAFETY_MARGIN
        );
      });

      wrapper.style.maxWidth = origMaxWidth;
      wrapper.style.width = origWidth;
      text.style.whiteSpace = "pre-line";
    } else {
      // Bible/custom: allow wrapping, just constrain to height
      text.style.whiteSpace = "pre-line";

      optimalSize = findOptimalFontSize(MIN_FONT_SIZE, MAX_FONT_SIZE, (size) => {
        text.style.fontSize = `${size}px`;
        return text.scrollHeight <= availableHeight;
      });
    }

    // The binary search leaves the *last probed* size on the element, which is
    // often one step above the optimum. Normally the re-render below overwrites
    // it, but when optimalSize equals the current state React bails out and the
    // oversized probe sticks — making the text wrap. Write the result directly.
    text.style.fontSize = `${optimalSize}px`;
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
        className={`w-full transition-opacity duration-200 ${
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
