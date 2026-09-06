interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name — the switch itself carries no visible text. */
  label: string;
  disabled?: boolean;
}

/** Standard on/off switch. */
export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    // The negative margin keeps the visual size while giving the thumb a
    // full-height tap target on phones.
    <label
      className={`relative inline-flex items-center flex-shrink-0 py-2 -my-2 ${
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <div className="relative w-11 h-6 bg-gray-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 rounded-full peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
    </label>
  );
}
