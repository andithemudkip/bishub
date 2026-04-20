export type AudioSource = "local" | "upload" | "youtube";

export interface AudioItem {
  id: string;
  name: string;
  filename: string;
  path: string;
  dateAdded: number;
  duration: number | null;
  source: AudioSource;
  fileSize: number;
}

export interface AudioUploadProgress {
  id: string;
  filename: string;
  status: "uploading" | "processing" | "complete" | "error";
  progress: number;
  error?: string;
  audioId?: string;
}

export interface AudioDownloadProgress {
  id: string;
  url: string;
  status: "pending" | "downloading" | "processing" | "complete" | "error";
  stage?: import("./videoLibrary.types").DownloadStage;
  progress: number;
  speed?: string;
  eta?: string;
  error?: string;
  filename?: string;
  audioId?: string;
}

export interface AudioLibraryState {
  audios: AudioItem[];
  isLoading: boolean;
}

export interface DirectoryImportProgress {
  id: string;
  directory: string;
  current: number;
  total: number;
  currentFile: string;
  completed: AudioItem[];
  errors: { file: string; error: string }[];
  status: "scanning" | "importing" | "complete" | "error";
}
