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
  /** "primary" for the empty state, "icon" for the toolbar next to search. */
  variant: "primary" | "icon";
  label: string;
}

export default function ImportTrigger({
  isElectron,
  onPick,
  disabled,
  variant,
  label,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const className =
    variant === "primary"
      ? "inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-medium bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-600/40 cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none disabled:opacity-50"
      : "inline-flex items-center justify-center w-11 h-11 flex-shrink-0 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none disabled:opacity-50";

  const content = (
    <>
      <ImportDeckIcon className={variant === "primary" ? "w-5 h-5" : "w-5 h-5"} />
      {variant === "primary" && <span>{label}</span>}
    </>
  );

  if (isElectron) {
    return (
      <button
        type="button"
        onClick={() => onPick()}
        disabled={disabled}
        title={variant === "icon" ? label : undefined}
        aria-label={label}
        className={className}
      >
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
        title={variant === "icon" ? label : undefined}
        aria-label={label}
        className={className}
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
