import { useEffect, useState } from "react";
import type { DisplayState, AppSettings } from "../shared/types";
import { DEFAULT_STATE, DEFAULT_SETTINGS } from "../shared/types";
import IdleMode from "./modes/IdleMode";
import TextMode from "./modes/TextMode";
import KaraokeMode from "./modes/KaraokeMode";
import VideoMode from "./modes/VideoMode";
import ImageMode from "./modes/ImageMode";
import AudioPlayer from "./components/AudioPlayer";

export default function App() {
  const [state, setState] = useState<DisplayState>(DEFAULT_STATE);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    // Get initial state and settings
    if (window.electronAPI) {
      window.electronAPI.getState().then(setState);
      window.electronAPI.getSettings().then(setSettings);

      // Subscribe to state updates
      const unsubscribeState = window.electronAPI.onStateUpdate(setState);
      const unsubscribeSettings = window.electronAPI.onSettingsUpdate(setSettings);

      return () => {
        unsubscribeState();
        unsubscribeSettings();
      };
    }
  }, []);

  const handleVideoTimeUpdate = (time: number, duration: number) => {
    window.electronAPI?.videoTimeUpdate(time, duration);
  };

  const handleAudioTimeUpdate = (time: number, duration: number) => {
    window.electronAPI?.audioTimeUpdate(time, duration);
  };

  const handleAudioEnded = () => {
    window.electronAPI?.audioEnded();
  };

  return (
    <div className="display-container">
      {state.mode === "idle" && (
        <IdleMode
          config={state.idle}
          language={settings.language}
          audioState={state.audio}
        />
      )}
      {state.mode === "text" && (
        state.text.syncedLyrics
          ? <KaraokeMode config={state.text} audioState={state.audio} />
          : <TextMode config={state.text} />
      )}
      {state.mode === "video" && (
        <VideoMode config={state.video} onTimeUpdate={handleVideoTimeUpdate} />
      )}
      {state.mode === "image" && <ImageMode config={state.image} />}

      {/* Audio player always rendered so playback works in any mode */}
      <AudioPlayer
        config={state.audio}
        onTimeUpdate={handleAudioTimeUpdate}
        onEnded={handleAudioEnded}
      />
    </div>
  );
}
