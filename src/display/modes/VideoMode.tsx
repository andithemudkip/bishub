import { useEffect, useRef, useState } from "react";
import type { VideoState } from "../../shared/types";

interface Props {
  config: VideoState;
  onTimeUpdate: (time: number, duration: number) => void;
}

export default function VideoMode({ config, onTimeUpdate }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSeekedTime = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle play/pause
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !config.src) return;

    if (config.playing) {
      video.play().catch((e) => {
        console.error("Play error:", e);
        setError(`Play error: ${e.message}`);
      });
    } else {
      video.pause();
    }
  }, [config.playing, config.src]);

  // Handle volume changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = config.volume;
  }, [config.volume]);

  // Handle seeking from remote
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Only seek if the difference is significant (to avoid fighting with timeupdate)
    const diff = Math.abs(video.currentTime - config.currentTime);
    if (diff > 1 && lastSeekedTime.current !== config.currentTime) {
      video.currentTime = config.currentTime;
      lastSeekedTime.current = config.currentTime;
    }
  }, [config.currentTime]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    onTimeUpdate(video.currentTime, video.duration || 0);
  };

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const err = video.error;
    console.error("Video error:", err);
    setError(`Video error: ${err?.message || "Unknown error"}`);
  };

  const handleCanPlay = () => {
    setError(null);
  };

  if (!config.src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <p className="text-white/50 text-2xl">No video loaded</p>
      </div>
    );
  }

  // Convert path to file URL properly
  const videoSrc = config.src.startsWith("file://")
    ? config.src
    : `file://${config.src}`;

  return (
    <div className="w-full h-full bg-black flex items-center justify-center">
      {error && (
        <div className="absolute top-4 left-4 right-4 bg-red-900/80 text-white p-4 rounded">
          {error}
        </div>
      )}
      <video
        ref={videoRef}
        src={videoSrc}
        className="max-w-full max-h-full"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onError={handleError}
        onCanPlay={handleCanPlay}
      />
    </div>
  );
}
