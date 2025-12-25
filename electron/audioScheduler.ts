import Store from "electron-store";
import { v4 as uuidv4 } from "uuid";
import type { StateManager } from "./state";
import type {
  AudioSchedule,
  AudioSchedulePreset,
  ScheduleEvent,
  ScheduleTimeType,
} from "../src/shared/audioSchedule.types";

interface SchedulerSchema {
  schedules: AudioSchedule[];
  presets: AudioSchedulePreset[];
  version: number;
}

type ScheduleChangeCallback = (schedules: AudioSchedule[]) => void;
type PresetChangeCallback = (presets: AudioSchedulePreset[]) => void;
type ScheduleEventCallback = (event: ScheduleEvent) => void;

export class AudioScheduler {
  private store: Store<SchedulerSchema>;
  private stateManager: StateManager;
  private activeTimers: Map<string, NodeJS.Timeout> = new Map();
  private scheduleListeners: ScheduleChangeCallback[] = [];
  private presetListeners: PresetChangeCallback[] = [];
  private eventListeners: ScheduleEventCallback[] = [];

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.store = new Store<SchedulerSchema>({
      name: "audio-schedules",
      defaults: {
        schedules: [],
        presets: [],
        version: 1,
      },
    });

    // Restore pending schedules on startup
    this.restoreSchedules();
  }

  // Schedule creation
  createSchedule(params: {
    audioId: string;
    audioName: string;
    audioPath: string;
    timeType: ScheduleTimeType;
    absoluteTime?: Date;
    relativeMinutes?: number;
  }): AudioSchedule {
    const now = Date.now();
    let scheduledTime: number;

    if (params.timeType === "relative" && params.relativeMinutes) {
      scheduledTime = now + params.relativeMinutes * 60 * 1000;
    } else if (params.timeType === "absolute" && params.absoluteTime) {
      scheduledTime = params.absoluteTime.getTime();
      // If time is in the past today, assume tomorrow
      if (scheduledTime <= now) {
        scheduledTime += 24 * 60 * 60 * 1000;
      }
    } else {
      throw new Error("Invalid schedule parameters");
    }

    const schedule: AudioSchedule = {
      id: uuidv4(),
      audioId: params.audioId,
      audioName: params.audioName,
      audioPath: params.audioPath,
      timeType: params.timeType,
      scheduledTime,
      relativeMinutes: params.relativeMinutes,
      status: "pending",
      createdAt: now,
    };

    // Persist
    const schedules = this.store.get("schedules", []);
    schedules.push(schedule);
    this.store.set("schedules", schedules);

    // Set timer
    this.setTimer(schedule);
    this.notifyScheduleChange();
    this.notifyEvent({ type: "created", schedule, timestamp: now });

    return schedule;
  }

  private setTimer(schedule: AudioSchedule): void {
    const delay = schedule.scheduledTime - Date.now();
    if (delay <= 0) {
      // Already past - mark as expired
      this.updateScheduleStatus(schedule.id, "expired");
      return;
    }

    const timer = setTimeout(() => {
      this.triggerSchedule(schedule);
    }, delay);

    this.activeTimers.set(schedule.id, timer);
  }

  private triggerSchedule(schedule: AudioSchedule): void {
    const state = this.stateManager.getState();

    if (state.mode !== "idle") {
      // Not in idle mode - skip
      this.updateScheduleStatus(schedule.id, "skipped", "not_idle");
      this.notifyEvent({
        type: "skipped",
        schedule: { ...schedule, status: "skipped", skipReason: "not_idle" },
        timestamp: Date.now(),
      });
      return;
    }

    // Play the audio
    this.stateManager.loadAudio(schedule.audioPath, schedule.audioName);
    this.stateManager.playAudio();

    this.updateScheduleStatus(schedule.id, "triggered");
    this.notifyEvent({
      type: "triggered",
      schedule: { ...schedule, status: "triggered", triggeredAt: Date.now() },
      timestamp: Date.now(),
    });
  }

  cancelSchedule(scheduleId: string): boolean {
    const timer = this.activeTimers.get(scheduleId);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(scheduleId);
    }

    const schedules = this.store.get("schedules", []);
    const index = schedules.findIndex((s) => s.id === scheduleId);
    if (index === -1) return false;

    schedules.splice(index, 1);
    this.store.set("schedules", schedules);
    this.notifyScheduleChange();

    return true;
  }

  // Preset management
  createPreset(params: {
    name: string;
    audioId: string;
    audioName: string;
    timeType: ScheduleTimeType;
    hour?: number;
    minute?: number;
    relativeMinutes?: number;
  }): AudioSchedulePreset {
    const preset: AudioSchedulePreset = {
      id: uuidv4(),
      name: params.name,
      audioId: params.audioId,
      audioName: params.audioName,
      timeType: params.timeType,
      hour: params.hour,
      minute: params.minute,
      relativeMinutes: params.relativeMinutes,
      createdAt: Date.now(),
    };

    const presets = this.store.get("presets", []);
    presets.push(preset);
    this.store.set("presets", presets);
    this.notifyPresetChange();

    return preset;
  }

  activatePreset(presetId: string, audioPath: string): AudioSchedule | null {
    const presets = this.store.get("presets", []);
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return null;

    let absoluteTime: Date | undefined;
    if (
      preset.timeType === "absolute" &&
      preset.hour !== undefined &&
      preset.minute !== undefined
    ) {
      absoluteTime = new Date();
      absoluteTime.setHours(preset.hour, preset.minute, 0, 0);
    }

    return this.createSchedule({
      audioId: preset.audioId,
      audioName: preset.audioName,
      audioPath,
      timeType: preset.timeType,
      absoluteTime,
      relativeMinutes: preset.relativeMinutes,
    });
  }

  deletePreset(presetId: string): boolean {
    const presets = this.store.get("presets", []);
    const index = presets.findIndex((p) => p.id === presetId);
    if (index === -1) return false;

    presets.splice(index, 1);
    this.store.set("presets", presets);
    this.notifyPresetChange();
    return true;
  }

  // Getters
  getSchedules(): AudioSchedule[] {
    return this.store.get("schedules", []);
  }

  getPresets(): AudioSchedulePreset[] {
    return this.store.get("presets", []);
  }

  getPendingSchedules(): AudioSchedule[] {
    return this.getSchedules().filter((s) => s.status === "pending");
  }

  // Cleanup
  cleanupExpiredSchedules(): void {
    const schedules = this.store.get("schedules", []);
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // Keep only pending schedules and recently completed/skipped ones
    const active = schedules.filter(
      (s) =>
        s.status === "pending" ||
        (s.triggeredAt && s.triggeredAt > oneHourAgo) ||
        (s.status === "skipped" && s.scheduledTime > oneHourAgo)
    );

    if (active.length !== schedules.length) {
      this.store.set("schedules", active);
      this.notifyScheduleChange();
    }
  }

  // Private helpers
  private restoreSchedules(): void {
    const schedules = this.store.get("schedules", []);
    const now = Date.now();

    for (const schedule of schedules) {
      if (schedule.status === "pending") {
        if (schedule.scheduledTime > now) {
          this.setTimer(schedule);
        } else {
          // Expired while app was closed
          this.updateScheduleStatus(schedule.id, "expired");
        }
      }
    }

    // Clean up old schedules on startup
    this.cleanupExpiredSchedules();
  }

  private updateScheduleStatus(
    id: string,
    status: AudioSchedule["status"],
    skipReason?: string
  ): void {
    const schedules = this.store.get("schedules", []);
    const index = schedules.findIndex((s) => s.id === id);
    if (index !== -1) {
      schedules[index].status = status;
      if (skipReason)
        schedules[index].skipReason = skipReason as AudioSchedule["skipReason"];
      if (status === "triggered") schedules[index].triggeredAt = Date.now();
      this.store.set("schedules", schedules);
      this.notifyScheduleChange();
    }
    this.activeTimers.delete(id);
  }

  // Event listeners
  onScheduleChange(callback: ScheduleChangeCallback): () => void {
    this.scheduleListeners.push(callback);
    return () => {
      this.scheduleListeners = this.scheduleListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  onPresetChange(callback: PresetChangeCallback): () => void {
    this.presetListeners.push(callback);
    return () => {
      this.presetListeners = this.presetListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  onScheduleEvent(callback: ScheduleEventCallback): () => void {
    this.eventListeners.push(callback);
    return () => {
      this.eventListeners = this.eventListeners.filter((cb) => cb !== callback);
    };
  }

  private notifyScheduleChange(): void {
    const schedules = this.getSchedules();
    this.scheduleListeners.forEach((cb) => cb(schedules));
  }

  private notifyPresetChange(): void {
    const presets = this.getPresets();
    this.presetListeners.forEach((cb) => cb(presets));
  }

  private notifyEvent(event: ScheduleEvent): void {
    this.eventListeners.forEach((cb) => cb(event));
  }
}

// Singleton - requires StateManager injection
let schedulerInstance: AudioScheduler | null = null;

export function initAudioScheduler(stateManager: StateManager): AudioScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new AudioScheduler(stateManager);
  }
  return schedulerInstance;
}

export function getAudioScheduler(): AudioScheduler | null {
  return schedulerInstance;
}
