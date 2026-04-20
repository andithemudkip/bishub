export type VideoSource = "youtube" | "local" | "upload";

// Fine-grained phase of a yt-dlp download. Progress percentage is only
// populated during "downloading"; the other stages give the UI something
// to say while yt-dlp is warming up or post-processing.
export type DownloadStage =
  | "preparing"
  | "fetching"
  | "downloading"
  | "extracting"
  | "merging";

export interface VideoItem {
  id: string;
  name: string;
  filename: string;
  path: string;
  thumbnailPath: string | null;
  dateAdded: number;
  duration: number | null;
  source: VideoSource;
  sourceUrl?: string;
  fileSize: number;
}

export interface DownloadProgress {
  id: string;
  url: string;
  status: "pending" | "downloading" | "processing" | "complete" | "error";
  stage?: DownloadStage;
  progress: number;
  speed?: string;
  eta?: string;
  error?: string;
  filename?: string;
  videoId?: string;
}

export interface UploadProgress {
  id: string;
  filename: string;
  status: "uploading" | "processing" | "complete" | "error";
  progress: number;
  error?: string;
  videoId?: string;
}

export interface VideoLibraryState {
  videos: VideoItem[];
  isLoading: boolean;
}
