import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { StorageStats } from "../../shared/storage.types";
import { useStorageStats } from "./useStorageStats";

const stats = (transferBytes: number): StorageStats => ({
  videos: { count: 1, bytes: 100 },
  audio: { count: 0, bytes: 0 },
  images: { count: 0, bytes: 0 },
  transfers: { count: 1, bytes: transferBytes },
  spareTransfers: { count: 1, bytes: transferBytes },
});

// The main computer's answers, as the Electron remote gets them.
function stubElectron() {
  let onTransfers: () => void = () => {};
  const api = {
    getStorageStats: vi.fn(async () => stats(40)),
    deleteSpareTransfers: vi.fn(async () => stats(0)),
    onTransfersUpdate: vi.fn((callback: () => void) => {
      onTransfers = callback;
      return () => {};
    }),
  };
  window.electronAPI = api as unknown as NonNullable<Window["electronAPI"]>;
  return { api, transfersChanged: () => onTransfers() };
}

describe("useStorageStats", () => {
  afterEach(() => {
    delete window.electronAPI;
  });

  it("asks the main computer, and asks again when transfers change", async () => {
    const { api, transfersChanged } = stubElectron();
    const { result } = renderHook(() => useStorageStats());
    expect(result.current.stats).toBeNull();
    await waitFor(() => expect(result.current.stats?.transfers.bytes).toBe(40));

    api.getStorageStats.mockResolvedValueOnce(stats(5));
    await act(async () => transfersChanged());
    expect(result.current.stats?.transfers.bytes).toBe(5);
  });

  it("shows the sizes left after deleting the spare copies", async () => {
    const { api } = stubElectron();
    const { result } = renderHook(() => useStorageStats());
    await waitFor(() => expect(result.current.stats).not.toBeNull());

    await act(() => result.current.deleteSpareTransfers());
    expect(api.deleteSpareTransfers).toHaveBeenCalledOnce();
    expect(result.current.stats?.spareTransfers.bytes).toBe(0);
  });
});
