import { describe, expect, it } from "vitest";
import {
  describeSchedule,
  formatClock,
  formatTimeUntil,
  nextRunFor,
  sanitizeDays,
  sortSchedules,
  type ScheduleTiming,
} from "./audioSchedule";
import type { AudioSchedule } from "./audioSchedule.types";
import { getTranslations } from "./i18n";

// vitest.config.ts pins TZ=Europe/Bucharest, so these local dates are
// Bucharest wall-clock times. Months are 0-based: 8 = September.
const at = (y: number, m: number, d: number, h = 0, min = 0, s = 0) =>
  new Date(y, m, d, h, min, s).getTime();

const HOUR = 3_600_000;
const MINUTE = 60_000;

// Wednesday 23 September 2026, 12:00.
const WED_NOON = at(2026, 8, 23, 12);

const daily = (hour: number, minute: number): ScheduleTiming => ({
  repeat: "daily",
  hour,
  minute,
});
const weekly = (daysOfWeek: number[], hour = 10, minute = 25): ScheduleTiming => ({
  repeat: "weekly",
  hour,
  minute,
  daysOfWeek,
});

const en = getTranslations("en");
const ro = getTranslations("ro");

describe("nextRunFor", () => {
  describe.each(["once", "daily"] as const)("%s", (repeat) => {
    it("fires later today when the time hasn't passed yet", () => {
      expect(nextRunFor({ repeat, hour: 18, minute: 30 }, WED_NOON)).toBe(at(2026, 8, 23, 18, 30));
    });

    it("rolls to tomorrow when the time has passed", () => {
      expect(nextRunFor({ repeat, hour: 9, minute: 0 }, WED_NOON)).toBe(at(2026, 8, 24, 9, 0));
    });

    it("fires right now when `from` is exactly the slot", () => {
      expect(nextRunFor({ repeat, hour: 12, minute: 0 }, WED_NOON)).toBe(WED_NOON);
    });

    it("rolls to tomorrow a second after the slot", () => {
      expect(nextRunFor({ repeat, hour: 12, minute: 0 }, WED_NOON + 1000)).toBe(
        at(2026, 8, 24, 12, 0)
      );
    });

    it("rolls over month and year boundaries", () => {
      expect(nextRunFor({ repeat, hour: 8, minute: 0 }, at(2026, 11, 31, 23, 0))).toBe(
        at(2027, 0, 1, 8, 0)
      );
    });
  });

  describe("weekly", () => {
    // From Wednesday noon; 0 = Sunday … 6 = Saturday.
    it.each([
      ["Sunday", [0], at(2026, 8, 27, 10, 25)],
      ["Monday", [1], at(2026, 8, 28, 10, 25)],
      ["Tuesday", [2], at(2026, 8, 29, 10, 25)],
      ["Wednesday (passed today, so next week)", [3], at(2026, 8, 30, 10, 25)],
      ["Thursday", [4], at(2026, 8, 24, 10, 25)],
      ["Friday", [5], at(2026, 8, 25, 10, 25)],
      ["Saturday", [6], at(2026, 8, 26, 10, 25)],
      ["the earliest of several days", [1, 5, 6], at(2026, 8, 25, 10, 25)],
      ["wrapping past the weekend", [1, 2], at(2026, 8, 28, 10, 25)],
    ])("picks %s", (_label, days, expected) => {
      expect(nextRunFor(weekly(days), WED_NOON)).toBe(expected);
    });

    it("fires later today when today is selected and the time is ahead", () => {
      expect(nextRunFor(weekly([3], 18, 0), WED_NOON)).toBe(at(2026, 8, 23, 18, 0));
    });

    it("fires right now on the exact slot", () => {
      expect(nextRunFor(weekly([3], 12, 0), WED_NOON)).toBe(WED_NOON);
    });

    it("waits a full week when the only day's slot just passed", () => {
      expect(nextRunFor(weekly([3], 12, 0), WED_NOON + 1000)).toBe(at(2026, 8, 30, 12, 0));
    });

    it("ignores day order and duplicates", () => {
      expect(nextRunFor(weekly([6, 1, 6, 1]), WED_NOON)).toBe(at(2026, 8, 26, 10, 25));
    });

    it("behaves like daily with no days selected", () => {
      expect(nextRunFor(weekly([]), WED_NOON)).toBe(at(2026, 8, 24, 10, 25));
      expect(nextRunFor({ repeat: "weekly", hour: 10, minute: 25 }, WED_NOON)).toBe(
        at(2026, 8, 24, 10, 25)
      );
    });

    it("drops out-of-range days, and treats all-invalid as no days", () => {
      expect(nextRunFor(weekly([7, -1, 1.5, 6]), WED_NOON)).toBe(at(2026, 8, 26, 10, 25));
      expect(nextRunFor(weekly([7, -1, 1.5]), WED_NOON)).toBe(at(2026, 8, 24, 10, 25));
    });
  });

  it("only honours daysOfWeek for weekly schedules", () => {
    expect(nextRunFor({ ...daily(10, 25), daysOfWeek: [6] }, WED_NOON)).toBe(
      at(2026, 8, 24, 10, 25)
    );
  });

  // Europe/Bucharest: clocks jump 03:00 → 04:00 on Sunday 29 March 2026 and
  // fall back 04:00 → 03:00 on Sunday 25 October 2026.
  describe("across DST", () => {
    it("keeps the wall-clock time when the day before spring-forward is 23h long", () => {
      const next = nextRunFor(daily(10, 0), at(2026, 2, 28, 10, 1));
      expect(next).toBe(at(2026, 2, 29, 10, 0));
      expect(new Date(next!).getHours()).toBe(10);
      expect(next! - at(2026, 2, 28, 10, 0)).toBe(23 * HOUR);
    });

    it("keeps the wall-clock time when the day before fall-back is 25h long", () => {
      const next = nextRunFor(daily(10, 0), at(2026, 9, 24, 10, 1));
      expect(new Date(next!).getHours()).toBe(10);
      expect(next! - at(2026, 9, 24, 10, 0)).toBe(25 * HOUR);
    });

    it("keeps a weekly slot at the same wall-clock time across the change", () => {
      const next = nextRunFor(weekly([0], 10, 25), at(2026, 2, 22, 11, 0));
      const date = new Date(next!);
      expect([date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()]).toEqual([
        2, 29, 10, 25,
      ]);
    });

    it("fires a slot inside the skipped hour at the equivalent moment after the jump", () => {
      // 03:30 doesn't exist on spring-forward day; Date resolves it forward
      // to 04:30, which is 03:30 + the hour that vanished.
      const next = nextRunFor(daily(3, 30), at(2026, 2, 29, 0, 0));
      expect(new Date(next!).getHours()).toBe(4);
      expect(new Date(next!).getMinutes()).toBe(30);
      expect(next! - at(2026, 2, 29, 0, 0)).toBe(3.5 * HOUR);
    });

    it("returns to the normal time the day after the skipped hour", () => {
      const next = nextRunFor(daily(3, 30), at(2026, 2, 29, 5, 0));
      expect(next).toBe(at(2026, 2, 30, 3, 30));
      expect(new Date(next!).getHours()).toBe(3);
    });

    it("fires a slot inside the repeated hour only once", () => {
      const first = nextRunFor(daily(3, 30), at(2026, 9, 25, 0, 0))!;
      expect(new Date(first).getHours()).toBe(3);
      expect(first - at(2026, 9, 25, 0, 0)).toBe(3.5 * HOUR);
      // An hour later the wall clock reads 03:30 again; the scheduler asks
      // from just past the run it made, and must not replay the same slot.
      expect(nextRunFor(daily(3, 30), first + MINUTE)).toBe(at(2026, 9, 26, 3, 30));
      expect(nextRunFor(daily(3, 30), first + HOUR)).toBe(at(2026, 9, 26, 3, 30));
    });
  });
});

describe("sanitizeDays", () => {
  it("dedupes, sorts and drops invalid days", () => {
    expect(sanitizeDays([6, 0, 6, 3, 7, -1, 2.5, NaN])).toEqual([0, 3, 6]);
    expect(sanitizeDays(undefined)).toEqual([]);
  });
});

describe("formatClock", () => {
  it.each([
    [0, 0, "00:00"],
    [9, 5, "09:05"],
    [10, 25, "10:25"],
    [23, 59, "23:59"],
  ])("%i:%i → %s", (hour, minute, expected) => {
    expect(formatClock(hour, minute)).toBe(expected);
  });
});

describe("describeSchedule", () => {
  it("describes daily schedules", () => {
    expect(describeSchedule(daily(9, 5), en)).toBe("Every day at 09:05");
    expect(describeSchedule(daily(9, 5), ro)).toBe("În fiecare zi la 09:05");
  });

  it("lists weekly days Monday first, whatever order they were picked in", () => {
    expect(describeSchedule(weekly([0, 6, 1]), en)).toBe(
      "Every Monday, Saturday, Sunday at 10:25"
    );
    expect(describeSchedule(weekly([0, 6, 1]), ro)).toBe(
      "În fiecare luni, sâmbătă, duminică la 10:25"
    );
  });

  it("describes a single weekly day", () => {
    expect(describeSchedule(weekly([6]), en)).toBe("Every Saturday at 10:25");
  });

  it.each([
    ["no days", []],
    ["every day", [0, 1, 2, 3, 4, 5, 6]],
  ])("reads as daily when a weekly schedule has %s", (_label, days) => {
    expect(describeSchedule(weekly(days), en)).toBe("Every day at 10:25");
  });

  describe("once", () => {
    const once = (hour: number, minute: number): ScheduleTiming => ({ repeat: "once", hour, minute });

    it("says today or tomorrow when working out the run itself", () => {
      expect(describeSchedule(once(18, 0), en, undefined, WED_NOON)).toBe("Today at 18:00");
      expect(describeSchedule(once(9, 0), en, undefined, WED_NOON)).toBe("Tomorrow at 09:00");
      expect(describeSchedule(once(9, 0), ro, undefined, WED_NOON)).toBe("Mâine la 09:00");
    });

    it("names the weekday for a run further out", () => {
      const saturday = at(2026, 8, 26, 9, 0);
      expect(describeSchedule(once(9, 0), en, saturday, WED_NOON)).toBe("Saturday at 09:00");
      expect(describeSchedule(once(9, 0), ro, saturday, WED_NOON)).toBe("sâmbătă la 09:00");
    });

    it("names no day when the schedule isn't armed", () => {
      expect(describeSchedule(once(9, 0), en, null, WED_NOON)).toBe("Once at 09:00");
      expect(describeSchedule(once(9, 0), ro, null, WED_NOON)).toBe("O dată la 09:00");
    });

    it("counts calendar days, not elapsed hours, across a 23h day", () => {
      const now = at(2026, 2, 28, 23, 30);
      expect(describeSchedule(once(0, 30), en, at(2026, 2, 29, 0, 30), now)).toBe(
        "Tomorrow at 00:30"
      );
      expect(describeSchedule(once(23, 0), en, at(2026, 2, 29, 23, 0), now)).toBe(
        "Tomorrow at 23:00"
      );
    });
  });
});

describe("formatTimeUntil", () => {
  it.each([
    [-5000, "now", "acum"],
    [0, "now", "acum"],
    [999, "0s", "0s"],
    [42_000, "42s", "42s"],
    [8 * MINUTE + 59_000, "8m", "8m"],
    [3 * HOUR + 12 * MINUTE, "3h 12m", "3h 12m"],
    [2 * 24 * HOUR + 4 * HOUR + 30 * MINUTE, "2d 4h", "2z 4h"],
    [24 * HOUR, "1d 0h", "1z 0h"],
  ])("%i ms → %s", (ms, english, romanian) => {
    expect(formatTimeUntil(ms, en)).toBe(english);
    expect(formatTimeUntil(ms, ro)).toBe(romanian);
  });
});

describe("sortSchedules", () => {
  const schedule = (id: string, overrides: Partial<AudioSchedule>): AudioSchedule => ({
    id,
    audioId: "a",
    audioName: "a.mp3",
    audioPath: "/a.mp3",
    repeat: "daily",
    hour: 10,
    minute: 0,
    daysOfWeek: [],
    enabled: true,
    nextRunAt: null,
    createdAt: 0,
    ...overrides,
  });

  it("puts enabled first, soonest first, unscheduled last, then oldest first", () => {
    const input = [
      schedule("disabled-soon", { enabled: false, nextRunAt: 1 }),
      schedule("later", { nextRunAt: 300 }),
      schedule("unarmed", { nextRunAt: null }),
      schedule("soon-newer", { nextRunAt: 100, createdAt: 20 }),
      schedule("soon-older", { nextRunAt: 100, createdAt: 10 }),
      schedule("disabled-old", { enabled: false, createdAt: 1 }),
    ];
    expect(sortSchedules(input).map((s) => s.id)).toEqual([
      "soon-older",
      "soon-newer",
      "later",
      "unarmed",
      "disabled-soon",
      "disabled-old",
    ]);
  });

  it("doesn't reorder the caller's array", () => {
    const input = [schedule("b", { nextRunAt: 2 }), schedule("a", { nextRunAt: 1 })];
    sortSchedules(input);
    expect(input.map((s) => s.id)).toEqual(["b", "a"]);
  });
});
