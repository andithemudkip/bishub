import { describe, expect, it } from "vitest";
import { resolveDisplayMonitor } from "./utils";

describe("resolveDisplayMonitor", () => {
  const primary = { id: 1 };
  const projector = { id: 2 };
  const tv = { id: 3 };

  it("uses the monitor chosen in Settings", () => {
    expect(resolveDisplayMonitor([primary, projector, tv], 1, 3)).toBe(tv);
  });

  it("picks the first non-primary monitor on auto", () => {
    expect(resolveDisplayMonitor([primary, projector, tv], 1, -1)).toBe(projector);
  });

  it("falls back like auto when the chosen monitor is unplugged", () => {
    expect(resolveDisplayMonitor([primary, projector], 1, 3)).toBe(projector);
  });

  it("uses the primary when it is the only monitor", () => {
    expect(resolveDisplayMonitor([primary], 1, -1)).toBe(primary);
    expect(resolveDisplayMonitor([primary], 1, 3)).toBe(primary);
  });

  it("returns nothing for an empty list", () => {
    expect(resolveDisplayMonitor([], 1, -1)).toBeUndefined();
  });
});
