import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_SETTINGS, DEFAULT_STATE } from "../../shared/types";
import { sendPageIntent } from "../hooks/usePageIntent";
import SettingsPage from "./SettingsPage";
import type { SettingsPageProps } from "./settings/types";

function props(overrides: Partial<SettingsPageProps> = {}): SettingsPageProps {
  return {
    hymnals: [],
    monitors: [],
    settings: { ...DEFAULT_SETTINGS, language: "en" },
    idleState: DEFAULT_STATE.idle,
    onSetLanguage: vi.fn(),
    onSetBibleTranslation: vi.fn(),
    onSetHymnal: vi.fn(),
    bibleDownloadStatus: null,
    downloadedTranslations: [],
    onSetWallpaper: vi.fn(async () => null),
    onSetClockFontSize: vi.fn(),
    onSetClockPosition: vi.fn(),
    onSetAudioWidgetPosition: vi.fn(),
    onSetSyncedLyrics: vi.fn(),
    onSetInstrumentals: vi.fn(),
    onSetChromeSize: vi.fn(),
    onSetSlideBackground: vi.fn(),
    onSetBibleBackground: vi.fn(),
    onSetDisplayMonitor: vi.fn(),
    appVersion: "1.2.3",
    updateStatus: { state: "idle" },
    onCheckForUpdates: vi.fn(),
    mp3CacheStats: { count: 2, sizeBytes: 0, availableCount: 10 },
    mp3Downloads: [],
    onDownloadAllHymnMP3s: vi.fn(),
    onCancelAllHymnMP3Downloads: vi.fn(),
    onClearHymnMP3Cache: vi.fn(),
    devices: [],
    connectedDeviceIds: [],
    onRenameDevice: vi.fn(),
    onRevokeDevice: vi.fn(),
    ...overrides,
  };
}

const openHeading = () => screen.getByRole("heading", { level: 2 }).textContent;
const sectionButton = (name: string) =>
  screen.getAllByRole("button").find((b) => b.textContent?.startsWith(name))!;

describe("SettingsPage", () => {
  it("opens on General the first time", () => {
    render(<SettingsPage {...props()} />);
    expect(openHeading()).toBe("General");
  });

  it("switches section from the list and remembers it for next time", () => {
    const { unmount } = render(<SettingsPage {...props()} />);
    fireEvent.click(sectionButton("Projector screen"));
    expect(openHeading()).toBe("Projector screen");

    unmount();
    render(<SettingsPage {...props()} />);
    expect(openHeading()).toBe("Projector screen");
  });

  it("on phones, shows the list first, drills into a section and comes back", () => {
    const { container } = render(<SettingsPage {...props()} />);
    const nav = container.querySelector("nav")!;
    const content = nav.nextElementSibling!;
    // Below lg only one of the two is shown; `hidden lg:block` hides the other.
    expect(content.className).toContain("hidden");
    expect(nav.className).not.toContain("hidden");

    fireEvent.click(sectionButton("Idle screen"));
    expect(content.className).not.toContain("hidden");
    expect(nav.className).toContain("hidden");

    fireEvent.click(screen.getByRole("button", { name: "All settings" }));
    expect(content.className).toContain("hidden");
    expect(nav.className).not.toContain("hidden");
  });

  it("searches settings and jumps to the one picked, highlighted", () => {
    const { container } = render(<SettingsPage {...props()} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "clock" } });
    fireEvent.click(sectionButton("Clock size"));

    expect(openHeading()).toBe("Idle screen");
    expect(screen.getByRole("searchbox")).toHaveProperty("value", "");
    expect(container.querySelector('[data-setting="clockFontSize"]')!.className).toContain(
      "bg-blue-500/15",
    );
  });

  it("scrolls to the picked row once, and not again when its highlight fades", () => {
    vi.useFakeTimers();
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const { container } = render(<SettingsPage {...props()} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "clock" } });
    fireEvent.click(sectionButton("Clock size"));
    expect(scroll).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(2000));
    expect(container.querySelector('[data-setting="clockFontSize"]')!.className).not.toContain(
      "bg-blue-500/15",
    );
    expect(scroll).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("opens the first result on Enter", () => {
    render(<SettingsPage {...props()} />);
    const search = screen.getByRole("searchbox");
    fireEvent.change(search, { target: { value: "synced lyrics" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(openHeading()).toBe("Bible & hymns");
  });

  it("says so when nothing matches", () => {
    render(<SettingsPage {...props()} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    expect(screen.getByText("No settings match “zzz”")).toBeTruthy();
  });

  it("opens the section another page asked for, whether sent before or after mounting", () => {
    sendPageIntent({ page: "settings", section: "storage", settingId: "instrumentalDownloads" });
    render(<SettingsPage {...props()} />);
    expect(openHeading()).toBe("Downloads");

    act(() => sendPageIntent({ page: "settings", section: "display" }));
    expect(openHeading()).toBe("Projector screen");
  });

  it("hides the phone pairing section on web remotes", () => {
    render(<SettingsPage {...props()} />);
    expect(screen.queryByText("Phones & tablets")).toBeNull();
  });

  it("previews a hymn and a Bible slide in the display section", () => {
    render(<SettingsPage {...props()} />);
    fireEvent.click(sectionButton("Projector screen"));
    const preview = screen.getByRole("region", { name: "Preview" });
    expect([...preview.querySelectorAll("figcaption")].map((f) => f.textContent)).toEqual([
      "Hymns",
      "Bible",
    ]);
  });

  it("links from hymn music to its downloads", () => {
    render(<SettingsPage {...props()} />);
    fireEvent.click(sectionButton("Bible & hymns"));
    fireEvent.click(screen.getByRole("button", { name: "Manage downloads" }));
    expect(openHeading()).toBe("Downloads");
  });
});

describe("Downloads section", () => {
  const openDownloads = (p: SettingsPageProps) => {
    render(<SettingsPage {...p} />);
    fireEvent.click(sectionButton("Downloads"));
  };

  it("asks inline before downloading every instrumental", () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const p = props();
    openDownloads(p);

    fireEvent.click(screen.getByRole("button", { name: "Download all" }));
    expect(p.onDownloadAllHymnMP3s).not.toHaveBeenCalled();
    expect(screen.getByText(/Download 32.0 MB\?/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Download all" }));
    expect(p.onDownloadAllHymnMP3s).toHaveBeenCalledOnce();
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("lets a clear be cancelled", () => {
    const p = props();
    openDownloads(p);
    fireEvent.click(screen.getByRole("button", { name: "Clear cache" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(p.onClearHymnMP3Cache).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Download all" })).toBeTruthy();
  });

  it("explains when the hymn book has no music to download", () => {
    openDownloads(props({ mp3CacheStats: { count: 0, sizeBytes: 0, availableCount: 0 } }));
    expect(screen.getByText("There's no hymn music to download for this hymn book.")).toBeTruthy();
  });
});
