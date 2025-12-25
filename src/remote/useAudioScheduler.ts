import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type {
  AudioSchedule,
  AudioSchedulePreset,
  ScheduleEvent,
  ScheduleTimeType,
} from "../shared/audioSchedule.types";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "../shared/types";

type SocketType = Socket<ServerToClientEvents, ClientToServerEvents>;

function getSecurityKeyFromURL(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("key");
}

interface AudioSchedulerAPI {
  schedules: AudioSchedule[];
  presets: AudioSchedulePreset[];
  pendingSchedules: AudioSchedule[];
  recentEvents: ScheduleEvent[];
  isElectron: boolean;

  createSchedule: (params: {
    audioId: string;
    audioName: string;
    audioPath: string;
    timeType: ScheduleTimeType;
    absoluteTime?: Date;
    relativeMinutes?: number;
  }) => Promise<AudioSchedule | null>;
  cancelSchedule: (scheduleId: string) => Promise<boolean>;
  createPreset: (params: {
    name: string;
    audioId: string;
    audioName: string;
    timeType: ScheduleTimeType;
    hour?: number;
    minute?: number;
    relativeMinutes?: number;
  }) => Promise<AudioSchedulePreset | null>;
  activatePreset: (
    presetId: string,
    audioPath: string
  ) => Promise<AudioSchedule | null>;
  deletePreset: (presetId: string) => Promise<boolean>;
}

export function useAudioScheduler(): AudioSchedulerAPI {
  const [schedules, setSchedules] = useState<AudioSchedule[]>([]);
  const [presets, setPresets] = useState<AudioSchedulePreset[]>([]);
  const [recentEvents, setRecentEvents] = useState<ScheduleEvent[]>([]);

  const socketRef = useRef<SocketType | null>(null);
  const isElectron = !!window.electronAPI;

  useEffect(() => {
    if (isElectron) {
      // Use Electron IPC
      window.electronAPI!.getAudioSchedules().then(setSchedules);
      window.electronAPI!.getAudioPresets().then(setPresets);

      const unsubSchedules =
        window.electronAPI!.onAudioSchedulesUpdate(setSchedules);
      const unsubPresets = window.electronAPI!.onAudioPresetsUpdate(setPresets);
      const unsubEvent = window.electronAPI!.onAudioScheduleEvent(
        (event: ScheduleEvent) => {
          setRecentEvents((prev) => {
            const updated = [event, ...prev].slice(0, 10); // Keep last 10 events
            return updated;
          });
          // Auto-remove events after 5 seconds
          setTimeout(() => {
            setRecentEvents((prev) => prev.filter((e) => e !== event));
          }, 5000);
        }
      );

      return () => {
        unsubSchedules();
        unsubPresets();
        unsubEvent();
      };
    } else {
      // Use Socket.io
      const securityKey = getSecurityKeyFromURL();
      const socket: SocketType = io({
        auth: { key: securityKey },
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("getAudioSchedules");
        socket.emit("getAudioPresets");
      });

      socket.on("audioSchedules", setSchedules);
      socket.on("audioPresets", setPresets);
      socket.on("audioScheduleEvent", (event) => {
        setRecentEvents((prev) => {
          const updated = [event, ...prev].slice(0, 10);
          return updated;
        });
        setTimeout(() => {
          setRecentEvents((prev) => prev.filter((e) => e !== event));
        }, 5000);
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [isElectron]);

  const pendingSchedules = schedules.filter((s) => s.status === "pending");

  const api: AudioSchedulerAPI = {
    schedules,
    presets,
    pendingSchedules,
    recentEvents,
    isElectron,

    createSchedule: useCallback(
      async (params) => {
        const scheduleParams = {
          audioId: params.audioId,
          audioName: params.audioName,
          audioPath: params.audioPath,
          timeType: params.timeType,
          absoluteTime: params.absoluteTime?.toISOString(),
          relativeMinutes: params.relativeMinutes,
        };

        if (isElectron) {
          return window.electronAPI!.createAudioSchedule(scheduleParams);
        }
        socketRef.current?.emit("createAudioSchedule", scheduleParams);
        return null;
      },
      [isElectron]
    ),

    cancelSchedule: useCallback(
      async (scheduleId) => {
        if (isElectron) {
          return window.electronAPI!.cancelAudioSchedule(scheduleId);
        }
        socketRef.current?.emit("cancelAudioSchedule", scheduleId);
        return true;
      },
      [isElectron]
    ),

    createPreset: useCallback(
      async (params) => {
        if (isElectron) {
          return window.electronAPI!.createAudioPreset(params);
        }
        socketRef.current?.emit("createAudioPreset", params);
        return null;
      },
      [isElectron]
    ),

    activatePreset: useCallback(
      async (presetId, audioPath) => {
        if (isElectron) {
          return window.electronAPI!.activateAudioPreset(presetId, audioPath);
        }
        socketRef.current?.emit("activateAudioPreset", presetId, audioPath);
        return null;
      },
      [isElectron]
    ),

    deletePreset: useCallback(
      async (presetId) => {
        if (isElectron) {
          return window.electronAPI!.deleteAudioPreset(presetId);
        }
        socketRef.current?.emit("deleteAudioPreset", presetId);
        return true;
      },
      [isElectron]
    ),
  };

  return api;
}
