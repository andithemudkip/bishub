import { describe, expect, it } from "vitest";
import type { AudioItem } from "./audioLibrary.types";
import type { AudioSchedule, ScheduleEvent } from "./audioSchedule.types";
import type { Activity, ActivityKind, ActivityStatus } from "./stage.types";
import type { MP3DownloadStatus } from "./types";
import {
  ACTIVITY_FADE_MS,
  BULK_MP3_ID,
  BULK_MP3_THRESHOLD,
  SCHEDULE_EVENT_LIMIT,
  SCHEDULE_EVENT_TTL_MS,
  applyActivity,
  dismissActivity,
  getUpcomingSchedules,
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
  pushScheduleEvent,
  pruneScheduleEvents,
} from "./stageActivity";

const NOW = 1_700_000_000_000;

function activity(overrides: Partial<Activity> & { id: string }): Activity {
  return {
    kind: "video-download",
    status: "running",
    label: overrides.id,
    progress: null,
    startedAt: NOW,
    updatedAt: NOW,
    target: "video",
    ...overrides,
  };
}

function mp3(number: string, status: ActivityStatus, updatedAt = NOW): Activity {
  return activity({
    id: `hymn-mp3:${number}`,
    kind: "hymn-mp3",
    status,
    label: number,
    startedAt: updatedAt,
    updatedAt,
    target: "hymns",
  });
}

function schedule(id: string, overrides: Partial<AudioSchedule> = {}): AudioSchedule {
  return {
    id,
    audioId: "a",
    audioName: "Bell",
    audioPath: "/bell.mp3",
    repeat: "daily",
    hour: 10,
    minute: 0,
    daysOfWeek: [],
    enabled: true,
    nextRunAt: NOW,
    createdAt: NOW,
    ...overrides,
  };
}

function event(id: string, timestamp: number): ScheduleEvent {
  return { type: "triggered", schedule: schedule(id), timestamp };
}

describe("status collapsing", () => {
  it.each<[string, ActivityStatus]>([
    ["pending", "pending"],
    ["downloading", "running"],
    ["processing", "running"],
    ["complete", "complete"],
    ["error", "error"],
  ])("video download %s → %s", (status, expected) => {
    const a = normalizeVideoDownload(
      { id: "v1", url: "https://y/1", status: status as "pending", progress: 10 },
      NOW
    );
    expect(a.status).toBe(expected);
  });

  it.each<[string, ActivityStatus]>([
    ["uploading", "running"],
    ["processing", "running"],
    ["complete", "complete"],
    ["error", "error"],
  ])("uploads %s → %s", (status, expected) => {
    const progress = { id: "u1", filename: "f", status: status as "uploading", progress: 5 };
    for (const normalize of [
      normalizeVideoUpload,
      normalizeAudioUpload,
      normalizeImageUpload,
      normalizeTransferUpload,
    ]) {
      expect(normalize(progress, NOW).status).toBe(expected);
    }
  });

  it.each<[MP3DownloadStatus, ActivityStatus]>([
    ["queued", "pending"],
    ["downloading", "running"],
    ["complete", "complete"],
    // A cancelled download is over, not a failure: it fades like a completed one.
    ["cancelled", "complete"],
    ["error", "error"],
  ])("hymn MP3 %s → %s", (status, expected) => {
    const a = normalizeHymnMp3(
      { id: "12", hymnNumber: "12", bytesDownloaded: 0, bytesTotal: 0, status },
      NOW
    );
    expect(a.status).toBe(expected);
  });

  it.each<["scanning" | "importing" | "complete" | "error", ActivityStatus]>([
    ["scanning", "running"],
    ["importing", "running"],
    ["complete", "complete"],
    ["error", "error"],
  ])("audio import %s → %s", (status, expected) => {
    const a = normalizeAudioImport(
      {
        id: "i1",
        directory: "/music",
        current: 0,
        total: 0,
        currentFile: "",
        completed: [],
        errors: [],
        status,
      },
      NOW
    );
    expect(a.status).toBe(expected);
  });

  it.each<["downloading" | "ready" | "error", ActivityStatus]>([
    ["downloading", "running"],
    ["ready", "complete"],
    ["error", "error"],
  ])("bible translation %s → %s", (status, expected) => {
    expect(normalizeBibleTranslation({ translationId: "t", status }, NOW).status).toBe(expected);
  });
});

describe("normalizers", () => {
  it.each<[string, Activity, string, ActivityKind, Activity["target"]]>([
    [
      "video download",
      normalizeVideoDownload({ id: "x", url: "u", status: "downloading", progress: 1 }, NOW),
      "video-download:x",
      "video-download",
      "video",
    ],
    [
      "video upload",
      normalizeVideoUpload({ id: "x", filename: "f", status: "uploading", progress: 1 }, NOW),
      "video-upload:x",
      "video-upload",
      "video",
    ],
    [
      "audio download",
      normalizeAudioDownload({ id: "x", url: "u", status: "downloading", progress: 1 }, NOW),
      "audio-download:x",
      "audio-download",
      "audio",
    ],
    [
      "audio upload",
      normalizeAudioUpload({ id: "x", filename: "f", status: "uploading", progress: 1 }, NOW),
      "audio-upload:x",
      "audio-upload",
      "audio",
    ],
    [
      "image upload",
      normalizeImageUpload({ id: "x", filename: "f", status: "uploading", progress: 1 }, NOW),
      "image-upload:x",
      "image-upload",
      "images",
    ],
    [
      "transfer",
      normalizeTransferUpload({ id: "x", filename: "f", status: "uploading", progress: 1 }, NOW),
      "transfer:x",
      "transfer",
      "transfer",
    ],
    [
      "hymn MP3",
      normalizeHymnMp3(
        { id: "x", hymnNumber: "x", bytesDownloaded: 0, bytesTotal: 0, status: "queued" },
        NOW
      ),
      "hymn-mp3:x",
      "hymn-mp3",
      "hymns",
    ],
    [
      "bible translation",
      normalizeBibleTranslation({ translationId: "x", status: "downloading" }, NOW),
      "bible-translation:x",
      "bible-translation",
      "bible",
    ],
  ])("%s gets a stable id, kind and target", (_name, a, id, kind, target) => {
    expect(a).toMatchObject({ id, kind, target, startedAt: NOW, updatedAt: NOW });
  });

  it("labels downloads by filename, falling back to the URL", () => {
    const base = { id: "d", url: "https://y/1", status: "downloading" as const, progress: 0 };
    expect(normalizeVideoDownload(base, NOW).label).toBe("https://y/1");
    expect(normalizeVideoDownload({ ...base, filename: "a.mp4" }, NOW).label).toBe("a.mp4");
    expect(normalizeAudioDownload(base, NOW).label).toBe("https://y/1");
    expect(normalizeAudioDownload({ ...base, filename: "a.mp3" }, NOW).label).toBe("a.mp3");
  });

  it("surfaces the download stage only while progress is still 0", () => {
    const base = { id: "d", url: "u", status: "downloading" as const, stage: "fetching" as const };
    expect(normalizeVideoDownload({ ...base, progress: 0 }, NOW).stage).toBe("fetching");
    expect(normalizeVideoDownload({ ...base, progress: 12 }, NOW).stage).toBeUndefined();
    expect(normalizeAudioDownload({ ...base, progress: 0 }, NOW).stage).toBe("fetching");
    expect(normalizeAudioDownload({ ...base, progress: 12 }, NOW).stage).toBeUndefined();
  });

  it("passes the backend error through", () => {
    const a = normalizeVideoUpload(
      { id: "u", filename: "f", status: "error", progress: 40, error: "disk full" },
      NOW
    );
    expect(a).toMatchObject({ status: "error", progress: 40, error: "disk full" });
  });

  it.each<[number, number, number | null]>([
    [0, 0, null],
    [500, 0, null],
    [0, 1000, 0],
    [250, 1000, 25],
    [1000, 1000, 100],
  ])("hymn MP3 %i of %i bytes → progress %s", (bytesDownloaded, bytesTotal, expected) => {
    const a = normalizeHymnMp3(
      { id: "7", hymnNumber: "7", bytesDownloaded, bytesTotal, status: "downloading" },
      NOW
    );
    expect(a.progress).toBe(expected);
  });

  it("reports directory import counts and progress", () => {
    const a = normalizeAudioImport(
      {
        id: "i",
        directory: "/music",
        current: 3,
        total: 12,
        currentFile: "c.mp3",
        completed: [{} as AudioItem, {} as AudioItem],
        errors: [{ file: "b.mp3", error: "bad" }],
        status: "importing",
      },
      NOW
    );
    expect(a).toMatchObject({
      id: "audio-import:i",
      label: "/music",
      progress: 25,
      current: 3,
      total: 12,
      currentItem: "c.mp3",
      succeeded: 2,
      failed: 1,
    });
  });

  it("has no directory import progress before the scan knows the total", () => {
    const a = normalizeAudioImport(
      {
        id: "i",
        directory: "/music",
        current: 0,
        total: 0,
        currentFile: "",
        completed: [],
        errors: [],
        status: "scanning",
      },
      NOW
    );
    expect(a.progress).toBeNull();
  });

  it("defaults a missing bible translation progress to null", () => {
    expect(normalizeBibleTranslation({ translationId: "t", status: "ready" }, NOW).progress).toBe(
      null
    );
    expect(
      normalizeBibleTranslation({ translationId: "t", status: "downloading", progress: 40 }, NOW)
        .progress
    ).toBe(40);
  });
});

describe("applyActivity", () => {
  it("appends a new activity", () => {
    const a = activity({ id: "a" });
    const b = activity({ id: "b" });
    expect(applyActivity([a], b, NOW)).toEqual([a, b]);
  });

  it("replaces in place, keeping startedAt and stamping updatedAt", () => {
    const a = activity({ id: "a", startedAt: NOW - 40_000, updatedAt: NOW - 1000 });
    const b = activity({ id: "b" });
    const update = activity({ id: "a", progress: 60, startedAt: NOW, updatedAt: NOW });

    const next = applyActivity([a, b], update, NOW + 5);

    expect(next.map((x) => x.id)).toEqual(["a", "b"]);
    expect(next[0]).toMatchObject({ progress: 60, startedAt: NOW - 40_000, updatedAt: NOW + 5 });
  });

  it("does not mutate the input list", () => {
    const list = [activity({ id: "a" })];
    const copy = structuredClone(list);
    applyActivity(list, activity({ id: "a", progress: 10 }), NOW);
    applyActivity(list, activity({ id: "b" }), NOW);
    expect(list).toEqual(copy);
  });
});

describe("dismissActivity", () => {
  it("removes only the matching id", () => {
    const list = [activity({ id: "a" }), activity({ id: "b" })];
    expect(dismissActivity(list, "a").map((x) => x.id)).toEqual(["b"]);
    expect(dismissActivity(list, "missing")).toEqual(list);
  });

  it("dismissing the bulk row removes every hymn MP3 row", () => {
    const list = [mp3("1", "complete"), activity({ id: "a" }), mp3("2", "error")];
    expect(dismissActivity(list, BULK_MP3_ID).map((x) => x.id)).toEqual(["a"]);
  });
});

describe("pruneActivities", () => {
  it.each<[ActivityStatus, number, boolean]>([
    ["complete", ACTIVITY_FADE_MS - 1, true],
    ["complete", ACTIVITY_FADE_MS, false],
    ["complete", ACTIVITY_FADE_MS * 10, false],
    ["error", ACTIVITY_FADE_MS * 10, true],
    ["running", ACTIVITY_FADE_MS * 10, true],
    ["pending", ACTIVITY_FADE_MS * 10, true],
  ])("a %s row updated %ims ago is kept: %s", (status, age, kept) => {
    const list = [activity({ id: "a", status, updatedAt: NOW })];
    expect(pruneActivities(list, NOW + age)).toHaveLength(kept ? 1 : 0);
  });

  it("keeps completed MP3s while any MP3 is still live", () => {
    const list = [mp3("1", "complete", NOW), mp3("2", "running", NOW)];
    expect(pruneActivities(list, NOW + ACTIVITY_FADE_MS * 10)).toHaveLength(2);
  });

  it("fades completed MP3s together, timed from the last MP3 update", () => {
    const list = [mp3("1", "complete", NOW), mp3("2", "complete", NOW + 5000)];
    expect(pruneActivities(list, NOW + ACTIVITY_FADE_MS + 1000)).toHaveLength(2);
    expect(pruneActivities(list, NOW + 5000 + ACTIVITY_FADE_MS)).toHaveLength(0);
  });

  it("keeps failed MP3s after the completed ones fade", () => {
    const list = [mp3("1", "complete", NOW), mp3("2", "error", NOW)];
    expect(pruneActivities(list, NOW + ACTIVITY_FADE_MS).map((x) => x.id)).toEqual([
      "hymn-mp3:2",
    ]);
  });

  it("does not let live MP3s hold back other completed kinds", () => {
    const list = [activity({ id: "a", status: "complete" }), mp3("1", "running")];
    expect(pruneActivities(list, NOW + ACTIVITY_FADE_MS).map((x) => x.id)).toEqual([
      "hymn-mp3:1",
    ]);
  });
});

describe("groupHymnMp3Activities", () => {
  const other = activity({ id: "video-download:v" });

  function mp3s(statuses: ActivityStatus[]): Activity[] {
    return statuses.map((status, i) => mp3(String(i + 1), status, NOW + i));
  }

  it("leaves the list alone at or below the threshold", () => {
    const list = [other, ...mp3s(Array(BULK_MP3_THRESHOLD).fill("running"))];
    expect(groupHymnMp3Activities(list)).toBe(list);
  });

  it("collapses MP3 rows above the threshold into one bulk row after the others", () => {
    const list = [
      mp3("1", "complete"),
      other,
      ...mp3s(["running", "pending", "error"]).map((a, i) => ({ ...a, id: `hymn-mp3:x${i}` })),
    ];
    const grouped = groupHymnMp3Activities(list);

    expect(grouped.map((x) => x.id)).toEqual([other.id, BULK_MP3_ID]);
    expect(grouped[1]).toMatchObject({
      kind: "hymn-mp3",
      status: "running",
      label: "",
      progress: 50,
      grouped: { count: 4, done: 1, failed: 1 },
      target: "hymns",
    });
  });

  it("spans the earliest start to the latest update", () => {
    const [bulk] = groupHymnMp3Activities(mp3s(["running", "running", "running", "running"]));
    expect(bulk.startedAt).toBe(NOW);
    expect(bulk.updatedAt).toBe(NOW + 3);
  });

  it.each<[ActivityStatus[], ActivityStatus]>([
    [["complete", "complete", "complete", "pending"], "running"],
    [["complete", "complete", "complete", "complete"], "complete"],
    [["complete", "complete", "complete", "error"], "error"],
    [["error", "error", "error", "error"], "error"],
  ])("%j → bulk status %s", (statuses, expected) => {
    const [bulk] = groupHymnMp3Activities(mp3s(statuses));
    expect(bulk.status).toBe(expected);
  });

  it("reaches 100% once every MP3 has finished, failures included", () => {
    const [bulk] = groupHymnMp3Activities(mp3s(["complete", "error", "complete", "error"]));
    expect(bulk.progress).toBe(100);
  });
});

describe("schedule events", () => {
  it("pushes newest first and caps at the limit", () => {
    let list: ScheduleEvent[] = [];
    for (let i = 0; i < SCHEDULE_EVENT_LIMIT + 3; i++) {
      list = pushScheduleEvent(list, event(String(i), NOW + i));
    }
    expect(list).toHaveLength(SCHEDULE_EVENT_LIMIT);
    expect(list[0].schedule.id).toBe(String(SCHEDULE_EVENT_LIMIT + 2));
    expect(list[list.length - 1].schedule.id).toBe("3");
  });

  it("honours a custom limit", () => {
    const list = pushScheduleEvent([event("a", NOW), event("b", NOW)], event("c", NOW), 2);
    expect(list.map((e) => e.schedule.id)).toEqual(["c", "a"]);
  });

  it("drops events once they reach the TTL", () => {
    const list = [event("fresh", NOW - SCHEDULE_EVENT_TTL_MS + 1), event("old", NOW - SCHEDULE_EVENT_TTL_MS)];
    expect(pruneScheduleEvents(list, NOW).map((e) => e.schedule.id)).toEqual(["fresh"]);
    expect(pruneScheduleEvents(list, NOW, 1)).toEqual([]);
  });
});

describe("getUpcomingSchedules", () => {
  it("returns enabled schedules with a next run, soonest first, capped", () => {
    const schedules = [
      schedule("late", { nextRunAt: NOW + 4000 }),
      schedule("disabled", { enabled: false, nextRunAt: NOW + 1 }),
      schedule("finished", { nextRunAt: null }),
      schedule("soon", { nextRunAt: NOW + 1000 }),
      schedule("mid", { nextRunAt: NOW + 2000 }),
      schedule("later", { nextRunAt: NOW + 3000 }),
    ];
    expect(getUpcomingSchedules(schedules).map((s) => s.id)).toEqual(["soon", "mid", "later"]);
    expect(getUpcomingSchedules(schedules, 10).map((s) => s.id)).toEqual([
      "soon",
      "mid",
      "later",
      "late",
    ]);
  });

  it("does not reorder the caller's array", () => {
    const schedules = [schedule("b", { nextRunAt: NOW + 2 }), schedule("a", { nextRunAt: NOW + 1 })];
    getUpcomingSchedules(schedules);
    expect(schedules.map((s) => s.id)).toEqual(["b", "a"]);
  });
});
