import { useState } from "react";
import type { Translations } from "../../../shared/i18n";
import type { Activity } from "../../../shared/stage.types";
import {
  CloudDownloadIcon,
  CloudUploadIcon,
  CloseIcon,
  WarningIcon,
  CheckIcon,
} from "../icons/ui";
import { Section } from "./Section";
import { activityTitle, activityDetail, isUpload } from "./formatActivity";
import type { NavigateTo } from "./types";

interface Props {
  activities: Activity[];
  onDismiss: (id: string) => void;
  onNavigate: NavigateTo;
  t: Translations;
}

/** Rows shown before "N more" — a bulk import can produce hundreds. */
const ROW_CAP = 6;

/**
 * Every background operation, from any page and any remote. Errors sort
 * first and stay until dismissed — a failed download is the main reason to
 * look here. Tapping a row goes to the page that owns the operation.
 */
export function ActivitySection({ activities, onDismiss, onNavigate, t }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (activities.length === 0) return null;

  const sorted = [...activities].sort(
    (a, b) => Number(b.status === "error") - Number(a.status === "error")
  );
  const visible = expanded ? sorted : sorted.slice(0, ROW_CAP);
  const hidden = sorted.length - visible.length;

  return (
    <Section section="activity" title={t.stage.activity}>
      <ul className="space-y-1.5">
        {visible.map((activity) => (
          <ActivityRow
            key={activity.id}
            activity={activity}
            onDismiss={onDismiss}
            onNavigate={onNavigate}
            t={t}
          />
        ))}
      </ul>
      {hidden > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full px-2 py-1 text-xs text-gray-400 hover:text-gray-200 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {t.stage.showMore.replace("{n}", String(hidden))}
        </button>
      )}
    </Section>
  );
}

function ActivityRow({
  activity,
  onDismiss,
  onNavigate,
  t,
}: {
  activity: Activity;
  onDismiss: (id: string) => void;
  onNavigate: NavigateTo;
  t: Translations;
}) {
  const isError = activity.status === "error";
  const isDone = activity.status === "complete";
  const showBar =
    activity.status === "running" && activity.progress !== null && activity.progress < 100;
  const Icon = isError
    ? WarningIcon
    : isDone
      ? CheckIcon
      : isUpload(activity)
        ? CloudUploadIcon
        : CloudDownloadIcon;

  return (
    <li
      className={`flex items-stretch rounded-lg border ${
        isError
          ? "bg-red-950/20 border-red-600/30"
          : "bg-gray-900/50 border-gray-700/30"
      }`}
    >
      <button
        onClick={() => onNavigate(activity.target)}
        className="flex-1 min-w-0 flex items-start gap-2 pl-2.5 pr-1 py-1.5 text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
      >
        <Icon
          className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
            isError ? "text-red-400" : isDone ? "text-green-400" : "text-blue-400"
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate">{activityTitle(activity, t)}</div>
          <div
            className={`text-xs truncate ${isError ? "text-red-300/80" : "text-gray-500"}`}
          >
            {activityDetail(activity, t)}
          </div>
          {showBar && (
            <div className="mt-1 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${activity.progress}%` }}
              />
            </div>
          )}
        </div>
      </button>
      {isError && (
        <button
          onClick={() => onDismiss(activity.id)}
          className="px-2 flex items-center text-gray-500 hover:text-gray-200 rounded-r-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
          aria-label={t.stage.dismiss}
          title={t.stage.dismiss}
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      )}
    </li>
  );
}
