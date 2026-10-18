import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ImageItem } from "../../shared/imageLibrary.types";
import { useLibraryImages } from "./useLibraryImages";

const image = (id: string, dateAdded: number): ImageItem => ({
  id,
  name: id,
  filename: `${id}.jpg`,
  path: `/library/${id}.jpg`,
  thumbnailPath: null,
  dateAdded,
  fileSize: 1,
  source: "local",
  slideshowId: null,
  slideshowOrder: null,
});

function stubElectron(images: ImageItem[]) {
  let onUpdate: (images: ImageItem[]) => void = () => {};
  window.electronAPI = {
    getImageLibrary: vi.fn(async () => images),
    onImageLibraryUpdate: vi.fn((callback: (images: ImageItem[]) => void) => {
      onUpdate = callback;
      return () => {};
    }),
  } as unknown as NonNullable<Window["electronAPI"]>;
  return { update: (next: ImageItem[]) => act(() => onUpdate(next)) };
}

describe("useLibraryImages", () => {
  afterEach(() => {
    delete window.electronAPI;
    vi.unstubAllGlobals();
  });

  it("lists the library newest first and follows changes", async () => {
    const { update } = stubElectron([image("old", 1), image("new", 2)]);
    const { result } = renderHook(() => useLibraryImages());
    await waitFor(() => expect(result.current.images.map((i) => i.id)).toEqual(["new", "old"]));

    update([image("old", 1)]);
    expect(result.current.images.map((i) => i.id)).toEqual(["old"]);
  });

  it("uploads into the library and returns the new image", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ image: image("u", 3) })));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useLibraryImages());

    const added = await result.current.upload(new File(["x"], "Altar.jpg"));
    expect(added?.id).toBe("u");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/images/upload");
    expect((init.body as FormData).get("name")).toBe("Altar");
  });

  it("returns null when the upload is refused or the network fails", async () => {
    const { result } = renderHook(() => useLibraryImages());
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    expect(await result.current.upload(new File(["x"], "a.jpg"))).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    expect(await result.current.upload(new File(["x"], "a.jpg"))).toBeNull();
  });
});
