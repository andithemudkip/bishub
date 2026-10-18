import { useCallback, useEffect, useState } from "react";
import { getSocket, listen, onConnected } from "../socket";
import { getApiUrl } from "../../shared/utils";
import type { ImageItem } from "../../shared/imageLibrary.types";

/**
 * The Image library's images, newest first and kept current, for pickers
 * outside the library page (the idle wallpaper). `upload` sends a file from
 * this device into the library and resolves to the new image, or null.
 */
export function useLibraryImages() {
  const [images, setImages] = useState<ImageItem[]>([]);

  useEffect(() => {
    const api = window.electronAPI;
    if (api) {
      let active = true;
      api.getImageLibrary().then((next) => {
        if (active) setImages(next);
      });
      const off = api.onImageLibraryUpdate(setImages);
      return () => {
        active = false;
        off();
      };
    }

    const socket = getSocket();
    if (!socket) return;
    const off = listen(socket, { imageLibrary: setImages });
    const offConnected = onConnected(socket, () => socket.emit("getImageLibrary"));
    return () => {
      off();
      offConnected();
    };
  }, []);

  const upload = useCallback(async (file: File): Promise<ImageItem | null> => {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("name", file.name.replace(/\.[^.]+$/, ""));
    try {
      const response = await fetch(getApiUrl("/api/images/upload"), {
        method: "POST",
        body: formData,
      });
      // A refused upload answers `{ error }` (or isn't JSON at all): no image either way.
      const body = (await response.json()) as { image?: ImageItem };
      return body.image ?? null;
    } catch {
      return null;
    }
  }, []);

  const sorted = [...images].sort((a, b) => b.dateAdded - a.dateAdded);
  return { images: sorted, upload };
}

/** A small picture of a library image: its thumbnail, or the file while the thumbnail is still being made. */
export function libraryImageThumbnailUrl(image: ImageItem): string {
  const id = encodeURIComponent(image.id);
  return getApiUrl(image.thumbnailPath ? `/api/images/thumbnail/${id}` : `/api/images/file/${id}`);
}
