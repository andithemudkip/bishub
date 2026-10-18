import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useBrowsingHymnal } from "./useBrowsingHymnal";

afterEach(() => sessionStorage.clear());

function setup(defaultSlug: string) {
  return renderHook(({ slug }) => useBrowsingHymnal(slug), {
    initialProps: { slug: defaultSlug },
  });
}

describe("useBrowsingHymnal", () => {
  it("starts on the default book", () => {
    expect(setup("imnuri-crestine").result.current.hymnal).toBe("imnuri-crestine");
  });

  it("switches books locally", () => {
    const { result } = setup("imnuri-crestine");
    act(() => result.current.selectHymnal("harul"));
    expect(result.current.hymnal).toBe("harul");
  });

  it("keeps the choice across a reload of the tab", () => {
    const first = setup("imnuri-crestine");
    act(() => first.result.current.selectHymnal("harul"));
    first.unmount();

    expect(setup("imnuri-crestine").result.current.hymnal).toBe("harul");
  });

  it("keeps the choice when settings arrive with the same default", () => {
    const { result, rerender } = setup("imnuri-crestine");
    act(() => result.current.selectHymnal("harul"));
    rerender({ slug: "imnuri-crestine" });
    expect(result.current.hymnal).toBe("harul");
  });

  it("follows the default when it changes in Settings", () => {
    const { result, rerender } = setup("imnuri-crestine");
    act(() => result.current.selectHymnal("harul"));
    rerender({ slug: "sda-hymnal" });
    expect(result.current.hymnal).toBe("sda-hymnal");
  });

  it("drops a stored choice made against another default", () => {
    const first = setup("imnuri-crestine");
    act(() => first.result.current.selectHymnal("harul"));
    first.unmount();

    expect(setup("sda-hymnal").result.current.hymnal).toBe("sda-hymnal");
  });

  it("ignores unreadable storage", () => {
    sessionStorage.setItem("browsing-hymnal", "{not json");
    expect(setup("imnuri-crestine").result.current.hymnal).toBe("imnuri-crestine");
  });
});
