import { useEffect, useState } from "react";
import { CheckIcon, WarningIcon } from "../icons/ui";

export interface ToastItem {
  id: string;
  tone: "success" | "error";
  title: string;
  detail?: string;
  /** Tapping the toast runs this, then dismisses it. */
  onSelect?: () => void;
}

interface Props {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

/**
 * Stacked notices, newest at the bottom. On phones they sit above the bottom
 * nav, clear of the preview and the slide controls.
 */
export function ToastStack({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed z-50 inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:bottom-4 md:w-80 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

/**
 * Ignores taps for its first moments: a toast appearing under a thumb that
 * was already on its way to something else mustn't catch that tap.
 */
const ARM_DELAY_MS = 300;

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const [shown, setShown] = useState(false);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    const timer = setTimeout(() => setArmed(true), ARM_DELAY_MS);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, []);

  const isError = toast.tone === "error";
  const Icon = isError ? WarningIcon : CheckIcon;

  return (
    <button
      onClick={() => {
        toast.onSelect?.();
        onDismiss(toast.id);
      }}
      className={`flex items-start gap-2.5 w-full text-left rounded-xl border px-3 py-2.5 shadow-lg backdrop-blur bg-gray-800/95 transition-all duration-200 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        isError ? "border-red-600/40" : "border-gray-700"
      } ${shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"} ${
        armed ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      <Icon
        className={`w-5 h-5 flex-shrink-0 ${isError ? "text-red-400" : "text-green-400"}`}
      />
      <span className="flex-1 min-w-0">
        <span className="block text-sm truncate">{toast.title}</span>
        {toast.detail && (
          <span className={`block text-xs truncate ${isError ? "text-red-300/80" : "text-gray-400"}`}>
            {toast.detail}
          </span>
        )}
      </span>
    </button>
  );
}
