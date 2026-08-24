import { useState, useMemo } from "react";
import type { AudioItem } from "../../shared/audioLibrary.types";
import type { Translations } from "../../shared/i18n";
import { formatDuration } from "../../shared/utils";
import { Card } from "./ui/Card";
import { SortableList } from "./ui/SortableList";
import { ChevronRightIcon, ChevronDownIcon, PlayIcon, CloseIcon, MusicNoteIcon, EqualizerIcon } from "./icons/ui";

interface Props {
  queueAudioIds: string[];
  audios: AudioItem[];
  onPlay: () => void;
  onClear: () => void;
  onReorder: (orderedAudioIds: string[]) => void;
  onRemove: (audioId: string) => void;
  /** Jump playback to a track by its position in Up Next. */
  onPlayTrack: (index: number) => void;
  /** True when this queue is the source actually playing. */
  isLive: boolean;
  /** Live track, but only when Up Next is the playing source — null otherwise. */
  nowPlayingAudioId: string | null;
  t: Translations;
}

export default function AudioQueueStrip({
  queueAudioIds,
  audios,
  onPlay,
  onClear,
  onReorder,
  onRemove,
  onPlayTrack,
  isLive,
  nowPlayingAudioId,
  t,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const tracks = useMemo(() => {
    const byId = new Map(audios.map((a) => [a.id, a]));
    return queueAudioIds
      .map((id) => byId.get(id))
      .filter((a): a is AudioItem => !!a);
  }, [queueAudioIds, audios]);

  if (tracks.length === 0) return null;

  const totalDuration = tracks.reduce((sum, a) => sum + (a.duration ?? 0), 0);

  return (
    <Card compact>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left py-0.5"
        >
          {expanded ? (
            <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
          {/* "Up Next" is a claim about what plays next — only true when this
              queue is the live source. Otherwise it is just a saved list. */}
          <span
            className={`text-sm font-medium truncate ${
              isLive ? "" : "text-gray-400"
            }`}
          >
            {isLive ? t.audioLibrary.upNext : t.audioLibrary.queueOnHold} · {t.audioLibrary.tracks.replace("{count}", String(tracks.length))} · {formatDuration(totalDuration)}
          </span>
        </button>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onPlay}
            className="p-2 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40 transition-colors"
            title={t.audioLibrary.play}
            aria-label={t.audioLibrary.play}
          >
            <PlayIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClear}
            className="p-2 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/40 transition-colors"
            title={t.audioLibrary.clearQueue}
            aria-label={t.audioLibrary.clearQueue}
          >
            <CloseIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3">
          <SortableList
            items={tracks}
            getId={(item) => item.id}
            onReorder={onReorder}
            moveUpLabel={t.audioLibrary.moveUp}
            moveDownLabel={t.audioLibrary.moveDown}
            highlightId={nowPlayingAudioId}
            renderItem={(item, index) => (
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => onPlayTrack(index)}
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
                  onClick={() => onRemove(item.id)}
                  className="p-1 rounded hover:bg-red-600/20 text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                  aria-label={t.audioLibrary.delete}
                >
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          />
        </div>
      )}
    </Card>
  );
}
