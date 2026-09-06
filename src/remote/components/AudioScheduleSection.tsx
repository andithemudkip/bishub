import { useState, useEffect, useMemo } from "react";
import { Card } from "./ui/Card";
import { Select } from "./ui/Select";
import { Toggle } from "./ui/Toggle";
import { renderTip } from "./ui/renderTip";
import { PlusIcon, CloseIcon } from "./icons/ui";
import type { AudioItem } from "../../shared/audioLibrary.types";
import type {
  AudioSchedule,
  CreateScheduleParams,
  ScheduleRepeat,
  UpdateScheduleParams,
} from "../../shared/audioSchedule.types";
import {
  WEEKDAY_ORDER,
  describeSchedule,
  formatClock,
  formatTimeUntil,
  nextRunFor,
  sortSchedules,
} from "../../shared/audioSchedule";
import type { Translations } from "../../shared/i18n";

interface Props {
  audios: AudioItem[];
  schedules: AudioSchedule[];
  onCreateSchedule: (
    params: CreateScheduleParams,
  ) => Promise<AudioSchedule | null>;
  onUpdateSchedule: (
    params: UpdateScheduleParams,
  ) => Promise<AudioSchedule | null>;
  onDeleteSchedule: (scheduleId: string) => Promise<boolean>;
  t: Translations;
}

/** Minutes offered by the "quick" chips on a one-off schedule. */
const QUICK_OFFSETS = [5, 15, 30, 60];

interface DraftState {
  /** Schedule being edited, or null when creating a new one. */
  editingId: string | null;
  /** Carried through an edit so saving doesn't un-pause a paused schedule. */
  enabled: boolean;
  audioId: string;
  label: string;
  repeat: ScheduleRepeat;
  time: string; // "HH:MM"
  daysOfWeek: number[];
}

function emptyDraft(now: Date): DraftState {
  // Default to a round time an hour out — a sensible starting point that is
  // never accidentally in the past.
  const start = new Date(now.getTime() + 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  return {
    editingId: null,
    enabled: true,
    audioId: "",
    label: "",
    repeat: "once",
    time: formatClock(start.getHours(), start.getMinutes()),
    daysOfWeek: [],
  };
}

function draftFromSchedule(schedule: AudioSchedule): DraftState {
  return {
    editingId: schedule.id,
    enabled: schedule.enabled,
    audioId: schedule.audioId,
    label: schedule.label ?? "",
    repeat: schedule.repeat,
    time: formatClock(schedule.hour, schedule.minute),
    daysOfWeek: schedule.daysOfWeek ?? [],
  };
}

function parseTime(time: string): { hour: number; minute: number } | null {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { hour: h, minute: m };
}

export default function AudioScheduleSection({
  audios,
  schedules,
  onCreateSchedule,
  onUpdateSchedule,
  onDeleteSchedule,
  t,
}: Props) {
  const [draft, setDraft] = useState<DraftState | null>(null);

  const ordered = useMemo(() => sortSchedules(schedules), [schedules]);

  const openNew = () => {
    const next = emptyDraft(new Date());
    // One audio in the library? Pre-select it — one less step.
    if (audios.length === 1) next.audioId = audios[0].id;
    setDraft(next);
  };

  const handleSave = async (values: DraftState) => {
    const audio = audios.find((a) => a.id === values.audioId);
    const parsed = parseTime(values.time);
    if (!audio || !parsed) return;

    if (values.editingId) {
      await onUpdateSchedule({
        id: values.editingId,
        audioId: audio.id,
        audioName: audio.name,
        audioPath: audio.path,
        label: values.label,
        repeat: values.repeat,
        hour: parsed.hour,
        minute: parsed.minute,
        daysOfWeek: values.daysOfWeek,
        enabled: values.enabled,
      });
    } else {
      await onCreateSchedule({
        audioId: audio.id,
        audioName: audio.name,
        audioPath: audio.path,
        label: values.label || undefined,
        repeat: values.repeat,
        hour: parsed.hour,
        minute: parsed.minute,
        daysOfWeek: values.daysOfWeek,
      });
    }
    setDraft(null);
  };

  return (
    <Card compact className="space-y-4" tip={renderTip(t.audioSchedule.tip)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {t.audioSchedule.title}
        </h3>
        <button
          onClick={() =>
            draft && !draft.editingId ? setDraft(null) : openNew()
          }
          disabled={audios.length === 0}
          className="px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40 flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {draft && !draft.editingId ? (
            <CloseIcon className="w-4 h-4 flex-shrink-0" />
          ) : (
            <PlusIcon className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="hidden sm:inline">
            {draft && !draft.editingId
              ? t.audioSchedule.cancel
              : t.audioSchedule.newSchedule}
          </span>
        </button>
      </div>

      {/* New-schedule form */}
      {draft && !draft.editingId && (
        <ScheduleForm
          draft={draft}
          audios={audios}
          onChange={setDraft}
          onSave={handleSave}
          onCancel={() => setDraft(null)}
          t={t}
        />
      )}

      {/* Schedules */}
      {ordered.length > 0 ? (
        <div className="space-y-2">
          {ordered.map((schedule) =>
            draft?.editingId === schedule.id ? (
              <ScheduleForm
                key={schedule.id}
                draft={draft}
                audios={audios}
                onChange={setDraft}
                onSave={handleSave}
                onCancel={() => setDraft(null)}
                t={t}
              />
            ) : (
              <ScheduleRow
                key={schedule.id}
                schedule={schedule}
                audioName={audios.find((a) => a.id === schedule.audioId)?.name}
                onToggle={(enabled) =>
                  onUpdateSchedule({ id: schedule.id, enabled })
                }
                onEdit={() => setDraft(draftFromSchedule(schedule))}
                onDelete={() => onDeleteSchedule(schedule.id)}
                t={t}
              />
            ),
          )}
        </div>
      ) : (
        !draft && (
          <div className="text-sm text-gray-500">
            <p>{t.audioSchedule.noSchedules}</p>
            {/* With an empty library the "new schedule" button is disabled, so
                say why rather than leaving a dead control. */}
            <p className="text-xs text-gray-600 mt-1">
              {audios.length > 0
                ? t.audioSchedule.noSchedulesHint
                : t.audioSchedule.needAudioFirst}
            </p>
          </div>
        )
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------- form

function ScheduleForm({
  draft,
  audios,
  onChange,
  onSave,
  onCancel,
  t,
}: {
  draft: DraftState;
  audios: AudioItem[];
  onChange: (draft: DraftState) => void;
  onSave: (draft: DraftState) => void;
  onCancel: () => void;
  t: Translations;
}) {
  const parsed = parseTime(draft.time);
  const needsDays = draft.repeat === "weekly" && draft.daysOfWeek.length === 0;
  const canSave = !!draft.audioId && !!parsed && !needsDays;

  // Live preview of when this will actually fire.
  const preview = (() => {
    if (!parsed) return null;
    const timing = {
      repeat: draft.repeat,
      hour: parsed.hour,
      minute: parsed.minute,
      daysOfWeek: draft.daysOfWeek,
    };
    const now = Date.now();
    const nextRunAt = nextRunFor(timing, now);
    if (nextRunAt === null) return null;
    return `${describeSchedule(timing, t, nextRunAt, now)} · ${formatTimeUntil(
      nextRunAt - now,
      t,
    )}`;
  })();

  const setQuickOffset = (minutes: number) => {
    const target = new Date(Date.now() + minutes * 60 * 1000);
    onChange({
      ...draft,
      repeat: "once",
      time: formatClock(target.getHours(), target.getMinutes()),
    });
  };

  const toggleDay = (day: number) => {
    const has = draft.daysOfWeek.includes(day);
    onChange({
      ...draft,
      daysOfWeek: has
        ? draft.daysOfWeek.filter((d) => d !== day)
        : [...draft.daysOfWeek, day],
    });
  };

  return (
    <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-3 space-y-3">
      <h4 className="text-sm font-medium text-gray-300">
        {draft.editingId
          ? t.audioSchedule.editSchedule
          : t.audioSchedule.newSchedule}
      </h4>

      {/* Audio */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">
          {t.audioSchedule.selectAudio}
        </label>
        <Select
          value={draft.audioId}
          onChange={(e) => onChange({ ...draft, audioId: e.target.value })}
          className="py-2 text-sm"
        >
          <option value="">{t.audioSchedule.selectAudio}</option>
          {audios.map((audio) => (
            <option key={audio.id} value={audio.id}>
              {audio.name}
            </option>
          ))}
        </Select>
      </div>

      {/* Repeat */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">
          {t.audioSchedule.repeat}
        </label>
        <div className="flex bg-gray-900/50 border border-gray-700/50 rounded-lg overflow-hidden">
          {(
            [
              ["once", t.audioSchedule.repeatOnce],
              ["daily", t.audioSchedule.repeatDaily],
              ["weekly", t.audioSchedule.repeatWeekly],
            ] as const
          ).map(([value, labelText]) => (
            <button
              key={value}
              onClick={() => onChange({ ...draft, repeat: value })}
              className={`flex-1 py-2 px-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                draft.repeat === value
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {labelText}
            </button>
          ))}
        </div>
      </div>

      {/* Weekday picker */}
      {draft.repeat === "weekly" && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            {t.audioSchedule.onDays}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_ORDER.map((day) => {
              const active = draft.daysOfWeek.includes(day);
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  aria-pressed={active}
                  className={`min-w-[2.5rem] flex-1 sm:flex-none px-2 py-2 rounded-lg text-sm font-medium border transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    active
                      ? "bg-blue-600/20 text-blue-400 border-blue-600/40"
                      : "bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200"
                  }`}
                >
                  {t.audioSchedule.weekdaysShort[day]}
                </button>
              );
            })}
          </div>
          {needsDays && (
            <p className="text-xs text-yellow-500/80 mt-1.5">
              {t.audioSchedule.pickADay}
            </p>
          )}
        </div>
      )}

      {/* Time */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">
          {t.audioSchedule.time}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="time"
            value={draft.time}
            onChange={(e) => onChange({ ...draft, time: e.target.value })}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {draft.repeat === "once" && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-gray-500">
                {t.audioSchedule.quickPick}
              </span>
              {QUICK_OFFSETS.map((minutes) => (
                <button
                  key={minutes}
                  onClick={() => setQuickOffset(minutes)}
                  className="px-2 py-1.5 rounded-md text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {minutes < 60
                    ? t.audioSchedule.inMinutesShort.replace(
                        "{minutes}",
                        String(minutes),
                      )
                    : t.audioSchedule.inHoursShort.replace(
                        "{hours}",
                        String(minutes / 60),
                      )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">
          {t.audioSchedule.nameOptional}
        </label>
        <input
          type="text"
          value={draft.label}
          onChange={(e) => onChange({ ...draft, label: e.target.value })}
          placeholder={t.audioSchedule.namePlaceholder}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Preview */}
      {preview && (
        <div className="text-xs text-blue-300/90 bg-blue-950/30 border border-blue-800/40 rounded-lg px-3 py-2">
          <span className="text-blue-400/70">{t.audioSchedule.nextRun}: </span>
          {preview}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onSave(draft)}
          disabled={!canSave}
          className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-600/40 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-green-500"
        >
          {draft.editingId ? t.audioSchedule.saveChanges : t.audioSchedule.save}
        </button>
        <button
          onClick={onCancel}
          className="py-2 px-4 rounded-lg text-sm transition-colors bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {t.audioSchedule.cancel}
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------- row

function ScheduleRow({
  schedule,
  audioName,
  onToggle,
  onEdit,
  onDelete,
  t,
}: {
  schedule: AudioSchedule;
  /** Current name from the library; undefined once the audio is deleted. */
  audioName: string | undefined;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  t: Translations;
}) {
  const [now, setNow] = useState(() => Date.now());

  // Only the enabled rows need a ticking countdown.
  useEffect(() => {
    if (!schedule.enabled || schedule.nextRunAt === null) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [schedule.enabled, schedule.nextRunAt]);

  const audioExists = audioName !== undefined;
  // Prefer the library's name — the file may have been renamed since.
  const currentName = audioName ?? schedule.audioName;
  const title = schedule.label || currentName;
  const when = describeSchedule(schedule, t, schedule.nextRunAt, now);

  const lastRun = (() => {
    if (!schedule.lastStatus || !schedule.lastRunAt) return null;
    const at = new Date(schedule.lastRunAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const template =
      schedule.lastStatus === "triggered"
        ? t.audioSchedule.lastPlayed
        : schedule.lastStatus === "skipped"
          ? t.audioSchedule.lastSkipped
          : schedule.lastStatus === "unavailable"
            ? t.audioSchedule.lastUnavailable
            : t.audioSchedule.lastMissed;
    return template.replace("{time}", at);
  })();

  // Second line: the file name (only worth repeating when a custom label hides
  // it) and the outcome of the last run.
  const subline = [schedule.label ? currentName : null, lastRun]
    .filter(Boolean)
    .join(" · ");

  return (
    // Controls live on the trailing edge so every row's text starts on the
    // card's left margin and the list reads as a single column. On phones they
    // drop to their own line, with the switch on the leading edge where a thumb
    // reaches it and the eye can scan on/off straight down the list.
    <div
      className={`flex flex-col sm:flex-row sm:items-center gap-3 bg-gray-900/50 border rounded-lg p-3.5 sm:p-3 ${
        schedule.enabled ? "border-gray-700/30" : "border-gray-800/50"
      }`}
    >
      <div className={`flex-1 min-w-0 ${schedule.enabled ? "" : "opacity-60"}`}>
        <div className="font-medium text-sm truncate">{title}</div>
        <div className="text-xs text-gray-400 truncate">
          {when}
          {schedule.enabled && schedule.nextRunAt !== null && (
            <span className="text-blue-400 font-mono">
              {" · "}
              {formatTimeUntil(schedule.nextRunAt - now, t)}
            </span>
          )}
          {!schedule.enabled && ` · ${t.audioSchedule.paused}`}
        </div>
        {!audioExists ? (
          <div className="text-xs text-red-400/80 truncate">
            {t.audioSchedule.audioMissing}
          </div>
        ) : (
          subline && (
            <div className="text-xs text-gray-500 truncate">{subline}</div>
          )
        )}
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
        <Toggle
          checked={schedule.enabled}
          onChange={onToggle}
          disabled={!audioExists}
          label={`${t.audioSchedule.enableLabel}: ${title}`}
        />

        <div className="flex items-center bg-gray-800 border border-gray-700/50 rounded-md overflow-hidden">
          <button
            onClick={onEdit}
            className="px-2.5 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-600/20 transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
          >
            {t.audioSchedule.edit}
          </button>
          <button
            onClick={() => {
              if (window.confirm(t.audioSchedule.confirmDelete.replace("{name}", title)))
                onDelete();
            }}
            className="px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-600/20 transition-colors border-l border-gray-700 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500"
          >
            {t.audioSchedule.delete}
          </button>
        </div>
      </div>
    </div>
  );
}
