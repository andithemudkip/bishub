import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MODIFIER_REVEAL_DELAY_MS, useModifierHeld } from "./useModifierHeld";

const press = (key: string) => act(() => void window.dispatchEvent(new KeyboardEvent("keydown", { key })));
const release = (key: string) => act(() => void window.dispatchEvent(new KeyboardEvent("keyup", { key })));
const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useModifierHeld", () => {
  it("turns on after ⌘ is held for a moment and off on release", () => {
    const { result } = renderHook(() => useModifierHeld());
    press("Meta");
    wait(MODIFIER_REVEAL_DELAY_MS - 1);
    expect(result.current).toBe(false);
    wait(1);
    expect(result.current).toBe(true);

    release("Meta");
    expect(result.current).toBe(false);
  });

  it("stays off for a quick shortcut like ⌘1", () => {
    const { result } = renderHook(() => useModifierHeld());
    press("Meta");
    wait(100);
    press("1");
    wait(MODIFIER_REVEAL_DELAY_MS);
    expect(result.current).toBe(false);
  });

  it("hides again when another key is pressed mid-hold", () => {
    const { result } = renderHook(() => useModifierHeld());
    press("Meta");
    wait(MODIFIER_REVEAL_DELAY_MS);
    press("3");
    expect(result.current).toBe(false);
  });

  it("doesn't restart the delay on key repeat", () => {
    const { result } = renderHook(() => useModifierHeld());
    press("Meta");
    wait(300);
    press("Meta");
    wait(MODIFIER_REVEAL_DELAY_MS - 300);
    expect(result.current).toBe(true);
  });

  it("resets when the window loses focus mid-hold", () => {
    const { result } = renderHook(() => useModifierHeld());
    press("Meta");
    wait(MODIFIER_REVEAL_DELAY_MS);
    act(() => void window.dispatchEvent(new Event("blur")));
    expect(result.current).toBe(false);
  });

  it("uses Ctrl off the Mac", () => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue("Win32");
    const { result } = renderHook(() => useModifierHeld());
    press("Meta");
    wait(MODIFIER_REVEAL_DELAY_MS);
    expect(result.current).toBe(false);
    press("Control");
    wait(MODIFIER_REVEAL_DELAY_MS);
    expect(result.current).toBe(true);
  });

  it("does nothing when disabled", () => {
    const { result } = renderHook(() => useModifierHeld(false));
    press("Meta");
    wait(MODIFIER_REVEAL_DELAY_MS);
    expect(result.current).toBe(false);
  });
});
