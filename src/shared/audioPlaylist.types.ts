export interface AudioPlaylist {
  id: string;
  name: string;
  audioIds: string[];
  loop: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface QueueTrack {
  audioId: string;
  src: string;
  name: string;
  duration: number | null;
}

/**
 * The live queue is always a projection of one of the two sources below
 * (a persisted playlist or the ephemeral "Up Next" list). `tracks` is a
 * snapshot taken at projection time — deliberately mirroring
 * `ImageState.slideshowImages` — so editing or deleting library items mid
 * service never disturbs what's currently on screen.
 */
export interface AudioQueueState {
  source: "playlist" | "ephemeral" | null;
  playlistId: string | null; // set when source === "playlist"
  name: string | null; // playlist name; null for Up Next
  tracks: QueueTrack[]; // SNAPSHOT
  index: number;
  loop: boolean;
}
