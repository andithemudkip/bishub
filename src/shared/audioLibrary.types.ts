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
