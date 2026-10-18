import { useEffect, useRef } from "react";
import type { AudioState } from "../../shared/types";
import { getFileUrl } from "../../shared/utils";

interface Props {
  config: AudioState;
  onTimeUpdate: (time: number, duration: number) => void;
  onEnded?: () => void;
  /** The src failed to load — the file is gone from disk. */
  onError?: () => void;
}

export default function AudioPlayer({
  config,
  onTimeUpdate,
  onEnded,
  onError,
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastSeekedTime = useRef<number | null>(null);

  // Handle play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !config.src) return;

    if (config.playing) {
      audio.play().catch((e) => {
        console.error("[AudioPlayer] Play error:", e);
      });
    } else {
      audio.pause();
    }
  }, [config.playing, config.src]);

  // Apply the volume to every newly loaded file too, not just on changes: the
  // element only exists once something is loaded and starts at full volume,
  // while the saved volume arrived long before.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = config.volume;
  }, [config.volume, config.src]);

  // Handle seeking from remote
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const diff = Math.abs(audio.currentTime - config.currentTime);
    if (diff > 1 && lastSeekedTime.current !== config.currentTime) {
      audio.currentTime = config.currentTime;
      lastSeekedTime.current = config.currentTime;
    }
  }, [config.currentTime]);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    onTimeUpdate(audio.currentTime, audio.duration || 0);
  };

  const handleEnded = () => {
    const audio = audioRef.current;
    if (!audio) return;
    // Karaoke depends on this call happening even though onEnded also fires below.
    onTimeUpdate(audio.duration || 0, audio.duration || 0);
    onEnded?.();
  };

  const handleError = () => {
    // "ended" never fires for a src that failed to load, so without this the
    // queue would stall here rather than moving past the missing file.
    console.error("[AudioPlayer] Failed to load:", config.src);
    onError?.();
  };

  if (!config.src) return null;

  const audioSrc = getFileUrl(config.src);

  return (
    <audio
      ref={audioRef}
      src={audioSrc}
      onTimeUpdate={handleTimeUpdate}
      onLoadedMetadata={handleTimeUpdate}
      onEnded={handleEnded}
      onError={handleError}
    />
  );
}
