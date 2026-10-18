import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { getTranslations } from "../../shared/i18n";
import { HymnModeSwitch } from "./HymnModeSwitch";

const t = getTranslations("en");

describe("HymnModeSwitch", () => {
  it("lights the current mode and switches to the other one", () => {
    const onSelect = vi.fn();
    render(<HymnModeSwitch current="static" audioMode="synced" onSelect={onSelect} t={t} />);

    const text = screen.getByRole("button", { name: "Text only" });
    const karaoke = screen.getByRole("button", { name: "Karaoke" });
    expect(text.getAttribute("aria-pressed")).toBe("true");
    expect(karaoke.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(karaoke);
    expect(onSelect).toHaveBeenCalledWith("synced");
  });

  it("offers the instrumental when the hymn has no synced lyrics", () => {
    const onSelect = vi.fn();
    render(<HymnModeSwitch current="instrumental" audioMode="instrumental" onSelect={onSelect} t={t} />);

    expect(screen.queryByRole("button", { name: "Karaoke" })).toBeNull();
    expect(screen.getByRole("button", { name: "Instrumental" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Text only" }));
    expect(onSelect).toHaveBeenCalledWith("static");
  });

  it("does nothing when the live mode is clicked again", () => {
    // Reloading would restart the hymn mid-service.
    const onSelect = vi.fn();
    render(<HymnModeSwitch current="synced" audioMode="synced" onSelect={onSelect} t={t} />);

    fireEvent.click(screen.getByRole("button", { name: "Karaoke" }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
