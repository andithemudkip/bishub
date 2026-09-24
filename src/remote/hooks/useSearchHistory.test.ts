import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSearchHistory } from "./useSearchHistory";

type Entry = { id: string; label?: string };

const KEY = "recent-test";
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? "null");

function setup(max = 3, isSame?: (a: Entry, b: Entry) => boolean) {
  return renderHook(() => useSearchHistory<Entry>(KEY, max, isSame));
}

describe("useSearchHistory", () => {
  it("starts empty", () => {
    expect(setup().result.current.entries).toEqual([]);
  });

  it("puts the newest entry first and persists it", () => {
    const { result } = setup();
    act(() => result.current.add({ id: "a" }));
    act(() => result.current.add({ id: "b" }));
    expect(result.current.entries).toEqual([{ id: "b" }, { id: "a" }]);
    expect(stored()).toEqual([{ id: "b" }, { id: "a" }]);
  });

  it("moves a repeated entry to the front instead of duplicating it", () => {
    const { result } = setup();
    act(() => result.current.add({ id: "a", label: "old" }));
    act(() => result.current.add({ id: "b" }));
    act(() => result.current.add({ id: "a", label: "new" }));
    expect(result.current.entries).toEqual([{ id: "a", label: "new" }, { id: "b" }]);
  });

  it("keeps at most `max` entries, dropping the oldest", () => {
    const { result } = setup(2);
    for (const id of ["a", "b", "c"]) act(() => result.current.add({ id }));
    expect(result.current.entries.map((e) => e.id)).toEqual(["c", "b"]);
  });

  it("uses a custom sameness test when given", () => {
    const { result } = setup(3, (a, b) => a.label === b.label);
    act(() => result.current.add({ id: "1", label: "ioan 3" }));
    act(() => result.current.add({ id: "2", label: "ioan 3" }));
    expect(result.current.entries).toEqual([{ id: "2", label: "ioan 3" }]);
  });

  it("restores what an earlier session saved", () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: "saved" }]));
    expect(setup().result.current.entries).toEqual([{ id: "saved" }]);
  });

  it.each([["not json"], ['{"id":"a"}'], ["null"]])(
    "treats a corrupt stored value %j as empty",
    (raw) => {
      localStorage.setItem(KEY, raw);
      expect(setup().result.current.entries).toEqual([]);
    }
  );

  it("still works in memory when storage throws", () => {
    // Private mode / blocked storage: reads and writes throw.
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    try {
      const { result } = setup();
      expect(result.current.entries).toEqual([]);
      act(() => result.current.add({ id: "a" }));
      expect(result.current.entries).toEqual([{ id: "a" }]);
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });

  it("clears both memory and storage", () => {
    const { result } = setup();
    act(() => result.current.add({ id: "a" }));
    act(() => result.current.clear());
    expect(result.current.entries).toEqual([]);
    expect(stored()).toEqual([]);
  });
});
