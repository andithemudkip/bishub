import { v4 as uuidv4 } from "uuid";
import Store from "electron-store";
import type { AudioPlaylist } from "../src/shared/audioPlaylist.types";

interface AudioPlaylistsSchema {
  playlists: AudioPlaylist[];
}

type PlaylistsChangeCallback = (playlists: AudioPlaylist[]) => void;
type QueueChangeCallback = (audioIds: string[]) => void;

/**
 * Named playlists are persisted to disk. The "Up Next" queue is a single
 * ephemeral list that lives only in memory — it is deliberately never written
 * to the store, so an app restart clears it for free.
 */
export class AudioPlaylistManager {
  private store: Store<AudioPlaylistsSchema>;
  private ephemeral: string[] = [];
  private playlistsChangeListeners: PlaylistsChangeCallback[] = [];
  private queueChangeListeners: QueueChangeCallback[] = [];

  constructor() {
    this.store = new Store<AudioPlaylistsSchema>({
      name: "audio-playlists",
      defaults: {
        playlists: [],
      },
    });
  }

  // Event listeners
  onPlaylistsChange(callback: PlaylistsChangeCallback): () => void {
    this.playlistsChangeListeners.push(callback);
    return () => {
      this.playlistsChangeListeners = this.playlistsChangeListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  onQueueChange(callback: QueueChangeCallback): () => void {
    this.queueChangeListeners.push(callback);
    return () => {
      this.queueChangeListeners = this.queueChangeListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  private notifyPlaylistsChange(): void {
    const playlists = this.getAll();
    this.playlistsChangeListeners.forEach((cb) => cb(playlists));
  }

  private notifyQueueChange(): void {
    const queue = this.getQueue();
    this.queueChangeListeners.forEach((cb) => cb(queue));
  }

  // Persistent playlist CRUD
  getAll(): AudioPlaylist[] {
    return this.store.get("playlists", []);
  }

  getById(id: string): AudioPlaylist | null {
    return this.getAll().find((p) => p.id === id) || null;
  }

  create(name: string, audioIds: string[]): AudioPlaylist {
    const now = Date.now();
    const playlist: AudioPlaylist = {
      id: uuidv4(),
      name,
      audioIds: Array.from(new Set(audioIds)),
      loop: false,
      createdAt: now,
      updatedAt: now,
    };

    const playlists = this.getAll();
    playlists.push(playlist);
    this.store.set("playlists", playlists);

    this.notifyPlaylistsChange();
    return playlist;
  }

  rename(id: string, name: string): AudioPlaylist | null {
    const playlists = this.getAll();
    const index = playlists.findIndex((p) => p.id === id);
    if (index === -1) return null;

    playlists[index].name = name;
    playlists[index].updatedAt = Date.now();
    this.store.set("playlists", playlists);

    this.notifyPlaylistsChange();
    return playlists[index];
  }

  delete(id: string): boolean {
    const playlists = this.getAll();
    const filtered = playlists.filter((p) => p.id !== id);
    if (filtered.length === playlists.length) return false;

    this.store.set("playlists", filtered);
    this.notifyPlaylistsChange();
    return true;
  }

  setLoop(id: string, loop: boolean): AudioPlaylist | null {
    const playlists = this.getAll();
    const index = playlists.findIndex((p) => p.id === id);
    if (index === -1) return null;

    playlists[index].loop = loop;
    playlists[index].updatedAt = Date.now();
    this.store.set("playlists", playlists);

    this.notifyPlaylistsChange();
    return playlists[index];
  }

  // Entries are unique within a playlist — adding an id already present is a
  // silent no-op, mirroring the slideshow code in electron/imageLibrary.ts.
  addTracks(id: string, audioIds: string[]): AudioPlaylist | null {
    const playlists = this.getAll();
    const index = playlists.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const existing = new Set(playlists[index].audioIds);
    for (const audioId of audioIds) {
      if (!existing.has(audioId)) {
        playlists[index].audioIds.push(audioId);
        existing.add(audioId);
      }
    }
    playlists[index].updatedAt = Date.now();
    this.store.set("playlists", playlists);

    this.notifyPlaylistsChange();
    return playlists[index];
  }

  removeTrack(id: string, audioId: string): AudioPlaylist | null {
    const playlists = this.getAll();
    const index = playlists.findIndex((p) => p.id === id);
    if (index === -1) return null;

    playlists[index].audioIds = playlists[index].audioIds.filter(
      (a) => a !== audioId
    );
    playlists[index].updatedAt = Date.now();
    this.store.set("playlists", playlists);

    this.notifyPlaylistsChange();
    return playlists[index];
  }

  reorder(id: string, orderedAudioIds: string[]): AudioPlaylist | null {
    const playlists = this.getAll();
    const index = playlists.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const existing = new Set(playlists[index].audioIds);
    const reordered = orderedAudioIds.filter((a) => existing.has(a));
    // Defensive: keep any ids the caller's order omitted rather than dropping them.
    for (const audioId of playlists[index].audioIds) {
      if (!reordered.includes(audioId)) reordered.push(audioId);
    }

    playlists[index].audioIds = reordered;
    playlists[index].updatedAt = Date.now();
    this.store.set("playlists", playlists);

    this.notifyPlaylistsChange();
    return playlists[index];
  }

  /**
   * Purges a deleted library item from every playlist and from Up Next.
   * Playlists reference audio by id from a separate store, so unlike
   * slideshows — whose membership lives on the ImageItem itself and is fixed
   * up by deleting it — nothing else would ever clear the dangling entries.
   * Fires the normal change events, so a live queue re-projects for free.
   */
  removeAudioEverywhere(audioId: string): void {
    const playlists = this.getAll();
    const now = Date.now();
    let changed = false;

    for (const playlist of playlists) {
      if (!playlist.audioIds.includes(audioId)) continue;
      playlist.audioIds = playlist.audioIds.filter((a) => a !== audioId);
      playlist.updatedAt = now;
      changed = true;
    }

    if (changed) {
      this.store.set("playlists", playlists);
      this.notifyPlaylistsChange();
    }

    this.removeFromQueue(audioId);
  }

  // Ephemeral "Up Next" queue — never persisted.
  getQueue(): string[] {
    return [...this.ephemeral];
  }

  addToQueue(audioIds: string[]): void {
    const existing = new Set(this.ephemeral);
    let changed = false;
    for (const audioId of audioIds) {
      if (!existing.has(audioId)) {
        this.ephemeral.push(audioId);
        existing.add(audioId);
        changed = true;
      }
    }
    if (changed) this.notifyQueueChange();
  }

  playNext(audioIds: string[], afterIndex: number): void {
    const existing = new Set(this.ephemeral);
    const toInsert = audioIds.filter((a) => !existing.has(a));
    if (toInsert.length === 0) return;

    const insertAt = Math.max(
      0,
      Math.min(afterIndex + 1, this.ephemeral.length)
    );
    this.ephemeral.splice(insertAt, 0, ...toInsert);
    this.notifyQueueChange();
  }

  removeFromQueue(audioId: string): void {
    const before = this.ephemeral.length;
    this.ephemeral = this.ephemeral.filter((a) => a !== audioId);
    if (this.ephemeral.length !== before) {
      this.notifyQueueChange();
    }
  }

  reorderQueue(orderedAudioIds: string[]): void {
    const existing = new Set(this.ephemeral);
    const reordered = orderedAudioIds.filter((a) => existing.has(a));
    for (const audioId of this.ephemeral) {
      if (!reordered.includes(audioId)) reordered.push(audioId);
    }
    this.ephemeral = reordered;
    this.notifyQueueChange();
  }

  clearQueue(): void {
    if (this.ephemeral.length === 0) return;
    this.ephemeral = [];
    this.notifyQueueChange();
  }
}

// Singleton instance
let playlistsInstance: AudioPlaylistManager | null = null;

export function getAudioPlaylists(): AudioPlaylistManager {
  if (!playlistsInstance) {
    playlistsInstance = new AudioPlaylistManager();
  }
  return playlistsInstance;
}
