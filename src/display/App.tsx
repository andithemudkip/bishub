import { useEffect, useState } from "react";
import type { DisplayState } from "../shared/types";
import { DEFAULT_STATE } from "../shared/types";
import IdleMode from "./modes/IdleMode";
import TextMode from "./modes/TextMode";
import VideoMode from "./modes/VideoMode";

declare global {
  interface Window {
    electronAPI?: {
      getState: () => Promise<DisplayState>;
      onStateUpdate: (callback: (state: DisplayState) => void) => () => void;
      videoTimeUpdate: (time: number, duration: number) => Promise<void>;
    };
  }
}

export default function App() {
  const [state, setState] = useState<DisplayState>(DEFAULT_STATE);

  useEffect(() => {
    // Get initial state
    if (window.electronAPI) {
      window.electronAPI.getState().then(setState);

      // Subscribe to state updates
      const unsubscribe = window.electronAPI.onStateUpdate(setState);
      return unsubscribe;
    }
  }, []);

  const handleVideoTimeUpdate = (time: number, duration: number) => {
    window.electronAPI?.videoTimeUpdate(time, duration);
  };

  return (
    <div className="display-container">
      {state.mode === "idle" && <IdleMode config={state.idle} />}
      {state.mode === "text" && <TextMode config={state.text} />}
      {state.mode === "video" && (
        <VideoMode config={state.video} onTimeUpdate={handleVideoTimeUpdate} />
      )}
    </div>
  );
}
