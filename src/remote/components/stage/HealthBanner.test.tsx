import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { getTranslations } from "../../../shared/i18n";
import { usePageIntent, type PageIntent } from "../../hooks/usePageIntent";
import { HealthBanner } from "./HealthBanner";

const t = getTranslations("en");

function SettingsSpy({ onIntent }: { onIntent: (intent: PageIntent) => void }) {
  usePageIntent("settings", onIntent);
  return null;
}

describe("HealthBanner", () => {
  it("sends a missing monitor straight to where the screen is chosen", () => {
    const onNavigate = vi.fn();
    const onIntent = vi.fn();
    render(
      <>
        <HealthBanner
          displayWindowOpen={true}
          monitorMissing={true}
          onNavigate={onNavigate}
          t={t}
        />
        <SettingsSpy onIntent={onIntent} />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose screen" }));
    expect(onNavigate).toHaveBeenCalledWith("settings");
    expect(onIntent).toHaveBeenCalledWith({
      page: "settings",
      section: "display",
      settingId: "displayMonitor",
    });
  });

  it("has no fix to offer for a closed display window", () => {
    render(
      <HealthBanner displayWindowOpen={false} monitorMissing={false} onNavigate={vi.fn()} t={t} />,
    );
    expect(screen.getByRole("alert").textContent).toBe(t.stage.displayClosed);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
