export type ScheduleTimeType = "absolute" | "relative";

export interface AudioSchedule {
  id: string;
  audioId: string;
  audioName: string;
  audioPath: string;

  // Time configuration
  timeType: ScheduleTimeType;
  scheduledTime: number; // Unix timestamp when audio should play

  // For relative schedules, store the original input for display
  relativeMinutes?: number;

  // Status
  status: "pending" | "triggered" | "skipped" | "expired";
  skipReason?: "not_idle" | "cancelled";

  // Metadata
  createdAt: number;
  triggeredAt?: number;
}

export interface AudioSchedulePreset {
  id: string;
  name: string;
  audioId: string;
  audioName: string;

  // Time configuration (template - will be converted to schedule)
  timeType: ScheduleTimeType;

  // For absolute: hour/minute (like "10:25")
  hour?: number; // 0-23
  minute?: number; // 0-59

  // For relative: minutes from now
  relativeMinutes?: number;

  createdAt: number;
}

export interface ScheduleEvent {
  type: "created" | "triggered" | "skipped" | "cancelled" | "expired";
  schedule: AudioSchedule;
  timestamp: number;
}

// Parameters for creating a schedule
export interface CreateScheduleParams {
  audioId: string;
  audioName: string;
  audioPath: string;
  timeType: ScheduleTimeType;
  absoluteTime?: string; // ISO string for absolute time
  relativeMinutes?: number;
}

// Parameters for creating a preset
export interface CreatePresetParams {
  name: string;
  audioId: string;
  audioName: string;
  timeType: ScheduleTimeType;
  hour?: number;
  minute?: number;
  relativeMinutes?: number;
}
