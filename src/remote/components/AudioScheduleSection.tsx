import { useState, useEffect } from "react";
import { Card } from "./ui/Card";
import type { AudioItem } from "../../shared/audioLibrary.types";
import type {
  AudioSchedule,
  AudioSchedulePreset,
  ScheduleTimeType,
} from "../../shared/audioSchedule.types";
import type { Translations } from "../../shared/i18n";

interface Props {
  audios: AudioItem[];
  schedules: AudioSchedule[];
  presets: AudioSchedulePreset[];
  onCreateSchedule: (params: {
    audioId: string;
    audioName: string;
    audioPath: string;
    timeType: ScheduleTimeType;
    absoluteTime?: Date;
    relativeMinutes?: number;
  }) => Promise<AudioSchedule | null>;
  onCancelSchedule: (scheduleId: string) => Promise<boolean>;
  onCreatePreset: (params: {
    name: string;
    audioId: string;
    audioName: string;
    timeType: ScheduleTimeType;
    hour?: number;
    minute?: number;
    relativeMinutes?: number;
  }) => Promise<AudioSchedulePreset | null>;
  onActivatePreset: (
    presetId: string,
    audioPath: string
  ) => Promise<AudioSchedule | null>;
  onDeletePreset: (presetId: string) => Promise<boolean>;
  t: Translations;
}

export default function AudioScheduleSection({
  audios,
  schedules,
  presets,
  onCreateSchedule,
  onCancelSchedule,
  onCreatePreset,
  onActivatePreset,
  onDeletePreset,
  t,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [selectedAudioId, setSelectedAudioId] = useState<string>("");
  const [timeType, setTimeType] = useState<ScheduleTimeType>("relative");
  const [timeValue, setTimeValue] = useState("");
  const [presetName, setPresetName] = useState("");
  const [showPresetInput, setShowPresetInput] = useState(false);

  const pendingSchedules = schedules.filter((s) => s.status === "pending");

  const selectedAudio = audios.find((a) => a.id === selectedAudioId);

  const handleSchedule = async () => {
    if (!selectedAudio) return;

    let absoluteTime: Date | undefined;
    let relativeMinutes: number | undefined;

    if (timeType === "absolute") {
      const [hours, minutes] = timeValue.split(":").map(Number);
      if (isNaN(hours) || isNaN(minutes)) return;
      absoluteTime = new Date();
      absoluteTime.setHours(hours, minutes, 0, 0);
    } else {
      relativeMinutes = parseInt(timeValue, 10);
      if (isNaN(relativeMinutes) || relativeMinutes <= 0) return;
    }

    await onCreateSchedule({
      audioId: selectedAudio.id,
      audioName: selectedAudio.name,
      audioPath: selectedAudio.path,
      timeType,
      absoluteTime,
      relativeMinutes,
    });

    setTimeValue("");
    setShowForm(false);
  };

  const handleSaveAsPreset = async () => {
    if (!selectedAudio || !presetName.trim()) return;

    let hour: number | undefined;
    let minute: number | undefined;
    let relativeMinutes: number | undefined;

    if (timeType === "absolute") {
      const [h, m] = timeValue.split(":").map(Number);
      if (isNaN(h) || isNaN(m)) return;
      hour = h;
      minute = m;
    } else {
      relativeMinutes = parseInt(timeValue, 10);
      if (isNaN(relativeMinutes) || relativeMinutes <= 0) return;
    }

    await onCreatePreset({
      name: presetName.trim(),
      audioId: selectedAudio.id,
      audioName: selectedAudio.name,
      timeType,
      hour,
      minute,
      relativeMinutes,
    });

    setPresetName("");
    setShowPresetInput(false);
  };

  const handleActivatePreset = async (preset: AudioSchedulePreset) => {
    const audio = audios.find((a) => a.id === preset.audioId);
    if (!audio) return;
    await onActivatePreset(preset.id, audio.path);
  };

  const formatPresetTime = (preset: AudioSchedulePreset): string => {
    if (preset.timeType === "absolute") {
      const h = preset.hour?.toString().padStart(2, "0") || "00";
      const m = preset.minute?.toString().padStart(2, "0") || "00";
      return `${h}:${m}`;
    }
    return t.audioSchedule.inXMinutes.replace(
      "{minutes}",
      String(preset.relativeMinutes || 0)
    );
  };

  return (
    <Card compact className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-400"
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
          onClick={() => setShowForm(!showForm)}
          className="px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40 flex items-center gap-1"
        >
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span className="hidden sm:inline">{t.audioSchedule.newSchedule}</span>
        </button>
      </div>

      {/* Schedule Form */}
      {showForm && (
        <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-3 space-y-3">
          {/* Audio selector */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              {t.audioSchedule.selectAudio}
            </label>
            <select
              value={selectedAudioId}
              onChange={(e) => setSelectedAudioId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t.audioSchedule.selectAudio}</option>
              {audios.map((audio) => (
                <option key={audio.id} value={audio.id}>
                  {audio.name}
                </option>
              ))}
            </select>
          </div>

          {/* Time type toggle */}
          <div className="flex bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setTimeType("absolute")}
              className={`flex-1 py-2 px-3 text-sm transition-colors ${
                timeType === "absolute"
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {t.audioSchedule.atTime}
            </button>
            <button
              onClick={() => setTimeType("relative")}
              className={`flex-1 py-2 px-3 text-sm transition-colors ${
                timeType === "relative"
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {t.audioSchedule.inMinutes}
            </button>
          </div>

          {/* Time input */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              {timeType === "absolute"
                ? t.audioSchedule.enterTime
                : t.audioSchedule.enterMinutes}
            </label>
            <input
              type={timeType === "absolute" ? "time" : "number"}
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
              min={timeType === "relative" ? 1 : undefined}
              placeholder={timeType === "absolute" ? "10:25" : "15"}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSchedule}
              disabled={!selectedAudioId || !timeValue}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-600/40 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {t.audioSchedule.schedule}
            </button>
            <button
              onClick={() => setShowPresetInput(!showPresetInput)}
              disabled={!selectedAudioId || !timeValue}
              className="py-2 px-3 rounded-lg text-sm transition-colors bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {t.audioSchedule.saveAsPreset}
            </button>
          </div>

          {/* Preset name input */}
          {showPresetInput && (
            <div className="flex gap-2">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder={t.audioSchedule.presetName}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSaveAsPreset}
                disabled={!presetName.trim()}
                className="py-2 px-4 rounded-lg text-sm font-medium transition-colors bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {t.audioSchedule.saveAsPreset}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pending Schedules */}
      {pendingSchedules.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">
            {t.audioSchedule.pendingSchedules}
          </h4>
          <div className="space-y-1.5">
            {pendingSchedules.map((schedule) => (
              <PendingScheduleItem
                key={schedule.id}
                schedule={schedule}
                onCancel={() => onCancelSchedule(schedule.id)}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {pendingSchedules.length === 0 && !showForm && (
        <p className="text-sm text-gray-500">
          {t.audioSchedule.noPendingSchedules}
        </p>
      )}

      {/* Presets */}
      <div className="border-t border-gray-700/50 pt-4">
        <h4 className="text-sm font-medium text-gray-400 mb-2">
          {t.audioSchedule.presets}
        </h4>
        {presets.length > 0 ? (
          <div className="space-y-1.5">
            {presets.map((preset) => {
              const audioExists = audios.some((a) => a.id === preset.audioId);
              return (
                <div
                  key={preset.id}
                  className="flex items-center justify-between bg-gray-900/50 border border-gray-700/30 rounded-lg p-2.5 sm:p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {preset.name}
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {preset.audioName} - {formatPresetTime(preset)}
                    </div>
                  </div>
                  <div className="flex items-center bg-gray-800 border border-gray-700/50 rounded-md overflow-hidden ml-2">
                    <button
                      onClick={() => handleActivatePreset(preset)}
                      disabled={!audioExists}
                      className="px-2.5 py-1.5 text-xs font-medium text-green-400 hover:bg-green-600/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      {t.audioSchedule.activate}
                    </button>
                    <button
                      onClick={() => onDeletePreset(preset.id)}
                      className="px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-600/20 transition-colors border-l border-gray-700"
                    >
                      {t.audioSchedule.delete}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">{t.audioSchedule.noPresets}</p>
        )}
      </div>
    </Card>
  );
}

// Pending schedule item with countdown
function PendingScheduleItem({
  schedule,
  onCancel,
  t,
}: {
  schedule: AudioSchedule;
  onCancel: () => void;
  t: Translations;
}) {
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const remaining = schedule.scheduledTime - now;

      if (remaining <= 0) {
        setCountdown("0:00");
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);

      if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        setCountdown(
          `${hours}:${mins.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`
        );
      } else {
        setCountdown(`${minutes}:${seconds.toString().padStart(2, "0")}`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [schedule.scheduledTime]);

  const scheduledDate = new Date(schedule.scheduledTime);
  const timeStr = scheduledDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex items-center justify-between bg-gray-900/50 border border-gray-700/30 rounded-lg p-2.5 sm:p-3">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{schedule.audioName}</div>
        <div className="text-xs text-gray-400">
          {t.audioSchedule.scheduledFor} {timeStr}
        </div>
      </div>
      <div className="flex items-center gap-3 ml-2">
        <div className="text-sm font-mono text-blue-400">{countdown}</div>
        <button
          onClick={onCancel}
          className="px-2.5 py-1.5 rounded-md text-xs font-medium text-red-400 bg-red-600/20 hover:bg-red-600/30 border border-red-600/40 transition-colors"
        >
          {t.audioSchedule.cancel}
        </button>
      </div>
    </div>
  );
}
