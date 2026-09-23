import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "../shared/types";
import type { Activity } from "../shared/stage.types";
import type { AudioSchedule, ScheduleEvent } from "../shared/audioSchedule.types";
import {
  applyActivity,
  dismissActivity,
  groupHymnMp3Activities,
  normalizeAudioDownload,
  normalizeAudioImport,
  normalizeAudioUpload,
  normalizeBibleTranslation,
  normalizeHymnMp3,
  normalizeImageUpload,
  normalizeTransferUpload,
  normalizeVideoDownload,
  normalizeVideoUpload,
  pruneActivities,
  pruneScheduleEvents,
  pushScheduleEvent,
  getUpcomingSchedules,
} from "../shared/stageActivity";
import { getDeviceToken } from "../shared/utils";

type SocketType = Socket<ServerToClientEvents, ClientToServerEvents>;

/** How often completed activities and expired schedule events are pruned. */
const PRUNE_INTERVAL_MS = 1000;

interface ActivityAPI {
  /** Normalized, bulk-MP3-grouped, ready to render. */
  activities: Activity[];
  /** Removes an activity immediately — used for dismissing a persisted error. */
  dismiss: (id: string) => void;
  /** Enabled schedules with a future run, soonest first. */
  upcomingSchedules: AudioSchedule[];
  /** Recent `triggered`/`skipped`/`missed`/`deleted` events, newest first, briefly. */
  recentScheduleEvents: ScheduleEvent[];
}

/**
 * Subscribes to every progress stream the Stage needs (Feature A4), at
 * `Layout` level so activity survives navigation instead of living and dying
 * with whichever page started the operation.
 *
 * Mirrors the sibling library hooks (`useVideoLibrary`, `useTransfers`, …):
 * an Electron IPC branch and an independent Socket.io branch, each with its
 * own cleanup. Page hooks subscribe to some of the same streams; that's safe
 * because every preload `on*` helper removes only its own handler, and each
 * web hook owns its socket.
 *
 * Directory import (`onAudioDirectoryImportProgress`) is Electron-only: it
 * goes through the native folder picker, so no web remote can start one.
 */
export function useActivity(): ActivityAPI {
  const [rawActivities, setRawActivities] = useState<Activity[]>([]);
  const [schedules, setSchedules] = useState<AudioSchedule[]>([]);
  const [recentScheduleEvents, setRecentScheduleEvents] = useState<ScheduleEvent[]>([]);

  const socketRef = useRef<SocketType | null>(null);
  const isElectron = !!window.electronAPI;

  const upsert = useCallback((activity: Activity) => {
    setRawActivities((prev) => applyActivity(prev, activity, Date.now()));
  }, []);

  const handleScheduleEvent = useCallback((event: ScheduleEvent) => {
    setRecentScheduleEvents((prev) => pushScheduleEvent(prev, event));
  }, []);

  useEffect(() => {
    if (isElectron) {
      const api = window.electronAPI!;

      // Seed already-in-flight downloads so a Layout mounted mid-download
      // doesn't show nothing until the next progress tick.
      api.getActiveDownloads().then((list) => {
        const now = Date.now();
        list.forEach((p) => upsert(normalizeVideoDownload(p, now)));
      });
      api.getActiveAudioDownloads().then((list) => {
        const now = Date.now();
        list.forEach((p) => upsert(normalizeAudioDownload(p, now)));
      });
      api.getAudioSchedules().then(setSchedules);

      const unsubDownload = api.onDownloadProgress((p) => upsert(normalizeVideoDownload(p, Date.now())));
      const unsubUpload = api.onUploadProgress((p) => upsert(normalizeVideoUpload(p, Date.now())));
      const unsubAudioDownload = api.onAudioDownloadProgress((p) => upsert(normalizeAudioDownload(p, Date.now())));
      const unsubAudioUpload = api.onAudioUploadProgress((p) => upsert(normalizeAudioUpload(p, Date.now())));
      const unsubAudioImport = api.onAudioDirectoryImportProgress((p) => upsert(normalizeAudioImport(p, Date.now())));
      const unsubImageUpload = api.onImageUploadProgress((p) => upsert(normalizeImageUpload(p, Date.now())));
      const unsubMp3 = api.onHymnMP3DownloadProgress((p) => upsert(normalizeHymnMp3(p, Date.now())));
      const unsubTransferUpload = api.onTransferUploadProgress((p) => upsert(normalizeTransferUpload(p, Date.now())));
      const unsubBible = api.onBibleTranslationStatus((p) => upsert(normalizeBibleTranslation(p, Date.now())));
      const unsubSchedules = api.onAudioSchedulesUpdate(setSchedules);
      const unsubScheduleEvent = api.onAudioScheduleEvent(handleScheduleEvent);

      return () => {
        unsubDownload();
        unsubUpload();
        unsubAudioDownload();
        unsubAudioUpload();
        unsubAudioImport();
        unsubImageUpload();
        unsubMp3();
        unsubTransferUpload();
        unsubBible();
        unsubSchedules();
        unsubScheduleEvent();
      };
    } else {
      const token = getDeviceToken();
      if (!token) return;
      const socket: SocketType = io({ auth: { token } });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("getAudioSchedules");
      });

      socket.on("downloadProgress", (p) => upsert(normalizeVideoDownload(p, Date.now())));
      socket.on("uploadProgress", (p) => upsert(normalizeVideoUpload(p, Date.now())));
      socket.on("audioDownloadProgress", (p) => upsert(normalizeAudioDownload(p, Date.now())));
      socket.on("audioUploadProgress", (p) => upsert(normalizeAudioUpload(p, Date.now())));
      socket.on("imageUploadProgress", (p) => upsert(normalizeImageUpload(p, Date.now())));
      socket.on("mp3DownloadProgress", (p) => upsert(normalizeHymnMp3(p, Date.now())));
      socket.on("transferUploadProgress", (p) => upsert(normalizeTransferUpload(p, Date.now())));
      socket.on("bibleTranslationStatus", (p) => upsert(normalizeBibleTranslation(p, Date.now())));
      socket.on("audioSchedules", setSchedules);
      socket.on("audioScheduleEvent", handleScheduleEvent);

      return () => {
        socket.disconnect();
      };
    }
  }, [isElectron, upsert, handleScheduleEvent]);

  // Fade completed activities and expire transient schedule events.
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRawActivities((prev) => pruneActivities(prev, now));
      setRecentScheduleEvents((prev) => pruneScheduleEvents(prev, now));
    }, PRUNE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const dismiss = useCallback((id: string) => {
    setRawActivities((prev) => dismissActivity(prev, id));
  }, []);

  const activities = useMemo(() => groupHymnMp3Activities(rawActivities), [rawActivities]);
  const upcomingSchedules = useMemo(() => getUpcomingSchedules(schedules), [schedules]);

  return { activities, dismiss, upcomingSchedules, recentScheduleEvents };
}
