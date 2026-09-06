/** How often a schedule fires. */
export type ScheduleRepeat = "once" | "daily" | "weekly";

/** Outcome of the most recent run attempt. */
export type ScheduleRunStatus =
  | "triggered"
  | "skipped"
  /** Came due while the app was closed or the machine asleep. */
  | "missed"
  /** The audio file is gone from disk. */
  | "unavailable";

export interface AudioSchedule {
  id: string;
  audioId: string;
  audioName: string;
  audioPath: string;

  /** Optional user-given name ("Chemare la slujbă"). Falls back to audioName in the UI. */
  label?: string;

  repeat: ScheduleRepeat;
  /** Time of day, local. */
  hour: number; // 0-23
  minute: number; // 0-59
  /** Weekly only. 0 = Sunday … 6 = Saturday (matches Date.getDay()). Empty behaves like daily. */
  daysOfWeek: number[];

  /** Disabled schedules stay in the list but never fire. */
  enabled: boolean;
  /** Next fire time; null when disabled or finished. */
  nextRunAt: number | null;

  lastRunAt?: number;
  lastStatus?: ScheduleRunStatus;

  createdAt: number;
}

export interface ScheduleEvent {
  type: "created" | "triggered" | "skipped" | "missed" | "deleted";
  schedule: AudioSchedule;
  timestamp: number;
}

export interface CreateScheduleParams {
  audioId: string;
  audioName: string;
  audioPath: string;
  label?: string;
  repeat: ScheduleRepeat;
  hour: number;
  minute: number;
  daysOfWeek?: number[];
}

/** Partial edit; only the provided fields change. */
export interface UpdateScheduleParams {
  id: string;
  audioId?: string;
  audioName?: string;
  audioPath?: string;
  label?: string;
  repeat?: ScheduleRepeat;
  hour?: number;
  minute?: number;
  daysOfWeek?: number[];
  enabled?: boolean;
}
