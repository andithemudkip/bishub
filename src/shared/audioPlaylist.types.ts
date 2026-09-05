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
  /**
   * Set when the on-air track has been removed from the source: it plays on
   * to its end but is gone from `tracks`, and this is the slot it vacated —
   * where the *next* track comes from, which is `tracks.length` if it was
   * removed from the end. Null in the normal case, where the on-air track is
   * in `tracks` at `index`. Consumers that mean "what is playing" must not
   * read `tracks[index]` while this is set; match on `AudioState.src`.
   */
  orphanedAt: number | null;
  loop: boolean;
}
