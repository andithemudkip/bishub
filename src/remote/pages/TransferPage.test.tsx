import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_SETTINGS } from "../../shared/types";
import type { TransferItem } from "../../shared/transfer.types";
import TransferPage from "./TransferPage";

const api = vi.hoisted(() => ({
  transfers: [] as TransferItem[],
  uploads: [],
  isElectron: true,
  uploadFile: vi.fn(),
  deleteTransfer: vi.fn(async () => true),
  moveToLibrary: vi.fn(async () => true),
}));
vi.mock("../useTransfers", () => ({ useTransfers: () => api }));

const transfer = (overrides: Partial<TransferItem>): TransferItem => ({
  id: "t1",
  name: "Predica",
  filename: "Predica.mp4",
  path: "/transfers/Predica.mp4",
  dateAdded: new Date(2026, 9, 18).getTime(),
  fileSize: 1024,
  extension: ".mp4",
  ...overrides,
});

const settings = { ...DEFAULT_SETTINGS, language: "en" as const };

describe("TransferPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.transfers = [];
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers to move media into the one library it belongs to", () => {
    api.transfers = [
      transfer({}),
      transfer({ id: "t2", name: "Program", filename: "Program.pdf", extension: ".pdf" }),
    ];
    render(<TransferPage settings={settings} onOpenLibrary={vi.fn()} />);

    expect(screen.getAllByRole("button", { name: /^Move to/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Move to Video library" })).toBeTruthy();
  });

  it("moves the file and says where it went, opening that library on tap", async () => {
    vi.useFakeTimers();
    api.transfers = [transfer({ extension: ".jpg", filename: "Predica.jpg" })];
    const onOpenLibrary = vi.fn();
    render(<TransferPage settings={settings} onOpenLibrary={onOpenLibrary} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Move to Images library" }));
    });
    expect(api.moveToLibrary).toHaveBeenCalledWith("t1", "image");

    const toast = screen.getByText("Moved to Images library").closest("button")!;
    act(() => vi.advanceTimersByTime(300));
    fireEvent.click(toast);
    expect(onOpenLibrary).toHaveBeenCalledWith("image");
  });

  it("says so when a move fails, and lets it be tried again", async () => {
    api.moveToLibrary.mockResolvedValueOnce(false);
    api.transfers = [transfer({})];
    render(<TransferPage settings={settings} onOpenLibrary={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Move to Video library" }));
    });
    expect(screen.getByText("Couldn't move “Predica”")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Move to Video library" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("asks inline before deleting, saying the file leaves this computer", () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    api.transfers = [transfer({})];
    render(<TransferPage settings={settings} onOpenLibrary={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(api.deleteTransfer).not.toHaveBeenCalled();
    expect(screen.getByText(/It will be removed from this computer/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Move to Video library" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(api.deleteTransfer).toHaveBeenCalledWith("t1");
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("marks a spare copy from an older version, and says deleting it keeps the library's", () => {
    api.transfers = [transfer({ addedToVideo: true })];
    render(<TransferPage settings={settings} onOpenLibrary={vi.fn()} />);

    expect(screen.getByText("Already in Video library")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Move to/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText(/The one in your Video library stays/)).toBeTruthy();
  });
});
