import { useMemo, useState } from "react";
import type { AudioItem } from "../../shared/audioLibrary.types";
import type { AudioPlaylist } from "../../shared/audioPlaylist.types";
import type { AudioState } from "../../shared/types";
import type { Translations } from "../../shared/i18n";
import { formatDuration, normalizeForSearch } from "../../shared/utils";
import { Card } from "./ui/Card";
import { SortableList } from "./ui/SortableList";
import {
  ChevronLeftIcon,
  CloseIcon,
  ChevronRightIcon,
  PlayIcon,
  MusicNoteIcon,
  EqualizerIcon,
  LoopIcon,
} from "./icons/ui";

interface Props {
  playlists: AudioPlaylist[];
  audios: AudioItem[];
  audioState: AudioState;
  onCreatePlaylist: (name: string, audioIds: string[]) => void;
  onRenamePlaylist: (id: string, name: string) => void;
  onDeletePlaylist: (id: string) => void;
  onSetLoop: (id: string, loop: boolean) => void;
  onAddTracks: (id: string, audioIds: string[]) => void;
  onRemoveTrack: (id: string, audioId: string) => void;
  onReorderTracks: (id: string, orderedAudioIds: string[]) => void;
  onPlayPlaylist: (id: string, startIndex?: number) => void;
  t: Translations;
}

type View = { type: "grid" } | { type: "detail"; playlistId: string } | { type: "addTracks"; playlistId: string };

export default function AudioPlaylistsTab({
  playlists,
  audios,
  audioState,
  onCreatePlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  onSetLoop,
  onAddTracks,
  onRemoveTrack,
  onReorderTracks,
  onPlayPlaylist,
  t,
}: Props) {
  const [view, setView] = useState<View>({ type: "grid" });
  const [newPlaylistPrompt, setNewPlaylistPrompt] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [addSearch, setAddSearch] = useState("");

  const audioById = useMemo(() => new Map(audios.map((a) => [a.id, a])), [audios]);

  const playlistStats = (playlist: AudioPlaylist) => {
    const tracks = playlist.audioIds
      .map((id) => audioById.get(id))
      .filter((a): a is AudioItem => !!a);
    const totalDuration = tracks.reduce((sum, a) => sum + (a.duration ?? 0), 0);
    return { tracks, totalDuration };
  };

  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) return;
    onCreatePlaylist(newPlaylistName.trim(), []);
    setNewPlaylistPrompt(false);
    setNewPlaylistName("");
  };

  // Detail view
  if (view.type === "detail") {
    const playlist = playlists.find((p) => p.id === view.playlistId);
    if (!playlist) {
      setView({ type: "grid" });
      return null;
    }

    const { tracks, totalDuration } = playlistStats(playlist);
    const isLive =
      audioState.queue.source === "playlist" &&
      audioState.queue.playlistId === playlist.id;
    const effectiveLoop = isLive ? audioState.queue.loop : playlist.loop;
    // Matched on the live src, not read off the cursor — a track removed from
    // the playlist keeps playing while the cursor moves to its successor, so
    // `tracks[index]` would highlight the wrong row rather than no row.
    const nowPlayingAudioId = isLive
      ? (audioState.queue.tracks.find((t) => t.src === audioState.src)
          ?.audioId ?? null)
      : null;

    return (
      <div className="min-w-0 w-full min-h-full flex flex-col">
        <div className="max-w-2xl mx-auto w-full space-y-4 sm:space-y-6 mb-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView({ type: "grid" })}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            {editingName ? (
              <input
                autoFocus
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={() => {
                  if (nameValue.trim()) onRenamePlaylist(playlist.id, nameValue.trim());
                  setEditingName(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="text-lg font-semibold bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
              />
            ) : (
              <h2
                className="text-lg font-semibold cursor-pointer hover:text-blue-400 transition-colors truncate"
                onClick={() => {
                  setNameValue(playlist.name);
                  setEditingName(true);
                }}
              >
                {playlist.name}
              </h2>
            )}
            <span className="text-sm text-gray-500 flex-shrink-0">
              {t.audioLibrary.tracks.replace("{count}", String(tracks.length))}
            </span>
          </div>

          {/* Settings */}
          <Card compact>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={effectiveLoop}
                onChange={(e) => onSetLoop(playlist.id, e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-300">{t.audioLibrary.loop}</span>
            </label>
          </Card>

          {/* Play button */}
          <button
            onClick={() => onPlayPlaylist(playlist.id, 0)}
            disabled={tracks.length === 0}
            className="w-full py-3 rounded-lg text-sm font-medium bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <PlayIcon className="w-4 h-4" />
            {t.audioLibrary.play}
            {tracks.length > 0 && (
              <span className="text-blue-400/60">· {formatDuration(totalDuration)}</span>
            )}
          </button>

          {/* Track list */}
          <Card compact>
            {tracks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">{t.audioLibrary.emptyPlaylistHint}</p>
              </div>
            ) : (
              <SortableList
                items={tracks}
                getId={(item) => item.id}
                onReorder={(orderedIds) => onReorderTracks(playlist.id, orderedIds)}
                moveUpLabel={t.audioLibrary.moveUp}
                moveDownLabel={t.audioLibrary.moveDown}
                highlightId={nowPlayingAudioId}
                renderItem={(item, index) => (
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                  type="button"
                  onClick={() => onPlayPlaylist(playlist.id, index)}
                  className="group flex items-center gap-2 min-w-0 flex-1 text-left"
                  title={t.audioLibrary.play}
                >
                  <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                    {item.id === nowPlayingAudioId ? (
                      <EqualizerIcon className="w-4 h-4 text-blue-400" />
                    ) : (
                      <>
                        <MusicNoteIcon className="w-4 h-4 text-gray-500 group-hover:hidden" />
                        <PlayIcon className="w-3.5 h-3.5 text-blue-400 hidden group-hover:block" />
                      </>
                    )}
                  </span>
                  <span
                    className={`text-sm truncate flex-1 ${
                      item.id === nowPlayingAudioId
                        ? "text-blue-100 font-medium"
                        : "text-gray-300 group-hover:text-white"
                    }`}
                  >
                    {item.name}
                  </span>
                </button>
                    <span className="text-xs text-gray-500 flex-shrink-0 tabular-nums">
                      {formatDuration(item.duration)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveTrack(playlist.id, item.id)}
                      className="p-1 rounded hover:bg-red-600/20 text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                      aria-label={t.audioLibrary.removeFromPlaylist}
                      title={t.audioLibrary.removeFromPlaylist}
                    >
                      <CloseIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              />
            )}

            <button
              onClick={() => setView({ type: "addTracks", playlistId: playlist.id })}
              className="mt-3 w-full py-2 rounded-lg text-sm bg-gray-800/50 border border-gray-700/50 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 transition-colors"
            >
              + {t.audioLibrary.addTracks}
            </button>
          </Card>

          {/* Delete playlist */}
          <button
            onClick={() => {
              onDeletePlaylist(playlist.id);
              setView({ type: "grid" });
            }}
            className="w-full py-2 rounded-lg text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/40 transition-colors"
          >
            {t.audioLibrary.deletePlaylist}
          </button>
        </div>
      </div>
    );
  }

  // Add tracks picker
  if (view.type === "addTracks") {
    const playlist = playlists.find((p) => p.id === view.playlistId);
    if (!playlist) {
      setView({ type: "grid" });
      return null;
    }
    const existing = new Set(playlist.audioIds);
    const available = audios.filter((a) => !existing.has(a.id));
    const norm = normalizeForSearch(addSearch);
    const filtered = norm
      ? available.filter((a) => normalizeForSearch(a.name).includes(norm))
      : available;

    return (
      <div className="min-w-0 w-full min-h-full flex flex-col">
        <div className="max-w-2xl mx-auto w-full space-y-4 mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setAddSearch("");
                setView({ type: "detail", playlistId: playlist.id });
              }}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold">{t.audioLibrary.addTracks}</h2>
          </div>

          <input
            type="text"
            value={addSearch}
            onChange={(e) => setAddSearch(e.target.value)}
            placeholder={t.audioLibrary.searchPlaceholder}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {filtered.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              {t.audioLibrary.noResults}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((audio) => (
                <button
                  key={audio.id}
                  onClick={() => onAddTracks(playlist.id, [audio.id])}
                  className="w-full flex items-center gap-3 bg-gray-900/50 border border-gray-700/30 rounded-lg p-2.5 hover:border-blue-500/50 transition-colors text-left"
                >
                  <MusicNoteIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm text-gray-300 truncate flex-1">
                    {audio.name}
                  </span>
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {formatDuration(audio.duration)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Grid view (default)
  return (
    <div className="min-w-0 w-full min-h-full flex flex-col">
      <div className="max-w-2xl mx-auto w-full space-y-4 sm:space-y-6 mb-4">
        {newPlaylistPrompt && (
          <Card compact>
            <p className="text-sm text-gray-300 mb-2">{t.audioLibrary.playlistName}</p>
            <div className="flex gap-2">
              <input
                autoFocus
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreatePlaylist();
                  if (e.key === "Escape") {
                    setNewPlaylistPrompt(false);
                    setNewPlaylistName("");
                  }
                }}
                placeholder={t.audioLibrary.playlistName}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleCreatePlaylist}
                disabled={!newPlaylistName.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40 disabled:opacity-40 transition-colors"
              >
                {t.audioLibrary.newPlaylist}
              </button>
              <button
                onClick={() => {
                  setNewPlaylistPrompt(false);
                  setNewPlaylistName("");
                }}
                className="p-2 rounded-lg hover:bg-gray-700 text-gray-500 transition-colors"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
          </Card>
        )}

        <Card compact>
          {playlists.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">{t.audioLibrary.noPlaylists}</p>
              <p className="text-gray-600 text-sm mt-1">{t.audioLibrary.noPlaylistsHint}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {playlists.map((playlist) => {
                const { tracks, totalDuration } = playlistStats(playlist);
                const isLive =
                  audioState.queue.source === "playlist" &&
                  audioState.queue.playlistId === playlist.id;
                const open = () =>
                  setView({ type: "detail", playlistId: playlist.id });
                return (
                  // A div, not a button: it contains the Play button, and
                  // nesting buttons is invalid. Keyboard handling is restored
                  // explicitly below.
                  <div
                    key={playlist.id}
                    role="button"
                    tabIndex={0}
                    onClick={open}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        open();
                      }
                    }}
                    className={`group flex items-center gap-3 rounded-lg border p-2.5 sm:p-3 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none ${
                      isLive
                        ? "bg-blue-950/20 border-blue-500/40"
                        : "bg-gray-900/50 border-gray-700/30 hover:border-gray-600/50 hover:bg-gray-800/50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          isLive
                            ? "text-blue-100"
                            : "text-gray-200 group-hover:text-white"
                        }`}
                      >
                        {playlist.name}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                        <span className="truncate">
                          {t.audioLibrary.tracks.replace("{count}", String(tracks.length))}
                          {tracks.length > 0 && ` · ${formatDuration(totalDuration)}`}
                        </span>
                        {playlist.loop && (
                          <LoopIcon className="w-3 h-3 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayPlaylist(playlist.id, 0);
                      }}
                      disabled={tracks.length === 0}
                      className="p-2 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                      title={t.audioLibrary.play}
                      aria-label={t.audioLibrary.play}
                    >
                      <PlayIcon className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRightIcon className="w-4 h-4 text-gray-600 flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={() => setNewPlaylistPrompt(true)}
            className="mt-3 w-full py-2 rounded-lg text-sm bg-gray-800/50 border border-gray-700/50 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 transition-colors"
          >
            + {t.audioLibrary.newPlaylist}
          </button>
        </Card>
      </div>
    </div>
  );
}
