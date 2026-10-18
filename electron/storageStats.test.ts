import { describe, expect, it, vi } from "vitest";
import { getStorageStats } from "./storageStats";

const data = vi.hoisted(() => ({
  videos: [{ fileSize: 300 }, { fileSize: 700 }],
  audio: [{ fileSize: 50 }],
  images: [] as { fileSize: number }[],
  transfers: [
    { fileSize: 40, addedToVideo: true },
    { fileSize: 2, addedToImage: true },
    { fileSize: 8 },
  ],
}));
vi.mock("./videoLibrary", () => ({ getVideoLibrary: () => ({ getAll: () => data.videos }) }));
vi.mock("./audioLibrary", () => ({ getAudioLibrary: () => ({ getAll: () => data.audio }) }));
vi.mock("./imageLibrary", () => ({ getImageLibrary: () => ({ getAll: () => data.images }) }));
vi.mock("./transferManager", () => ({ getTransferManager: () => ({ getAll: () => data.transfers }) }));

describe("getStorageStats", () => {
  it("adds up each library and Transfers, picking out the spare copies", () => {
    expect(getStorageStats()).toEqual({
      videos: { count: 2, bytes: 1000 },
      audio: { count: 1, bytes: 50 },
      images: { count: 0, bytes: 0 },
      transfers: { count: 3, bytes: 50 },
      spareTransfers: { count: 2, bytes: 42 },
    });
  });
});
