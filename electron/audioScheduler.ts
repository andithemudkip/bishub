import fs from "node:fs";
import Store from "electron-store";
import { v4 as uuidv4 } from "uuid";
import type { StateManager } from "./state";
import { getAudioLibrary } from "./audioLibrary";
import type {
  AudioSchedule,
  CreateScheduleParams,
  ScheduleEvent,
  ScheduleRunStatus,
  UpdateScheduleParams,
} from "../src/shared/audioSchedule.types";
import { nextRunFor, sanitizeDays } from "../src/shared/audioSchedule";

/** How often we look for due schedules. */
const TICK_MS = 15_000;
/**
 * A schedule that came due while the machine was asleep (or the app was shut)
 * must not blast audio hours later — past this window we record it as missed
 * and roll on to the next occurrence.
 */
const MAX_LATE_MS = 2 * 60 * 1000;
/** A one-off that played as intended is uninteresting after this long. */
const KEEP_PLAYED_MS = 24 * 60 * 60 * 1000;
/**
 * One that failed is exactly what the operator needs to see, so it lingers far
 * longer — long enough to survive a week away from the building.
 */
const KEEP_FAILED_MS = 7 * 24 * 60 * 60 * 1000;

const STORE_VERSION = 2;

interface SchedulerSchema {
  schedules: AudioSchedule[];
  /** Legacy v1 presets, migrated into schedules on first load. */
  presets?: unknown[];
  version: number;
}

type ScheduleChangeCallback = (schedules: AudioSchedule[]) => void;
type ScheduleEventCallback = (event: ScheduleEvent) => void;

/** Shape of a v1 schedule/preset, only what the migration reads. */
interface LegacySchedule {
  id?: string;
  audioId?: string;
  audioName?: string;
  audioPath?: string;
  name?: string;
  timeType?: string;
  scheduledTime?: number;
  hour?: number;
  minute?: number;
  relativeMinutes?: number;
  status?: string;
  createdAt?: number;
}

export class AudioScheduler {
  private store: Store<SchedulerSchema>;
  private stateManager: StateManager;
  /**
   * Authoritative in-memory copy. electron-store re-reads and re-parses the
   * file on every `get`, which we don't want on a 15-second tick.
   */
  private schedules: AudioSchedule[] = [];
  private ticker: NodeJS.Timeout | null = null;
  private scheduleListeners: ScheduleChangeCallback[] = [];
  private eventListeners: ScheduleEventCallback[] = [];

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.store = new Store<SchedulerSchema>({
      name: "audio-schedules",
      defaults: {
        schedules: [],
        version: STORE_VERSION,
      },
    });

    this.migrate();
    this.schedules = this.store.get("schedules", []);
    this.rearmAll();
    this.start();
  }

  // ---------------------------------------------------------------- lifecycle

  private start(): void {
    if (this.ticker) return;
    // The app runs unattended for weeks; an exception escaping a timer callback
    // would take the whole main process — and the display — down with it.
    const tick = () => {
      try {
        this.evaluate();
      } catch (error) {
        console.error("[audioScheduler] tick failed:", error);
      }
    };
    this.ticker = setInterval(tick, TICK_MS);
    // Run once immediately so a schedule due right now isn't held for a tick.
    tick();
  }

  clearAllTimers(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  // ------------------------------------------------------------------ reading

  getSchedules(): AudioSchedule[] {
    return [...this.schedules];
  }

  // ------------------------------------------------------------------ writing

  createSchedule(params: CreateScheduleParams): AudioSchedule {
    const now = Date.now();
    const daysOfWeek = sanitizeDays(params.daysOfWeek);

    const schedule: AudioSchedule = {
      id: uuidv4(),
      audioId: params.audioId,
      audioName: params.audioName,
      audioPath: params.audioPath,
      label: params.label?.trim() || undefined,
      repeat: params.repeat,
      hour: clampHour(params.hour),
      minute: clampMinute(params.minute),
      daysOfWeek,
      enabled: true,
      nextRunAt: null,
      createdAt: now,
    };
    schedule.nextRunAt = nextRunFor(schedule, now);

    const schedules = this.getSchedules();
    schedules.push(schedule);
    this.persist(schedules);
    this.notifyEvent({ type: "created", schedule, timestamp: now });

    return schedule;
  }

  /** Partial edit — also used for the enable/disable toggle. */
  updateSchedule(params: UpdateScheduleParams): AudioSchedule | null {
    const schedules = this.getSchedules();
    const index = schedules.findIndex((s) => s.id === params.id);
    if (index === -1) return null;

    const updated: AudioSchedule = { ...schedules[index] };

    if (params.audioId !== undefined) updated.audioId = params.audioId;
    if (params.audioName !== undefined) updated.audioName = params.audioName;
    if (params.audioPath !== undefined) updated.audioPath = params.audioPath;
    if (params.label !== undefined) updated.label = params.label.trim() || undefined;
    if (params.repeat !== undefined) updated.repeat = params.repeat;
    if (params.hour !== undefined) updated.hour = clampHour(params.hour);
    if (params.minute !== undefined) updated.minute = clampMinute(params.minute);
    if (params.daysOfWeek !== undefined) updated.daysOfWeek = sanitizeDays(params.daysOfWeek);
    if (params.enabled !== undefined) updated.enabled = params.enabled;

    // Re-arming from "now" is what makes re-enabling a fired one-off work: it
    // picks up the next occurrence of its time rather than staying in the past.
    updated.nextRunAt = updated.enabled ? nextRunFor(updated, Date.now()) : null;

    schedules[index] = updated;
    this.persist(schedules);
    return updated;
  }

  deleteSchedule(scheduleId: string): boolean {
    const schedules = this.getSchedules();
    const index = schedules.findIndex((s) => s.id === scheduleId);
    if (index === -1) return false;

    const [removed] = schedules.splice(index, 1);
    this.persist(schedules);
    this.notifyEvent({ type: "deleted", schedule: removed, timestamp: Date.now() });
    return true;
  }

  // ----------------------------------------------------------------- firing

  private evaluate(): void {
    const now = Date.now();
    // Nothing due and nothing to prune — the common case, so bail before
    // copying anything.
    const due = this.schedules.some(
      (s) => s.enabled && s.nextRunAt !== null && s.nextRunAt <= now
    );
    const stale = this.schedules.some((s) => isPrunable(s, now));
    if (!due && !stale) return;

    const schedules = this.getSchedules();
    const events: ScheduleEvent[] = [];
    let dirty = false;
    // Two schedules landing on the same minute would otherwise cut each other
    // off; the first one wins and the rest are recorded as skipped.
    let alreadyPlayed = false;

    for (let i = 0; i < schedules.length; i++) {
      const schedule = schedules[i];
      if (!schedule.enabled || schedule.nextRunAt === null) continue;
      if (schedule.nextRunAt > now) continue;

      const tooLate = now - schedule.nextRunAt > MAX_LATE_MS;
      const status: ScheduleRunStatus = tooLate
        ? "missed"
        : alreadyPlayed
          ? "skipped"
          : this.tryPlay(schedule);
      if (status === "triggered") alreadyPlayed = true;

      schedules[i] = this.advance(schedule, status, now);
      events.push({
        type: status === "triggered" ? "triggered" : status === "missed" ? "missed" : "skipped",
        schedule: schedules[i],
        timestamp: now,
      });
      dirty = true;
    }

    // Prune long-finished one-offs so the list doesn't grow forever.
    const kept = schedules.filter((s) => !isPrunable(s, now));
    if (kept.length !== schedules.length) dirty = true;

    if (dirty) {
      this.persist(kept);
      events.forEach((event) => this.notifyEvent(event));
    }
  }

  /** What actually happened when we tried to play this schedule's audio. */
  private tryPlay(schedule: AudioSchedule): ScheduleRunStatus {
    // Resolve the path from the library each time — files get re-imported and
    // the path stored at creation can go stale.
    const audio = getAudioLibrary().getById(schedule.audioId);
    const path = audio?.path ?? schedule.audioPath;
    if (!path || !fs.existsSync(path)) return "unavailable";

    // Checked after the file, so a schedule pointing at a deleted track reports
    // the real problem rather than looking like an ordinary skip.
    if (this.stateManager.getState().mode !== "idle") return "skipped";

    this.stateManager.loadAudio(path, audio?.name ?? schedule.audioName);
    this.stateManager.playAudio();
    return "triggered";
  }

  /** Record the run and move a recurring schedule to its next occurrence. */
  private advance(
    schedule: AudioSchedule,
    status: ScheduleRunStatus,
    now: number
  ): AudioSchedule {
    const next: AudioSchedule = { ...schedule, lastStatus: status, lastRunAt: now };

    if (schedule.repeat === "once") {
      // A one-off is done; it stays in the list (disabled) so the user sees the
      // outcome and can flip it back on to run again.
      next.enabled = false;
      next.nextRunAt = null;
      return next;
    }

    // Step past the slot we just handled so we can't re-fire within the minute.
    next.nextRunAt = nextRunFor(next, Math.max(now, schedule.nextRunAt ?? now) + 60_000);
    return next;
  }

  // ----------------------------------------------------------------- startup

  /**
   * Recompute next-run times on boot. Slots missed while the app was closed
   * fall outside the grace window, so they roll forward instead of firing.
   */
  private rearmAll(): void {
    const schedules = this.getSchedules();
    const now = Date.now();
    let dirty = false;

    for (let i = 0; i < schedules.length; i++) {
      const schedule = schedules[i];
      if (!schedule.enabled) {
        if (schedule.nextRunAt !== null) {
          schedules[i] = { ...schedule, nextRunAt: null };
          dirty = true;
        }
        continue;
      }

      if (schedule.repeat === "once" && schedule.nextRunAt !== null && schedule.nextRunAt < now - MAX_LATE_MS) {
        // Its moment passed while we were shut down.
        schedules[i] = { ...schedule, enabled: false, nextRunAt: null, lastStatus: "missed", lastRunAt: schedule.nextRunAt };
        dirty = true;
        continue;
      }

      const nextRunAt = schedule.nextRunAt !== null && schedule.nextRunAt > now
        ? schedule.nextRunAt
        : nextRunFor(schedule, now - MAX_LATE_MS);
      if (nextRunAt !== schedule.nextRunAt) {
        schedules[i] = { ...schedule, nextRunAt };
        dirty = true;
      }
    }

    if (dirty) this.persist(schedules);
  }

  /**
   * electron-store merges `defaults` over the file on construction, so by the
   * time we get here a v1 store missing its `version` key already reads as
   * v2. Detect the old *shape* instead of trusting the number.
   */
  private needsMigration(): boolean {
    if (this.store.get("version", 1) < STORE_VERSION) return true;
    const presets = this.store.get("presets");
    if (Array.isArray(presets) && presets.length > 0) return true;
    const schedules = this.store.get("schedules", []) as unknown as unknown[];
    return schedules.some(
      (entry) => !!entry && typeof entry === "object" && !("repeat" in entry)
    );
  }

  /** v1 stored one-shot schedules plus manually-activated presets; fold both into the new model. */
  private migrate(): void {
    if (!this.needsMigration()) return;

    const legacySchedules = (this.store.get("schedules", []) as unknown as LegacySchedule[]) || [];
    const legacyPresets = (this.store.get("presets", []) as LegacySchedule[]) || [];
    const now = Date.now();
    const library = getAudioLibrary();
    const migrated: AudioSchedule[] = [];

    // Pending one-shots keep running; anything already fired is history.
    for (const old of legacySchedules) {
      if (old && "repeat" in old) {
        // Already migrated (a partially-written store) — keep it as it is.
        migrated.push(old as unknown as AudioSchedule);
        continue;
      }
      if (old.status !== "pending" || !old.audioId || !old.scheduledTime) continue;
      const when = new Date(old.scheduledTime);
      migrated.push(
        this.buildMigrated(old, when.getHours(), when.getMinutes(), old.scheduledTime > now, now)
      );
    }

    // Presets become disabled one-offs: the same "ready to fire when I say so"
    // idea, but now one flip of a switch instead of a separate concept.
    for (const preset of legacyPresets) {
      if (!preset.audioId) continue;
      let hour = preset.hour;
      let minute = preset.minute;
      if (hour === undefined || minute === undefined) {
        // Relative presets have no wall-clock time; anchor them to now + offset.
        const anchor = new Date(now + (preset.relativeMinutes ?? 0) * 60_000);
        hour = anchor.getHours();
        minute = anchor.getMinutes();
      }
      migrated.push(this.buildMigrated(preset, hour, minute, false, now));
    }

    // Drop entries whose audio is gone from the library and that have no path.
    const usable = migrated.filter(
      (s) => s.audioPath || library.getById(s.audioId)
    );

    this.store.set("schedules", usable);
    this.store.set("version", STORE_VERSION);
    this.store.delete("presets");
  }

  private buildMigrated(
    old: LegacySchedule,
    hour: number,
    minute: number,
    enabled: boolean,
    now: number
  ): AudioSchedule {
    const library = getAudioLibrary();
    const audio = old.audioId ? library.getById(old.audioId) : null;
    const schedule: AudioSchedule = {
      id: old.id || uuidv4(),
      audioId: old.audioId || "",
      audioName: old.audioName || audio?.name || "",
      audioPath: old.audioPath || audio?.path || "",
      label: old.name?.trim() || undefined,
      repeat: "once",
      hour: clampHour(hour),
      minute: clampMinute(minute),
      daysOfWeek: [],
      enabled,
      nextRunAt: null,
      createdAt: old.createdAt || now,
    };
    if (enabled) schedule.nextRunAt = nextRunFor(schedule, now);
    return schedule;
  }

  // ------------------------------------------------------------- observers

  onScheduleChange(callback: ScheduleChangeCallback): () => void {
    this.scheduleListeners.push(callback);
    return () => {
      this.scheduleListeners = this.scheduleListeners.filter((cb) => cb !== callback);
    };
  }

  onScheduleEvent(callback: ScheduleEventCallback): () => void {
    this.eventListeners.push(callback);
    return () => {
      this.eventListeners = this.eventListeners.filter((cb) => cb !== callback);
    };
  }

  private persist(schedules: AudioSchedule[]): void {
    this.schedules = schedules;
    try {
      this.store.set("schedules", schedules);
    } catch (error) {
      // A full or read-only disk must not stop the schedule from running. We
      // keep the in-memory state authoritative for this session; the only cost
      // is that the change may not survive a restart.
      console.error("[audioScheduler] could not save schedules:", error);
    }
    this.scheduleListeners.forEach((cb) => cb(this.getSchedules()));
  }

  private notifyEvent(event: ScheduleEvent): void {
    this.eventListeners.forEach((cb) => cb(event));
  }
}

/**
 * Finished one-offs are cleaned up eventually, but a schedule that *failed*
 * (missed while the app was closed, or its file deleted) stays around far
 * longer — silently dropping it would hide the very thing the operator needs
 * to notice.
 */
function isPrunable(schedule: AudioSchedule, now: number): boolean {
  if (schedule.enabled || schedule.repeat !== "once") return false;
  if (schedule.lastRunAt === undefined) return false;
  const window =
    schedule.lastStatus === "triggered" ? KEEP_PLAYED_MS : KEEP_FAILED_MS;
  return schedule.lastRunAt <= now - window;
}

function clampHour(hour: number): number {
  return Math.min(23, Math.max(0, Math.floor(hour) || 0));
}

function clampMinute(minute: number): number {
  return Math.min(59, Math.max(0, Math.floor(minute) || 0));
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
