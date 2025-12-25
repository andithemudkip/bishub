import { useEffect, useState } from "react";
import type { DisplayState, AppSettings } from "../shared/types";
import { DEFAULT_STATE, DEFAULT_SETTINGS } from "../shared/types";
import IdleMode from "./modes/IdleMode";
import TextMode from "./modes/TextMode";
import VideoMode from "./modes/VideoMode";

declare global {
  interface Window {
    electronAPI?: {
      getState: () => Promise<DisplayState>;
      getSettings: () => Promise<AppSettings>;
      onStateUpdate: (callback: (state: DisplayState) => void) => () => void;
      onSettingsUpdate: (callback: (settings: AppSettings) => void) => () => void;
      videoTimeUpdate: (time: number, duration: number) => Promise<void>;
    };
  }
}

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

  return (
    <div className="display-container">
      {state.mode === "idle" && <IdleMode config={state.idle} language={settings.language} />}
      {state.mode === "text" && <TextMode config={state.text} />}
      {state.mode === "video" && (
        <VideoMode config={state.video} onTimeUpdate={handleVideoTimeUpdate} />
      )}
    </div>
  );
}
