import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type {
  AudioSchedule,
  CreateScheduleParams,
  ScheduleEvent,
  UpdateScheduleParams,
} from "../shared/audioSchedule.types";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "../shared/types";
import { getDeviceToken } from "../shared/utils";

type SocketType = Socket<ServerToClientEvents, ClientToServerEvents>;

interface AudioSchedulerAPI {
  schedules: AudioSchedule[];
  recentEvents: ScheduleEvent[];
  isElectron: boolean;

  createSchedule: (params: CreateScheduleParams) => Promise<AudioSchedule | null>;
  updateSchedule: (params: UpdateScheduleParams) => Promise<AudioSchedule | null>;
  deleteSchedule: (scheduleId: string) => Promise<boolean>;
}

export function useAudioScheduler(): AudioSchedulerAPI {
  const [schedules, setSchedules] = useState<AudioSchedule[]>([]);
  const [recentEvents, setRecentEvents] = useState<ScheduleEvent[]>([]);

  const socketRef = useRef<SocketType | null>(null);
  const isElectron = !!window.electronAPI;

  const handleScheduleEvent = useCallback((event: ScheduleEvent) => {
    setRecentEvents((prev) => [event, ...prev].slice(0, 10));
    setTimeout(() => {
      setRecentEvents((prev) => prev.filter((e) => e !== event));
    }, 5000);
  }, []);

  useEffect(() => {
    if (isElectron) {
      // Use Electron IPC
      window.electronAPI!.getAudioSchedules().then(setSchedules);

      const unsubSchedules =
        window.electronAPI!.onAudioSchedulesUpdate(setSchedules);
      const unsubEvent =
        window.electronAPI!.onAudioScheduleEvent(handleScheduleEvent);

      return () => {
        unsubSchedules();
        unsubEvent();
      };
    } else {
      const token = getDeviceToken();
      if (!token) return;
      const socket: SocketType = io({
        auth: { token },
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("getAudioSchedules");
      });

      socket.on("audioSchedules", setSchedules);
      socket.on("audioScheduleEvent", handleScheduleEvent);

      return () => {
        socket.disconnect();
      };
    }
  }, [isElectron, handleScheduleEvent]);

  const createSchedule = useCallback(
    async (params: CreateScheduleParams) => {
      if (isElectron) {
        return window.electronAPI!.createAudioSchedule(params);
      }
      socketRef.current?.emit("createAudioSchedule", params);
      return null;
    },
    [isElectron]
  );

  const updateSchedule = useCallback(
    async (params: UpdateScheduleParams) => {
      if (isElectron) {
        return window.electronAPI!.updateAudioSchedule(params);
      }
      socketRef.current?.emit("updateAudioSchedule", params);
      return null;
    },
    [isElectron]
  );

  const deleteSchedule = useCallback(
    async (scheduleId: string) => {
      if (isElectron) {
        return window.electronAPI!.deleteAudioSchedule(scheduleId);
      }
      socketRef.current?.emit("deleteAudioSchedule", scheduleId);
      return true;
    },
    [isElectron]
  );

  return {
    schedules,
    recentEvents,
    isElectron,
    createSchedule,
    updateSchedule,
    deleteSchedule,
  };
}
