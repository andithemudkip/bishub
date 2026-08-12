import { useMemo, useRef, useLayoutEffect, useState, useEffect } from "react";
import type { TextState, AudioState } from "../../shared/types";
import { findOptimalFontSize } from "../../shared/utils";
import { buildScreenGroups, getActiveScreen } from "../../shared/ttmlParser";

interface Props {
  config: TextState;
  audioState: AudioState;
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

export default function KaraokeMode({ config, audioState }: Props) {
  const { syncedLyrics } = config;
  const lines = useMemo(
    () => syncedLyrics?.lines ?? [],
    [syncedLyrics?.lines]
  );
  const currentTime = useInterpolatedTime(audioState);

  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

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

    const availableHeight = container.clientHeight - 160;
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
  }, [lines, screenGroups]);

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
      className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black p-12 relative"
    >
      <div
        ref={measureRef}
        className="font-display leading-relaxed absolute"
        style={{ visibility: "hidden", position: "absolute", top: -9999, left: -9999 }}
      />

      {config.title && (
        <div className="absolute top-8 left-0 right-0 text-center">
          <h1 className="text-3xl font-light text-white/60 tracking-wide">
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
                <span className="text-white/40">{screenLabel} </span>
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

                const glowStyle = {
                  textShadow: highlighted
                    ? "0 0 12px rgba(253, 224, 71, 0.5)"
                    : "0 0 12px rgba(253, 224, 71, 0)",
                  transition: "text-shadow 0.3s ease-out",
                };

                return (
                  <span key={wordIdx}>
                    {wordIdx > 0 && " "}
                    {active ? (
                      <span className="relative inline-block" style={glowStyle}>
                        <span className="text-white/70">{word.text}</span>
                        <span
                          className="text-yellow-300 absolute left-0 top-0 overflow-hidden whitespace-nowrap"
                          style={{ width: `${fillPercent}%` }}
                        >
                          {word.text}
                        </span>
                      </span>
                    ) : (
                      <span
                        className={
                          highlighted
                            ? "text-yellow-300"
                            : "text-white/70"
                        }
                        style={glowStyle}
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
        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2">
          {screenGroups.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all ${
                index === displayedScreen ? "bg-white w-6" : "bg-white/30"
              }`}
            />
          ))}
        </div>
      )}

      {screenGroups.length > 1 && (
        <div className="absolute bottom-8 right-8 text-white/40 text-lg">
          {displayedScreen + 1} / {screenGroups.length}
        </div>
      )}
    </div>
  );
}
