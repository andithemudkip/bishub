export interface TransferItem {
  id: string;
  name: string;
  filename: string;
  path: string;
  dateAdded: number;
  fileSize: number;
  extension: string;
  addedToVideo?: boolean;
  addedToAudio?: boolean;
}

export interface TransferUploadProgress {
  id: string;
  filename: string;
  status: "uploading" | "complete" | "error";
  progress: number;
  error?: string;
}
