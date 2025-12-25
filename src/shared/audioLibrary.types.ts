export type AudioSource = "local" | "upload";

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
