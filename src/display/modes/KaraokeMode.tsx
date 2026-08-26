import React, { useMemo, useRef, useLayoutEffect, useState, useEffect } from "react";
import type { TextState, AudioState, AppSettings } from "../../shared/types";
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
import { buildScreenGroups, getActiveScreen } from "../../shared/ttmlParser";

interface Props {
  config: TextState;
  audioState: AudioState;
  settings: AppSettings;
}

const MAX_FONT_SIZE = 100;
const MIN_FONT_SIZE = 24;

// Interpolate currentTime at 60fps between state updates
function useInterpolatedTime(audioState: AudioState): number {
  const [time, setTime] = useState(audioState.currentTime);
  const lastStateTime = useRef(audioState.currentTime);
  const lastWallTime = useRef(performance.now());

  useEffect(() => {
    lastStateTime.current = audioState.currentTime;
    lastWallTime.current = performance.now();
    setTime(audioState.currentTime);
  }, [audioState.currentTime]);

  useEffect(() => {
    if (!audioState.playing) return;

    // Reset wall time on resume so we don't jump forward by the pause duration
    lastWallTime.current = performance.now();

    let rafId: number;
    const tick = () => {
      const elapsed = (performance.now() - lastWallTime.current) / 1000;
      setTime(lastStateTime.current + elapsed);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [audioState.playing]);

  return time;
}

export default function KaraokeMode({ config, audioState, settings }: Props) {
  const { syncedLyrics } = config;
  const lines = useMemo(
    () => syncedLyrics?.lines ?? [],
    [syncedLyrics?.lines]
  );
  const currentTime = useInterpolatedTime(audioState);

  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLDivElement>(null);

  const chrome = getChromeMetrics(settings);
  const theme = resolveSlideTheme(settings, config.contentType);

  const [fontSize, setFontSize] = useState(60);
  const [visible, setVisible] = useState(true);
  const [displayedScreen, setDisplayedScreen] = useState(0);
  const displayedScreenRef = useRef(displayedScreen);
  displayedScreenRef.current = displayedScreen;

  // Build screen groups from slides (verse structure from the hymnal JSON)
  const screenGroups = useMemo(
    () => buildScreenGroups(config.slides, lines.length),
    [config.slides, lines.length]
  );

  // Find the largest font that fits every screen, using the same algorithm as TextMode.
  // Measures each screen's text in a hidden div and takes the minimum optimal size.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure || lines.length === 0 || screenGroups.length === 0) return;

    // Measured rather than assumed, so a larger title shrinks the lyrics
    // instead of colliding with them.
    const availableHeight =
      container.clientHeight -
      reservedChromeHeight(
        titleRef.current?.offsetHeight ?? 0,
        dotsRef.current?.offsetHeight ?? 0,
        counterRef.current?.offsetHeight ?? 0,
      );
    const availableWidth = container.clientWidth - 96;

    measure.style.whiteSpace = "pre";

    let minSize = MAX_FONT_SIZE;
    for (const group of screenGroups) {
      const screenText = group
        .map((idx) => lines[idx].words.map((w) => w.text).join(" "))
        .join("\n");
      measure.textContent = screenText;

      const size = findOptimalFontSize(MIN_FONT_SIZE, MAX_FONT_SIZE, (s) => {
        measure.style.fontSize = `${s}px`;
        return measure.scrollWidth <= availableWidth && measure.scrollHeight <= availableHeight;
      });
      minSize = Math.min(minSize, size);
    }

    measure.textContent = "";
    setFontSize(minSize);
  }, [
    lines,
    screenGroups,
    config.title,
    chrome.titleLineHeight,
    chrome.counterLineHeight,
    chrome.dotSize,
  ]);

  const targetScreen = useMemo(
    () => getActiveScreen(screenGroups, lines, currentTime),
    [currentTime, screenGroups, lines]
  );

  // Handle screen transitions with crossfade
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (targetScreen !== displayedScreenRef.current) {
      if (transitionRef.current) {
        clearTimeout(transitionRef.current);
      }
      setVisible(false);
      transitionRef.current = setTimeout(() => {
        setDisplayedScreen(targetScreen);
        setVisible(true);
        transitionRef.current = null;
      }, 250);
    }
    return () => {
      if (transitionRef.current) {
        clearTimeout(transitionRef.current);
      }
    };
  }, [targetScreen]);

  const currentLineIndices = screenGroups[displayedScreen] ?? [];

  // Extract verse/chorus label from the slide text (e.g., "1." from "1. text" or "R:" from "R: text")
  const currentSlideText = config.slides[displayedScreen] ?? "";
  const labelMatch = currentSlideText.match(/^(\d+\.|[A-Z][a-z]*:)\s/);
  const screenLabel = labelMatch?.[1] ?? null;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col items-center justify-center p-12 relative"
      style={slideBackgroundStyle(theme) as React.CSSProperties}
    >
      <div
        ref={measureRef}
        className="font-display leading-relaxed absolute"
        style={{ visibility: "hidden", position: "absolute", top: -9999, left: -9999 }}
      />

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

      <div
        className={`w-full text-center transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div style={{ fontSize: `${fontSize}px` }}>
        {currentLineIndices.map((lineIdx, screenIdx) => {
          const line = lines[lineIdx];
          if (!line) return null;

          // A line is "current" if it has an active word or is the last fully-sung line
          const lineSung = currentTime >= line.end;
          const lineUpcoming = currentTime < line.begin;

          return (
            <div
              key={lineIdx}
              className="font-display leading-relaxed whitespace-pre transition-opacity duration-300"
              style={{ opacity: lineUpcoming ? 0.4 : lineSung ? 0.6 : 1 }}
            >
              {screenIdx === 0 && screenLabel && (
                <span style={{ color: theme.karaokeLabel }}>{screenLabel} </span>
              )}
              {line.words.map((word, wordIdx) => {
                const highlighted = currentTime >= word.begin;
                const active =
                  currentTime >= word.begin && currentTime < word.end;

                let fillPercent = 0;
                if (currentTime >= word.end) {
                  fillPercent = 100;
                } else if (currentTime >= word.begin) {
                  fillPercent =
                    ((currentTime - word.begin) / (word.end - word.begin)) * 100;
                }

                // The halo, when the background needs one, rides alongside the
                // glow rather than replacing it — both are text-shadows.
                const glow = `0 0 12px ${
                  highlighted ? theme.karaokeGlowOn : theme.karaokeGlowOff
                }`;
                const glowStyle = {
                  textShadow:
                    theme.textShadow === "none"
                      ? glow
                      : `${glow}, ${theme.textShadow}`,
                  transition: "text-shadow 0.3s ease-out",
                };

                return (
                  <span key={wordIdx}>
                    {wordIdx > 0 && " "}
                    {active ? (
                      <span className="relative inline-block" style={glowStyle}>
                        <span style={{ color: theme.karaokeUnsung }}>
                          {word.text}
                        </span>
                        <span
                          className="absolute left-0 top-0 overflow-hidden whitespace-nowrap"
                          style={{
                            width: `${fillPercent}%`,
                            color: theme.karaokeSung,
                          }}
                        >
                          {word.text}
                        </span>
                      </span>
                    ) : (
                      <span
                        style={{
                          ...glowStyle,
                          color: highlighted
                            ? theme.karaokeSung
                            : theme.karaokeUnsung,
                        }}
                      >
                        {word.text}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          );
        })}
        </div>
      </div>

      {screenGroups.length > 1 && (
        <SlideIndicator
          ref={dotsRef}
          count={screenGroups.length}
          current={displayedScreen}
          chrome={chrome}
          theme={theme}
        />
      )}

      {screenGroups.length > 1 && (
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
          {displayedScreen + 1} / {screenGroups.length}
        </div>
      )}
    </div>
  );
}
