import { app } from "electron";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import Store from "electron-store";
import type {
  ImageItem,
  ImageSource,
  Slideshow,
  ImageUploadProgress,
} from "../src/shared/imageLibrary.types";
import { getFfmpegPath } from "./utils";

interface ImageLibrarySchema {
  images: ImageItem[];
  slideshows: Slideshow[];
  version: number;
}

type LibraryChangeCallback = (images: ImageItem[]) => void;
type SlideshowsChangeCallback = (slideshows: Slideshow[]) => void;
type UploadProgressCallback = (progress: ImageUploadProgress) => void;

export class ImageLibraryManager {
  private store: Store<ImageLibrarySchema>;
  private imagesDir: string;
  private thumbnailsDir: string;
  private cachedImages: ImageItem[] | null = null;
  private changeListeners: LibraryChangeCallback[] = [];
  private slideshowsChangeListeners: SlideshowsChangeCallback[] = [];
  private uploadProgressListeners: UploadProgressCallback[] = [];

  constructor() {
    this.store = new Store<ImageLibrarySchema>({
      name: "image-library",
      defaults: {
        images: [],
        slideshows: [],
        version: 1,
      },
    });

    const userDataPath = app.getPath("userData");
    this.imagesDir = path.join(userDataPath, "images");
    this.thumbnailsDir = path.join(userDataPath, "image-thumbnails");

    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.imagesDir)) {
      fs.mkdirSync(this.imagesDir, { recursive: true });
    }
    if (!fs.existsSync(this.thumbnailsDir)) {
      fs.mkdirSync(this.thumbnailsDir, { recursive: true });
    }
  }

  getImagesDir(): string {
    return this.imagesDir;
  }

  // Event listeners
  onLibraryChange(callback: LibraryChangeCallback): () => void {
    this.changeListeners.push(callback);
    return () => {
      this.changeListeners = this.changeListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  onSlideshowsChange(callback: SlideshowsChangeCallback): () => void {
    this.slideshowsChangeListeners.push(callback);
    return () => {
      this.slideshowsChangeListeners =
        this.slideshowsChangeListeners.filter((cb) => cb !== callback);
    };
  }

  onUploadProgress(callback: UploadProgressCallback): () => void {
    this.uploadProgressListeners.push(callback);
    return () => {
      this.uploadProgressListeners = this.uploadProgressListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  private notifyLibraryChange(): void {
    const images = this.getAll();
    this.changeListeners.forEach((cb) => cb(images));
  }

  private notifySlideshowsChange(): void {
    const slideshows = this.getAllSlideshows();
    this.slideshowsChangeListeners.forEach((cb) => cb(slideshows));
  }

  notifyUploadProgress(progress: ImageUploadProgress): void {
    this.uploadProgressListeners.forEach((cb) => cb(progress));
  }

  // Image CRUD
  private getImages(): ImageItem[] {
    if (!this.cachedImages) {
      this.cachedImages = this.store.get("images", []);
    }
    return this.cachedImages;
  }

  private setImages(images: ImageItem[]): void {
    this.cachedImages = images;
    this.store.set("images", images);
  }

  getAll(): ImageItem[] {
    return [...this.getImages()].sort((a, b) => b.dateAdded - a.dateAdded);
  }

  getById(id: string): ImageItem | null {
    return this.getImages().find((i) => i.id === id) || null;
  }

  async addImage(
    sourcePath: string,
    source: ImageSource,
    options?: {
      name?: string;
      copyToLibrary?: boolean;
    }
  ): Promise<ImageItem> {
    const { name, copyToLibrary = true } = options || {};

    let finalPath = sourcePath;
    let filename = path.basename(sourcePath);

    if (copyToLibrary && !sourcePath.startsWith(this.imagesDir)) {
      const ext = path.extname(filename);
      const baseName = path.basename(filename, ext);
      const uniqueFilename = `${baseName}-${Date.now()}${ext}`;
      finalPath = path.join(this.imagesDir, uniqueFilename);
      filename = uniqueFilename;

      await fs.promises.copyFile(sourcePath, finalPath);
    }

    const stats = await fs.promises.stat(finalPath);
    const id = uuidv4();
    const displayName =
      name || path.basename(filename, path.extname(filename));

    const image: ImageItem = {
      id,
      name: displayName,
      filename,
      path: finalPath,
      thumbnailPath: null,
      dateAdded: Date.now(),
      fileSize: stats.size,
      source,
      slideshowId: null,
      slideshowOrder: null,
    };

    const images = this.getImages();
    images.push(image);
    this.setImages(images);

    this.generateThumbnail(image).catch((err) => {
      console.error("Failed to generate image thumbnail:", err);
    });

    this.notifyLibraryChange();
    return image;
  }

  async deleteImage(id: string): Promise<boolean> {
    const images = this.getImages();
    const image = images.find((i) => i.id === id);
    if (!image) return false;

    if (fs.existsSync(image.path)) {
      await fs.promises.unlink(image.path);
    }

    if (image.thumbnailPath && fs.existsSync(image.thumbnailPath)) {
      await fs.promises.unlink(image.thumbnailPath);
    }

    const filtered = images.filter((i) => i.id !== id);

    // Re-index slideshow order if image was in a slideshow
    if (image.slideshowId) {
      this.reindexSlideshowOrder(filtered, image.slideshowId);
    }

    this.setImages(filtered);
    this.notifyLibraryChange();
    if (image.slideshowId) {
      this.notifySlideshowsChange();
    }
    return true;
  }

  renameImage(id: string, newName: string): ImageItem | null {
    const images = this.getImages();
    const index = images.findIndex((i) => i.id === id);
    if (index === -1) return null;

    images[index].name = newName;
    this.setImages(images);
    this.notifyLibraryChange();
    return images[index];
  }

  // Slideshow CRUD
  getAllSlideshows(): Slideshow[] {
    return this.store.get("slideshows", []);
  }

  getSlideshowById(id: string): Slideshow | null {
    const slideshows = this.store.get("slideshows", []);
    return slideshows.find((s) => s.id === id) || null;
  }

  getSlideshowImages(slideshowId: string): ImageItem[] {
    const images = this.getImages();
    return images
      .filter((i) => i.slideshowId === slideshowId)
      .sort((a, b) => (a.slideshowOrder ?? 0) - (b.slideshowOrder ?? 0));
  }

  getSlideshowPresentationData(slideshowId: string) {
    const slideshow = this.getSlideshowById(slideshowId);
    if (!slideshow) return null;
    const images = this.getSlideshowImages(slideshowId);
    if (images.length === 0) return null;
    return {
      images: images.map((img) => ({ src: img.path, imageId: img.id })),
      slideshowId,
      settings: {
        autoAdvance: slideshow.autoAdvance,
        autoAdvanceInterval: slideshow.autoAdvanceInterval,
        loop: slideshow.loop,
        fit: slideshow.fit as "fill" | "fit",
      },
    };
  }

  createSlideshow(name: string, imageIds: string[]): Slideshow | null {
    const slideshow: Slideshow = {
      id: uuidv4(),
      name,
      createdAt: Date.now(),
      fit: "fill",
      autoAdvance: false,
      autoAdvanceInterval: 5000,
      loop: false,
    };

    const slideshows = this.store.get("slideshows", []);
    slideshows.push(slideshow);
    this.store.set("slideshows", slideshows);

    // Assign images to slideshow
    const images = this.getImages();
    imageIds.forEach((imageId, order) => {
      const index = images.findIndex((i) => i.id === imageId);
      if (index !== -1) {
        images[index].slideshowId = slideshow.id;
        images[index].slideshowOrder = order;
      }
    });
    this.setImages(images);

    this.notifyLibraryChange();
    this.notifySlideshowsChange();
    return slideshow;
  }

  updateSlideshow(
    id: string,
    updates: Partial<Omit<Slideshow, "id" | "createdAt">>
  ): Slideshow | null {
    const slideshows = this.store.get("slideshows", []);
    const index = slideshows.findIndex((s) => s.id === id);
    if (index === -1) return null;

    slideshows[index] = { ...slideshows[index], ...updates };
    this.store.set("slideshows", slideshows);
    this.notifySlideshowsChange();
    return slideshows[index];
  }

  deleteSlideshow(id: string): boolean {
    const slideshows = this.store.get("slideshows", []);
    const filtered = slideshows.filter((s) => s.id !== id);
    if (filtered.length === slideshows.length) return false;

    this.store.set("slideshows", filtered);

    // Ungroup all images from this slideshow
    const images = this.getImages();
    for (const image of images) {
      if (image.slideshowId === id) {
        image.slideshowId = null;
        image.slideshowOrder = null;
      }
    }
    this.setImages(images);

    this.notifyLibraryChange();
    this.notifySlideshowsChange();
    return true;
  }

  addImagesToSlideshow(slideshowId: string, imageIds: string[]): void {
    const images = this.getImages();
    const currentMax = images
      .filter((i) => i.slideshowId === slideshowId)
      .reduce((max, i) => Math.max(max, i.slideshowOrder ?? -1), -1);

    imageIds.forEach((imageId, i) => {
      const index = images.findIndex((img) => img.id === imageId);
      if (index !== -1) {
        images[index].slideshowId = slideshowId;
        images[index].slideshowOrder = currentMax + 1 + i;
      }
    });

    this.setImages(images);
    this.notifyLibraryChange();
    this.notifySlideshowsChange();
  }

  removeImageFromSlideshow(imageId: string): void {
    const images = this.getImages();
    const index = images.findIndex((i) => i.id === imageId);
    if (index === -1) return;

    const slideshowId = images[index].slideshowId;
    images[index].slideshowId = null;
    images[index].slideshowOrder = null;

    if (slideshowId) {
      this.reindexSlideshowOrder(images, slideshowId);
    }

    this.setImages(images);
    this.notifyLibraryChange();
    this.notifySlideshowsChange();
  }

  reorderSlideshowImages(
    slideshowId: string,
    orderedImageIds: string[]
  ): void {
    const images = this.getImages();
    orderedImageIds.forEach((imageId, order) => {
      const index = images.findIndex((i) => i.id === imageId);
      if (index !== -1 && images[index].slideshowId === slideshowId) {
        images[index].slideshowOrder = order;
      }
    });
    this.setImages(images);
    this.notifyLibraryChange();
  }

  private reindexSlideshowOrder(
    images: ImageItem[],
    slideshowId: string
  ): void {
    const indexById = new Map(images.map((img, i) => [img.id, i]));
    const slideshowImages = images
      .filter((i) => i.slideshowId === slideshowId)
      .sort((a, b) => (a.slideshowOrder ?? 0) - (b.slideshowOrder ?? 0));

    slideshowImages.forEach((img, i) => {
      const index = indexById.get(img.id);
      if (index !== undefined) {
        images[index].slideshowOrder = i;
      }
    });
  }

  // Thumbnail generation
  private async generateThumbnail(image: ImageItem): Promise<void> {
    const ffmpegPath = getFfmpegPath();
    if (!ffmpegPath) {
      console.warn("Cannot generate thumbnail: ffmpeg not available");
      return;
    }

    const thumbnailFilename = `${image.id}.jpg`;
    const thumbnailPath = path.join(this.thumbnailsDir, thumbnailFilename);

    return new Promise((resolve, reject) => {
      const cmd = `"${ffmpegPath}" -y -i "${image.path}" -vframes 1 -vf "scale=640:360:force_original_aspect_ratio=decrease" "${thumbnailPath}"`;

      exec(cmd, (error) => {
        if (error) {
          console.error("Image thumbnail generation failed:", error.message);
          reject(error);
          return;
        }

        const images = this.getImages();
        const index = images.findIndex((i) => i.id === image.id);
        if (index !== -1) {
          images[index].thumbnailPath = thumbnailPath;
          this.setImages(images);
          this.notifyLibraryChange();
        }
        resolve();
      });
    });
  }

  // Validation
  async validateLibrary(): Promise<void> {
    const images = this.getImages();
    const validImages: ImageItem[] = [];

    for (const image of images) {
      if (fs.existsSync(image.path)) {
        validImages.push(image);

        if (!image.thumbnailPath || !fs.existsSync(image.thumbnailPath)) {
          this.generateThumbnail(image).catch((err) => {
            console.error(
              "Failed to generate thumbnail for existing image:",
              err
            );
          });
        }
      } else {
        console.warn(
          `Image file missing, removing from library: ${image.path}`
        );
        if (image.thumbnailPath && fs.existsSync(image.thumbnailPath)) {
          await fs.promises.unlink(image.thumbnailPath);
        }
      }
    }

    if (validImages.length !== images.length) {
      this.setImages(validImages);
      this.notifyLibraryChange();
    }

    // Clean up slideshows with no images
    const slideshows = this.store.get("slideshows", []);
    const validSlideshows = slideshows.filter((s) =>
      validImages.some((i) => i.slideshowId === s.id)
    );
    if (validSlideshows.length !== slideshows.length) {
      this.store.set("slideshows", validSlideshows);
      this.notifySlideshowsChange();
    }
  }
}

// Singleton
let libraryInstance: ImageLibraryManager | null = null;

export function getImageLibrary(): ImageLibraryManager {
  if (!libraryInstance) {
    libraryInstance = new ImageLibraryManager();
  }
  return libraryInstance;
}
