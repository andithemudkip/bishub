import { useEffect, useState } from "react";
import type { IdleState, ClockPosition, AudioState } from "../../shared/types";
import type { Language } from "../../shared/i18n";
import { idleBackgroundStyle, idleBlurStyle } from "../../shared/idleBackground";
import AudioWidget from "../components/AudioWidget";

interface Props {
  config: IdleState;
  language: Language;
  /** Where this renderer finds the background image; null falls back to the default gradient. */
  imageUrl: string | null;
  /** Omitted where the music widget would be too small to read (the Stage preview). */
  audioState?: AudioState;
}

// Map language to locale
const LANGUAGE_LOCALES: Record<Language, string> = {
  ro: "ro-RO",
  en: "en-US",
};

// Position classes for clock container
const POSITION_CLASSES: Record<ClockPosition, string> = {
  "top-left": "items-start justify-start pt-12 pl-12",
  "top-right": "items-end justify-start pt-12 pr-12",
  "bottom-left": "items-start justify-end pb-12 pl-12",
  "bottom-right": "items-end justify-end pb-12 pr-12",
  center: "items-center justify-center",
};

// Text alignment based on position
const TEXT_ALIGN_CLASSES: Record<ClockPosition, string> = {
  "top-left": "text-left",
  "top-right": "text-right",
  "bottom-left": "text-left",
  "bottom-right": "text-right",
  center: "text-center",
};

export default function IdleMode({ config, language, imageUrl, audioState }: Props) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

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

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Its own layer, so blurring the background leaves the clock sharp.
  const backgroundStyle = {
    ...idleBackgroundStyle(config.background, imageUrl),
    ...idleBlurStyle(config.background, config.blur),
  };

  // Calculate font sizes based on percentage (100 = default)
  const fontScale = config.clockFontSize / 100;
  const timeFontSize = `${12 * fontScale}rem`;
  const dateFontSize = `${2.25 * fontScale}rem`;
  const marginTop = `${1 * fontScale}rem`;

  const position = config.clockPosition || "center";
  const positionClass = POSITION_CLASSES[position];
  const textAlignClass = TEXT_ALIGN_CLASSES[position];

  return (
    <div
      className={`relative w-full h-full overflow-hidden flex flex-col ${positionClass}`}
    >
      <div data-testid="idle-background" className="absolute inset-0" style={backgroundStyle} />

      {/* Overlay for better text visibility */}
      <div
        data-testid="idle-dim"
        className="absolute inset-0 bg-black"
        style={{ opacity: config.dim / 100 }}
      />

      {config.showClock && (
        <div className={`relative z-10 text-white ${textAlignClass}`}>
          <div
            className="font-light tracking-tight leading-none drop-shadow-lg"
            style={{ fontSize: timeFontSize }}
          >
            {formatTime(time)}
          </div>
          {config.showDate && (
            <div
              className="font-light opacity-80 drop-shadow-md"
              style={{ fontSize: dateFontSize, marginTop }}
            >
              {formatDate(time)}
            </div>
          )}
        </div>
      )}

      {/* Audio widget - shown when audio is loaded */}
      {audioState?.src && (
        <AudioWidget
          config={audioState}
          position={config.audioWidgetPosition}
        />
      )}
    </div>
  );
}
