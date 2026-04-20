import { useCallback, useMemo, useRef } from "react";
import type { MonitorInfo } from "../../../shared/types";
import { getTranslations, type Language } from "../../../shared/i18n";

interface MonitorPickerProps {
  monitors: MonitorInfo[];
  value: number;
  resolvedAutoId: number | null;
  onChange: (id: number) => void;
  language: Language;
}

interface Layout {
  minX: number;
  minY: number;
  width: number;
  height: number;
  aspect: number;
}

function computeLayout(monitors: MonitorInfo[]): Layout | null {
  if (monitors.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const m of monitors) {
    minX = Math.min(minX, m.bounds.x);
    minY = Math.min(minY, m.bounds.y);
    maxX = Math.max(maxX, m.bounds.x + m.bounds.width);
    maxY = Math.max(maxY, m.bounds.y + m.bounds.height);
  }
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  return { minX, minY, width, height, aspect: width / height };
}

const TARGET_HEIGHT_PX = 320;

type Direction = "left" | "right" | "up" | "down";

function nearestInDirection(
  current: MonitorInfo,
  candidates: MonitorInfo[],
  dir: Direction,
): MonitorInfo | null {
  const cx = current.bounds.x + current.bounds.width / 2;
  const cy = current.bounds.y + current.bounds.height / 2;
  let best: { m: MonitorInfo; dist: number } | null = null;
  for (const m of candidates) {
    if (m.id === current.id) continue;
    const mx = m.bounds.x + m.bounds.width / 2;
    const my = m.bounds.y + m.bounds.height / 2;
    const dx = mx - cx;
    const dy = my - cy;
    const inDir =
      (dir === "left" && dx < -1 && Math.abs(dx) >= Math.abs(dy)) ||
      (dir === "right" && dx > 1 && Math.abs(dx) >= Math.abs(dy)) ||
      (dir === "up" && dy < -1 && Math.abs(dy) >= Math.abs(dx)) ||
      (dir === "down" && dy > 1 && Math.abs(dy) >= Math.abs(dx));
    if (!inDir) continue;
    const dist = Math.hypot(dx, dy);
    if (!best || dist < best.dist) best = { m, dist };
  }
  return best?.m ?? null;
}

function LaptopIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="5" width="16" height="11" rx="1" />
      <path d="M2 19h20" />
    </svg>
  );
}

export function MonitorPicker({
  monitors,
  value,
  resolvedAutoId,
  onChange,
  language,
}: MonitorPickerProps) {
  const t = getTranslations(language);
  const layout = useMemo(() => computeLayout(monitors), [monitors]);
  const containerRef = useRef<HTMLDivElement>(null);

  const tabbableId = useMemo(() => {
    if (monitors.length === 0) return null;
    if (value !== -1 && monitors.some((m) => m.id === value)) return value;
    if (resolvedAutoId !== null && monitors.some((m) => m.id === resolvedAutoId)) {
      return resolvedAutoId;
    }
    return monitors[0].id;
  }, [monitors, value, resolvedAutoId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, monitor: MonitorInfo) => {
      const dirMap: Record<string, Direction | undefined> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
      };
      const dir = dirMap[e.key];
      if (!dir) return;
      const next = nearestInDirection(monitor, monitors, dir);
      if (!next) return;
      e.preventDefault();
      onChange(next.id);
      const el = containerRef.current?.querySelector<HTMLButtonElement>(
        `[data-monitor-id="${next.id}"]`,
      );
      el?.focus();
    },
    [monitors, onChange],
  );

  if (!layout) {
    return (
      <div className="text-sm text-gray-500 italic px-2 py-3">
        {t.settings.selectMonitorHint}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={t.settings.displayMonitor}
      className="relative mx-auto bg-gray-900/70 border border-gray-700/50 rounded-xl p-3 sm:p-4"
      style={{
        aspectRatio: layout.aspect,
        width: `min(100%, ${Math.round(TARGET_HEIGHT_PX * layout.aspect)}px)`,
        minHeight: "120px",
      }}
    >
      <div className="absolute inset-3 sm:inset-4">
        {monitors.map((m, idx) => {
          const left = ((m.bounds.x - layout.minX) / layout.width) * 100;
          const top = ((m.bounds.y - layout.minY) / layout.height) * 100;
          const width = (m.bounds.width / layout.width) * 100;
          const height = (m.bounds.height / layout.height) * 100;

          const isManuallySelected = value === m.id;
          const isAutoResolved = value === -1 && resolvedAutoId === m.id;
          const isTabbable = m.id === tabbableId;

          const labelText = m.label || m.name;
          const tooltip = `${labelText} • ${m.bounds.width}×${m.bounds.height}${
            m.scaleFactor !== 1 ? ` @ ${m.scaleFactor}×` : ""
          }`;
          const ariaParts = [
            m.name,
            m.label,
            `${m.bounds.width} by ${m.bounds.height}`,
            m.isPrimary ? t.settings.monitorPrimary : null,
            m.internal ? t.settings.monitorInternal : null,
          ].filter((part): part is string => Boolean(part));

          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={isManuallySelected}
              aria-label={ariaParts.join(", ")}
              data-monitor-id={m.id}
              title={tooltip}
              tabIndex={isTabbable ? 0 : -1}
              onClick={() => onChange(m.id)}
              onKeyDown={(e) => handleKeyDown(e, m)}
              className={`absolute flex flex-col items-center justify-center rounded-md sm:rounded-lg border transition-colors overflow-hidden text-center min-w-[44px] min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:z-10 ${
                isManuallySelected
                  ? "bg-blue-600/30 border-blue-500 ring-2 ring-blue-400/40 text-white"
                  : isAutoResolved
                    ? "bg-blue-500/5 border-2 border-dashed border-blue-400/70 text-blue-100"
                    : "bg-gray-700/60 border border-gray-600/50 hover:bg-gray-700 hover:border-gray-500 text-gray-200"
              }`}
              style={{
                left: `calc(${left}% + 2px)`,
                top: `calc(${top}% + 2px)`,
                width: `calc(${width}% - 4px)`,
                height: `calc(${height}% - 4px)`,
              }}
            >
              <span className="text-base sm:text-lg lg:text-xl font-bold leading-none">
                {idx + 1}
              </span>
              <span className="text-[10px] sm:text-xs opacity-70 mt-1 truncate max-w-full px-1">
                {m.bounds.width}×{m.bounds.height}
              </span>
              {m.isPrimary && (
                <span className="absolute top-1 left-1 text-[8px] sm:text-[10px] font-medium px-1 sm:px-1.5 py-0.5 bg-gray-900/70 rounded uppercase tracking-wide opacity-80">
                  {t.settings.monitorPrimary}
                </span>
              )}
              {m.internal && (
                <LaptopIcon className="absolute top-1 right-1 w-3 h-3 sm:w-4 sm:h-4 opacity-70" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
