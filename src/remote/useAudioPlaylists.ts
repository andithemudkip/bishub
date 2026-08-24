import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { AudioPlaylist } from "../shared/audioPlaylist.types";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "../shared/types";
import { getDeviceToken } from "../shared/utils";

type SocketType = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface AudioPlaylistsAPI {
  playlists: AudioPlaylist[];
  /** audioIds currently in the ephemeral "Up Next" queue, in order. */
  queueAudioIds: string[];
  isElectron: boolean;

  // Playlist CRUD
  createPlaylist: (name: string, audioIds: string[]) => void;
  renamePlaylist: (playlistId: string, name: string) => void;
  deletePlaylist: (playlistId: string) => void;
  setPlaylistLoop: (playlistId: string, loop: boolean) => void;
  addTracksToPlaylist: (playlistId: string, audioIds: string[]) => void;
  removeTrackFromPlaylist: (playlistId: string, audioId: string) => void;
  reorderPlaylist: (playlistId: string, orderedAudioIds: string[]) => void;

  // Up Next
  addToQueue: (audioIds: string[]) => void;
  playNextInQueue: (audioIds: string[]) => void;
  removeFromQueue: (audioId: string) => void;
  reorderQueue: (orderedAudioIds: string[]) => void;
  clearQueue: () => void;
}

export function useAudioPlaylists(): AudioPlaylistsAPI {
  const [playlists, setPlaylists] = useState<AudioPlaylist[]>([]);
  const [queueAudioIds, setQueueAudioIds] = useState<string[]>([]);

  const socketRef = useRef<SocketType | null>(null);
  const isElectron = !!window.electronAPI;

  useEffect(() => {
    if (isElectron) {
      window.electronAPI!.getAudioPlaylists().then(setPlaylists);
      window.electronAPI!.getAudioQueue().then(setQueueAudioIds);

      const unsubPlaylists =
        window.electronAPI!.onAudioPlaylistsUpdate(setPlaylists);
      const unsubQueue =
        window.electronAPI!.onAudioQueueUpdate(setQueueAudioIds);

      return () => {
        unsubPlaylists();
        unsubQueue();
      };
    } else {
      const token = getDeviceToken();
      if (!token) return;
      const socket: SocketType = io({
        auth: { token },
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("getAudioPlaylists");
        socket.emit("getAudioQueue");
      });

      socket.on("audioPlaylists", setPlaylists);
      socket.on("audioQueue", setQueueAudioIds);

      return () => {
        socket.disconnect();
      };
    }
  }, [isElectron]);

  const api: AudioPlaylistsAPI = {
    playlists,
    queueAudioIds,
    isElectron,

    createPlaylist: useCallback(
      (name, audioIds) => {
        if (isElectron) window.electronAPI!.createAudioPlaylist(name, audioIds);
        else socketRef.current?.emit("createAudioPlaylist", name, audioIds);
      },
      [isElectron]
    ),

    renamePlaylist: useCallback(
      (playlistId, name) => {
        if (isElectron)
          window.electronAPI!.renameAudioPlaylist(playlistId, name);
        else socketRef.current?.emit("renameAudioPlaylist", playlistId, name);
      },
      [isElectron]
    ),

    deletePlaylist: useCallback(
      (playlistId) => {
        if (isElectron) window.electronAPI!.deleteAudioPlaylist(playlistId);
        else socketRef.current?.emit("deleteAudioPlaylist", playlistId);
      },
      [isElectron]
    ),

    setPlaylistLoop: useCallback(
      (playlistId, loop) => {
        if (isElectron)
          window.electronAPI!.setAudioPlaylistLoop(playlistId, loop);
        else socketRef.current?.emit("setAudioPlaylistLoop", playlistId, loop);
      },
      [isElectron]
    ),

    addTracksToPlaylist: useCallback(
      (playlistId, audioIds) => {
        if (isElectron)
          window.electronAPI!.addTracksToPlaylist(playlistId, audioIds);
        else
          socketRef.current?.emit(
            "addTracksToPlaylist",
            playlistId,
            audioIds
          );
      },
      [isElectron]
    ),

    removeTrackFromPlaylist: useCallback(
      (playlistId, audioId) => {
        if (isElectron)
          window.electronAPI!.removeTrackFromPlaylist(playlistId, audioId);
        else
          socketRef.current?.emit(
            "removeTrackFromPlaylist",
            playlistId,
            audioId
          );
      },
      [isElectron]
    ),

    reorderPlaylist: useCallback(
      (playlistId, orderedAudioIds) => {
        if (isElectron)
          window.electronAPI!.reorderPlaylist(playlistId, orderedAudioIds);
        else
          socketRef.current?.emit(
            "reorderPlaylist",
            playlistId,
            orderedAudioIds
          );
      },
      [isElectron]
    ),

    addToQueue: useCallback(
      (audioIds) => {
        if (isElectron) window.electronAPI!.addToQueue(audioIds);
        else socketRef.current?.emit("addToQueue", audioIds);
      },
      [isElectron]
    ),

    playNextInQueue: useCallback(
      (audioIds) => {
        if (isElectron) window.electronAPI!.playNextInQueue(audioIds);
        else socketRef.current?.emit("playNextInQueue", audioIds);
      },
      [isElectron]
    ),

    removeFromQueue: useCallback(
      (audioId) => {
        if (isElectron) window.electronAPI!.removeFromQueue(audioId);
        else socketRef.current?.emit("removeFromQueue", audioId);
      },
      [isElectron]
    ),

    reorderQueue: useCallback(
      (orderedAudioIds) => {
        if (isElectron) window.electronAPI!.reorderQueue(orderedAudioIds);
        else socketRef.current?.emit("reorderQueue", orderedAudioIds);
      },
      [isElectron]
    ),

    clearQueue: useCallback(() => {
      if (isElectron) window.electronAPI!.clearQueue();
      else socketRef.current?.emit("clearQueue");
    }, [isElectron]),
  };

  return api;
}
