import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type {
  ImageItem,
  Slideshow,
  ImageUploadProgress,
} from "../shared/imageLibrary.types";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "../shared/types";
import { getSecurityKeyFromURL, getApiUrl, updateProgressList } from "../shared/utils";

type SocketType = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface ImageLibraryAPI {
  images: ImageItem[];
  slideshows: Slideshow[];
  uploads: ImageUploadProgress[];
  isElectron: boolean;
  // Image CRUD
  addLocalImage: () => Promise<ImageItem | null>;
  addLocalImages: () => Promise<ImageItem[]>;
  deleteImage: (imageId: string) => Promise<boolean>;
  renameImage: (imageId: string, newName: string) => void;
  uploadImage: (file: File) => Promise<void>;
  // Slideshow CRUD
  createSlideshow: (name: string, imageIds: string[]) => void;
  updateSlideshow: (
    slideshowId: string,
    updates: Partial<Omit<Slideshow, "id" | "createdAt">>
  ) => void;
  deleteSlideshow: (slideshowId: string) => void;
  addImagesToSlideshow: (slideshowId: string, imageIds: string[]) => void;
  removeImageFromSlideshow: (imageId: string) => void;
  reorderSlideshowImages: (
    slideshowId: string,
    orderedImageIds: string[]
  ) => void;
  // Presentation
  presentImage: (image: ImageItem) => void;
  presentSlideshow: (slideshowId: string) => void;
}

export function useImageLibrary(
  loadImage: (src: string, imageId: string) => void,
  loadSlideshow: (slideshowId: string) => void
): ImageLibraryAPI {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [slideshows, setSlideshows] = useState<Slideshow[]>([]);
  const [uploads, setUploads] = useState<ImageUploadProgress[]>([]);

  const socketRef = useRef<SocketType | null>(null);
  const isElectron = !!window.electronAPI;

  useEffect(() => {
    if (isElectron) {
      window.electronAPI!.getImageLibrary().then(setImages);
      window.electronAPI!.getSlideshows().then(setSlideshows);

      const unsubLibrary = window.electronAPI!.onImageLibraryUpdate(setImages);
      const unsubSlideshows =
        window.electronAPI!.onSlideshowsUpdate(setSlideshows);
      const unsubUpload = window.electronAPI!.onImageUploadProgress(
        (progress: ImageUploadProgress) => {
          setUploads((prev) => updateProgressList(prev, progress, setUploads));
        }
      );

      return () => {
        unsubLibrary();
        unsubSlideshows();
        unsubUpload();
      };
    } else {
      const securityKey = getSecurityKeyFromURL();
      const socket: SocketType = io({
        auth: { key: securityKey },
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("getImageLibrary");
        socket.emit("getSlideshows");
      });

      socket.on("imageLibrary", setImages);
      socket.on("slideshows", setSlideshows);
      socket.on("imageUploadProgress", (progress) => {
        setUploads((prev) => updateProgressList(prev, progress, setUploads));
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [isElectron]);

  const api: ImageLibraryAPI = {
    images,
    slideshows,
    uploads,
    isElectron,

    addLocalImage: useCallback(async () => {
      if (isElectron) {
        return window.electronAPI!.addLocalImage();
      }
      return null;
    }, [isElectron]),

    addLocalImages: useCallback(async () => {
      if (isElectron) {
        return window.electronAPI!.addLocalImages();
      }
      return [];
    }, [isElectron]),

    deleteImage: useCallback(
      async (imageId) => {
        if (isElectron) {
          return window.electronAPI!.deleteImage(imageId);
        }
        socketRef.current?.emit("deleteImage", imageId);
        return true;
      },
      [isElectron]
    ),

    renameImage: useCallback(
      (imageId, newName) => {
        if (isElectron) {
          window.electronAPI!.renameImage(imageId, newName);
        } else {
          socketRef.current?.emit("renameImage", imageId, newName);
        }
      },
      [isElectron]
    ),

    uploadImage: useCallback(async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("name", file.name.replace(/\.[^.]+$/, ""));

      await fetch(getApiUrl("/api/images/upload"), {
        method: "POST",
        body: formData,
      });
    }, []),

    createSlideshow: useCallback(
      (name, imageIds) => {
        if (isElectron) {
          window.electronAPI!.createSlideshow(name, imageIds);
        } else {
          socketRef.current?.emit("createSlideshow", name, imageIds);
        }
      },
      [isElectron]
    ),

    updateSlideshow: useCallback(
      (slideshowId, updates) => {
        if (isElectron) {
          window.electronAPI!.updateSlideshow(slideshowId, updates);
        } else {
          socketRef.current?.emit("updateSlideshow", slideshowId, updates);
        }
      },
      [isElectron]
    ),

    deleteSlideshow: useCallback(
      (slideshowId) => {
        if (isElectron) {
          window.electronAPI!.deleteSlideshow(slideshowId);
        } else {
          socketRef.current?.emit("deleteSlideshow", slideshowId);
        }
      },
      [isElectron]
    ),

    addImagesToSlideshow: useCallback(
      (slideshowId, imageIds) => {
        if (isElectron) {
          window.electronAPI!.addImagesToSlideshow(slideshowId, imageIds);
        } else {
          socketRef.current?.emit(
            "addImagesToSlideshow",
            slideshowId,
            imageIds
          );
        }
      },
      [isElectron]
    ),

    removeImageFromSlideshow: useCallback(
      (imageId) => {
        if (isElectron) {
          window.electronAPI!.removeImageFromSlideshow(imageId);
        } else {
          socketRef.current?.emit("removeImageFromSlideshow", imageId);
        }
      },
      [isElectron]
    ),

    reorderSlideshowImages: useCallback(
      (slideshowId, orderedImageIds) => {
        if (isElectron) {
          window.electronAPI!.reorderSlideshowImages(
            slideshowId,
            orderedImageIds
          );
        } else {
          socketRef.current?.emit(
            "reorderSlideshowImages",
            slideshowId,
            orderedImageIds
          );
        }
      },
      [isElectron]
    ),

    presentImage: useCallback(
      (image: ImageItem) => {
        loadImage(image.path, image.id);
      },
      [loadImage]
    ),

    presentSlideshow: useCallback(
      (slideshowId: string) => {
        loadSlideshow(slideshowId);
      },
      [loadSlideshow]
    ),
  };

  return api;
}
