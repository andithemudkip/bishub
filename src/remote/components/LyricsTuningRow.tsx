interface Props {
  offset: number;
  /** Shift actually in effect on the screen showing now: the whole-hymn offset
   *  plus every breakpoint up to this point. This is the number that matters
   *  once breakpoints exist, and it is not the same as `offset`. */
  effectiveOffset: number;
  /** The word a new keyframe would attach to — shown so the operator can see
   *  exactly where the correction will start, rather than trusting the playhead. */
  anchorWord: string;
  breakpointCount: number;
  /** False on the very first word — there is nothing before it to leave alone,
   *  so a keyframe there would just be the whole-hymn offset. The control stays
   *  visible and disabled rather than absent: appearing partway through a hymn
   *  is more confusing than one that is briefly unavailable. */
  canSplit: boolean;
  saved: boolean;
  onNudge: (delta: number) => void;
  onSplit: (delta: number) => void;
  onReset: () => void;
  onSave: () => void;
  labels: {
    title: string;
    offset: string;
    fromHere: string;
    fromHereFirstScreen: string;
    reset: string;
    save: string;
    saved: string;
  };
}

const STEPS = [-0.5, -0.1, 0.1, 0.5];

function sign(value: number): string {
  // U+2212 rather than a hyphen: these sit next to numbers and should read as
  // arithmetic, and the hyphen is visibly too short beside tabular digits.
  return `${value > 0 ? "+" : "−"}${Math.abs(value)}`;
}

/**
 * Karaoke timing controls, shown in the hymn transport bar when the tuning
 * setting is on. Corrections take effect on the display as they are made, so
 * the operator can find the right value by ear in one playthrough instead of
 * regenerating the timings and listening again.
 */
export default function LyricsTuningRow({
  offset,
  effectiveOffset,
  anchorWord,
  breakpointCount,
  canSplit,
  saved,
  onNudge,
  onSplit,
  onReset,
  onSave,
  labels,
}: Props) {
  const dirty = offset !== 0 || breakpointCount > 0;

  return (
    <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-400 mr-1">{labels.title}</span>

      <div className="flex items-center bg-gray-900/50 border border-gray-700/50 rounded-lg overflow-hidden">
        {STEPS.map((step) => (
          <button
            key={step}
            onClick={() => onNudge(step)}
            className="px-2.5 py-1.5 text-xs tabular-nums text-gray-300 hover:bg-gray-700/60 active:bg-gray-600/60 transition-colors border-r border-gray-700/50 last:border-r-0 focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
            title={`${labels.offset} ${sign(step)}s`}
          >
            {sign(step)}
          </button>
        ))}
      </div>

      <span className="text-xs tabular-nums text-gray-300 min-w-[4.5rem]">
        {labels.offset} {effectiveOffset >= 0 ? "+" : "−"}
        {Math.abs(effectiveOffset).toFixed(2)}s
        {/* Only worth distinguishing once a breakpoint makes them differ. */}
        {effectiveOffset !== offset && (
          <span className="text-gray-500">
            {" "}
            ({offset >= 0 ? "+" : "−"}
            {Math.abs(offset).toFixed(2)})
          </span>
        )}
      </span>

      <div className="flex items-center gap-1.5">
        <span className={`text-xs ${canSplit ? "text-gray-500" : "text-gray-600"}`}>
          {labels.fromHere}
        </span>
        <div className="flex items-center bg-gray-900/50 border border-gray-700/50 rounded-lg overflow-hidden">
          {[-0.5, -0.1, 0.1, 0.5].map((step) => (
            <button
              key={step}
              onClick={() => onSplit(step)}
              disabled={!canSplit}
              title={canSplit ? undefined : labels.fromHereFirstScreen}
              className="px-2.5 py-1.5 text-xs tabular-nums text-gray-300 hover:bg-gray-700/60 active:bg-gray-600/60 transition-colors border-r border-gray-700/50 last:border-r-0 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
            >
              {sign(step)}
            </button>
          ))}
        </div>
        {canSplit && anchorWord && (
          <span className="text-xs text-gray-500 max-w-[7rem] truncate" title={anchorWord}>
            {anchorWord}
          </span>
        )}
        {breakpointCount > 0 && (
          <span className="text-xs text-gray-500 tabular-nums">
            ×{breakpointCount}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {dirty && (
          <button
            onClick={onReset}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-600/20 text-gray-400 hover:bg-gray-600/30 border border-gray-600/40 focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
          >
            {labels.reset}
          </button>
        )}
        <button
          onClick={onSave}
          disabled={saved}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40 disabled:opacity-50 disabled:hover:bg-blue-600/20 focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
        >
          {saved ? labels.saved : labels.save}
        </button>
      </div>
    </div>
  );
}
