import { useContext, type ReactNode } from "react";
import { Card } from "../../components/ui/Card";
import { HighlightContext } from "./settingsNavigation";

/**
 * One setting: a plain-language label and hint, with its control beside it
 * (`control`, for switches and small selects) or below it (`children`, for
 * pickers that need the width). `id` is what search and deep links scroll to.
 */
export function SettingRow({
  id,
  label,
  hint,
  control,
  action,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  control?: ReactNode;
  /** A quiet link-style action beside the label, e.g. "Reset". */
  action?: ReactNode;
  children?: ReactNode;
}) {
  const highlighted = useContext(HighlightContext) === id;
  return (
    <div
      data-setting={id}
      className={`-mx-3 px-3 py-4 first:pt-2 last:pb-2 rounded-lg scroll-mt-24 transition-colors duration-700 ${
        highlighted ? "bg-blue-500/15" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-gray-100">{label}</div>
          {hint && <p className="text-sm text-gray-400 mt-0.5">{hint}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
        {control && <div className="flex-shrink-0 pt-0.5">{control}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

/** A card of related rows, split by hairlines. */
export function SettingsGroup({
  title,
  tip,
  children,
}: {
  title?: string;
  tip?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card tip={tip}>
      {title && (
        <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2 pr-8">
          {title}
        </h3>
      )}
      {/* Without a title the first row would run under the tip's "?" button. */}
      <div
        className={`divide-y divide-gray-700/50 ${tip && !title ? "[&>*:first-child]:pr-8" : ""}`}
      >
        {children}
      </div>
    </Card>
  );
}

/** "Reset", "Reset to auto" — a text button that sits beside a row's label. */
export function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm text-blue-400 hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1"
    >
      {children}
    </button>
  );
}

/** A labelled 0–100% style slider with its value shown, used for sizes. */
export function PercentSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm text-gray-300 flex items-center justify-between gap-2 mb-1.5">
        <span>{label}</span>
        <span className="tabular-nums text-gray-500">{value}%</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}
