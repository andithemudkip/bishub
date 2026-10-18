import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ShortcutHint } from "./ShortcutHint";

function onPlatform(platform: string) {
  vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
}

afterEach(() => {
  vi.restoreAllMocks();
});

const label = (ui: React.ReactElement) => render(ui).container.textContent;

describe("ShortcutHint", () => {
  it.each([
    ["MacIntel", "quickSearch", "⌘K"],
    ["Win32", "quickSearch", "Ctrl+K"],
    ["Linux x86_64", "quickSearch", "Ctrl+K"],
    ["MacIntel", "shufflePlaylist", "⌥Enter"],
    ["Win32", "shufflePlaylist", "Alt+Enter"],
    ["MacIntel", "goIdle", "Esc"],
    ["Win32", "goIdle", "Esc"],
  ] as const)("on %s shows %s as %s", (platform, shortcut, expected) => {
    onPlatform(platform);
    expect(label(<ShortcutHint shortcut={shortcut} />)).toBe(expected);
  });

  it("shows the first key when a shortcut has several", () => {
    expect(label(<ShortcutHint shortcut="nextSlide" />)).toBe("→");
  });

  it("shows a specific key when asked", () => {
    onPlatform("MacIntel");
    expect(label(<ShortcutHint shortcut="switchPage" keyLabel="3" />)).toBe("⌘3");
  });

  it("is a <kbd> hidden on small screens", () => {
    const kbd = render(<ShortcutHint shortcut="goIdle" />).container.firstElementChild!;
    expect(kbd.tagName).toBe("KBD");
    expect(kbd.classList).toContain("hidden");
    expect(kbd.classList).toContain("md:inline-flex");
  });

  it("stays visible by default", () => {
    const kbd = render(<ShortcutHint shortcut="goIdle" />).container.firstElementChild!;
    expect(kbd.classList).toContain("opacity-60");
  });

  it("with onHover, hides until its group is hovered or focused", () => {
    const kbd = render(<ShortcutHint shortcut="switchPage" keyLabel="1" onHover />).container
      .firstElementChild!;
    expect(kbd.classList).toContain("opacity-0");
    expect(kbd.classList).toContain("group-hover:opacity-70");
    expect(kbd.classList).toContain("group-focus-visible:opacity-70");
  });

  it("with onHover, shows when revealed", () => {
    const kbd = render(<ShortcutHint shortcut="switchPage" keyLabel="1" onHover revealed />)
      .container.firstElementChild!;
    expect(kbd.classList).not.toContain("opacity-0");
    expect(kbd.classList).toContain("opacity-70");
  });
});
