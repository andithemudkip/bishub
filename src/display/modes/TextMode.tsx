import React, { useEffect, useState, useRef, useLayoutEffect } from "react";
import type { TextState, AppSettings } from "../../shared/types";
import {
  findOptimalFontSize,
  getChromeMetrics,
  reservedChromeHeight,
} from "../../shared/utils";
import {
  resolveSlideTheme,
  slideBackgroundStyle,
  SLIDE_TEXT_TRANSITION,
} from "../../shared/slideTheme";
import SlideIndicator from "../../components/SlideIndicator";

interface Props {
  config: TextState;
  settings: AppSettings;
}

const MAX_FONT_SIZE = 120;
const MIN_FONT_SIZE = 24;
// `scrollWidth` is rounded to the nearest integer, so a line that is really
// 1824.4px wide reports 1824 and passes a `<= 1824` fit test — then wraps for
// real once it is laid out. Shave a pixel off so sub-pixel overflow can't slip
// through.
const WIDTH_SAFETY_MARGIN = 1;

export default function TextMode({ config, settings }: Props) {
  const [visible, setVisible] = useState(true);
  const [displayedSlide, setDisplayedSlide] = useState(config.currentSlide);
  const [fontSize, setFontSize] = useState(MAX_FONT_SIZE);

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLDivElement>(null);

  const currentText = config.slides[displayedSlide] || "";
  const chrome = getChromeMetrics(settings);
  const theme = resolveSlideTheme(settings, config.contentType);

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

    // Get available space. The chrome is measured rather than assumed a fixed
    // height, so a larger title (or one that wraps) shrinks the body instead of
    // colliding with it.
    const availableHeight =
      container.clientHeight -
      reservedChromeHeight(
        titleRef.current?.offsetHeight ?? 0,
        dotsRef.current?.offsetHeight ?? 0,
        counterRef.current?.offsetHeight ?? 0,
      );
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
    // The chrome metrics are dependencies because they change how much room is
    // left for the body — the refs above are read after React has committed the
    // new sizes.
  }, [
    currentText,
    displayedSlide,
    config.contentType,
    config.title,
    chrome.titleLineHeight,
    chrome.counterLineHeight,
    chrome.dotSize,
  ]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col items-center justify-center p-12"
      style={slideBackgroundStyle(theme) as React.CSSProperties}
    >
      {/* Title */}
      {config.title && (
        <div ref={titleRef} className="absolute top-8 left-0 right-0 text-center px-12">
          <h1
            style={{
              fontSize: `${chrome.titleFontSize}px`,
              lineHeight: `${chrome.titleLineHeight}px`,
              color: theme.title,
              textShadow: theme.textShadow,
              transition: SLIDE_TEXT_TRANSITION,
            }}
            className="font-light tracking-wide"
          >
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
          style={{
            fontSize: `${fontSize}px`,
            color: theme.body,
            textShadow: theme.textShadow,
            transition: SLIDE_TEXT_TRANSITION,
          }}
          className="font-display leading-relaxed whitespace-pre-line"
        >
          {currentText}
        </p>
      </div>

      {/* Slide indicator */}
      <SlideIndicator
        ref={dotsRef}
        count={config.slides.length}
        current={displayedSlide}
        chrome={chrome}
        theme={theme}
      />

      {/* Slide number */}
      <div
        ref={counterRef}
        className="absolute bottom-8 right-8"
        style={{
          fontSize: `${chrome.counterFontSize}px`,
          lineHeight: `${chrome.counterLineHeight}px`,
          color: theme.counter,
          textShadow: theme.textShadow,
          transition: SLIDE_TEXT_TRANSITION,
        }}
      >
        {displayedSlide + 1} / {config.slides.length}
      </div>
    </div>
  );
}
