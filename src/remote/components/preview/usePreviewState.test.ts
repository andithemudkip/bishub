import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePreviewState } from "./usePreviewState";

const setup = (autoCollapse: boolean) =>
  renderHook((props: { autoCollapse: boolean }) => usePreviewState({ isMobile: false, ...props }), {
    initialProps: { autoCollapse },
  });

describe("usePreviewState auto-collapse", () => {
  it("folds the panel while asked to and brings it back after", () => {
    const { result, rerender } = setup(false);
    expect(result.current.isOpen).toBe(true);

    rerender({ autoCollapse: true });
    expect(result.current.isOpen).toBe(false);

    rerender({ autoCollapse: false });
    expect(result.current.isOpen).toBe(true);
  });

  it("doesn't save the auto-collapse as the operator's choice", () => {
    setup(true);
    expect(localStorage.getItem("preview-collapsed")).toBeNull();
  });

  it("can be opened anyway, for this visit only", () => {
    const { result, rerender } = setup(true);
    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);

    // Closing it again on the same page doesn't save "collapsed"…
    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(false);
    expect(localStorage.getItem("preview-collapsed")).not.toBe("true");

    // …and the next visit starts folded again.
    act(() => result.current.open());
    rerender({ autoCollapse: false });
    rerender({ autoCollapse: true });
    expect(result.current.isOpen).toBe(false);
  });

  it("stays collapsed after leaving when the operator had collapsed it", () => {
    const { result, rerender } = setup(false);
    act(() => result.current.toggle());
    rerender({ autoCollapse: true });
    rerender({ autoCollapse: false });
    expect(result.current.isOpen).toBe(false);
  });
});
