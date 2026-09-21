import { useRef } from "react";
import { ImportDeckIcon } from "../icons/ui";

/**
 * The button that starts an import.
 *
 * Two shapes, because the file has to reach the main process two different
 * ways. On Electron it is a plain button opening the native picker. In a
 * browser it must be a real <input type="file">: the picker can only be opened
 * from inside the user's own click, so it cannot be triggered later from state.
 */

interface Props {
  isElectron: boolean;
  onPick: (files?: FileList) => void;
  disabled?: boolean;
  label: string;
  className?: string;
}

export default function ImportTrigger({
  isElectron,
  onPick,
  disabled,
  label,
  className = "",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Always labelled. This used to be an icon beside the search field, where it
  // read as a search button and offered itself on books that cannot be imported
  // into. It now says what it does, and only appears where it applies.
  const classes = `inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-600/40 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${className}`;

  const content = (
    <>
      <ImportDeckIcon className="w-5 h-5 flex-shrink-0" />
      <span>{label}</span>
    </>
  );

  if (isElectron) {
    return (
      <button type="button" onClick={() => onPick()} disabled={disabled} className={classes}>
        {content}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className={classes}
      >
        {content}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = event.target.files;
          if (files && files.length > 0) onPick(files);
          // Clear it, or picking the same file twice in a row does nothing.
          event.target.value = "";
        }}
      />
    </>
  );
}
