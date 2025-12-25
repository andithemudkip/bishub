import { useEffect, useState } from "react";
import type { IdleState } from "../../shared/types";

interface Props {
  config: IdleState;
}

export default function IdleMode({ config }: Props) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const backgroundStyle = config.wallpaper
    ? {
        backgroundImage: `url(file://${config.wallpaper})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {
        background:
          "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      };

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center"
      style={backgroundStyle}
    >
      {/* Overlay for better text visibility */}
      <div className="absolute inset-0 bg-black/30" />

      {config.showClock && (
        <div className="relative z-10 text-center text-white">
          <div className="text-[12rem] font-light tracking-tight leading-none drop-shadow-lg">
            {formatTime(time)}
          </div>
          <div className="text-4xl font-light mt-4 opacity-80 drop-shadow-md">
            {formatDate(time)}
          </div>
        </div>
      )}
    </div>
  );
}
