export const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff"];
export const IMAGE_EXTENSIONS_NO_DOT = IMAGE_EXTENSIONS.map((e) => e.slice(1));

export type ImageSource = "local" | "upload";

export interface ImageItem {
  id: string;
  name: string;
  filename: string;
  path: string;
  thumbnailPath: string | null;
  dateAdded: number;
  fileSize: number;
  source: ImageSource;
  slideshowId: string | null;
  slideshowOrder: number | null;
}

export interface Slideshow {
  id: string;
  name: string;
  createdAt: number;
  fit: "fill" | "fit";
  autoAdvance: boolean;
  autoAdvanceInterval: number; // ms
  loop: boolean;
}

export interface ImageUploadProgress {
  id: string;
  filename: string;
  status: "uploading" | "processing" | "complete" | "error";
  progress: number;
  error?: string;
  imageId?: string;
}
