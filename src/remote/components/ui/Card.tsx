import { type ReactNode, useState } from "react";
import { HelpIcon, CloseIcon } from "../icons/ui";

interface CardProps {
  children: ReactNode;
  /** Compact padding (p-3 sm:p-4) vs default (p-4 sm:p-6) */
  compact?: boolean;
  className?: string;
  /** Optional tip/explainer content shown via a toggleable help button */
  tip?: ReactNode;
}

/**
 * Standard section container used throughout the app.
 * Subtle border with slightly elevated background.
 */
export function Card({ children, compact, className = "", tip }: CardProps) {
  const [tipOpen, setTipOpen] = useState(false);

  return (
    <div
      className={`bg-gray-800/50 border border-gray-700/50 rounded-xl ${compact ? "p-3 sm:p-4" : "p-4 sm:p-6"} ${className} relative`}
    >
      {tip && (
        <button
          type="button"
          onClick={() => setTipOpen((v) => !v)}
          className={`absolute top-2 right-2 sm:top-2.5 sm:right-2.5 z-10 !w-6 !h-6 min-w-6 min-h-6 max-w-6 max-h-6 shrink-0 flex items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 ${
            tipOpen
              ? "bg-blue-600/30 text-blue-300"
              : "text-gray-500 hover:text-gray-300 hover:bg-gray-700/50"
          }`}
          aria-label="Toggle tip"
        >
          {tipOpen ? <CloseIcon className="w-3.5 h-3.5" /> : <HelpIcon className="w-3.5 h-3.5" />}
        </button>
      )}
      {tip && (
        <div
          className="grid transition-all duration-200 ease-in-out"
          style={{ gridTemplateRows: tipOpen ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div className={`p-3 rounded-lg bg-blue-950/30 border border-blue-800/40 text-sm text-blue-200/90 leading-relaxed transition-opacity duration-200 ${tipOpen ? "opacity-100 mb-3" : "opacity-0"}`}>
              {tip}
            </div>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

interface StatusBannerProps {
  children: ReactNode;
  color?: "blue" | "green" | "yellow" | "red";
  className?: string;
  onClick?: () => void;
}

const bannerColors = {
  blue: "bg-blue-950/40 border-blue-800/50 hover:bg-blue-900/40",
  green: "bg-green-950/40 border-green-800/50 hover:bg-green-900/40",
  yellow: "bg-yellow-950/40 border-yellow-800/50 hover:bg-yellow-900/40",
  red: "bg-red-950/40 border-red-800/50 hover:bg-red-900/40",
};

/**
 * Colored status banner with border accent.
 * Used for "now displaying", loaded preview, alerts, etc.
 */
export function StatusBanner({
  children,
  color = "blue",
  className = "",
  onClick,
}: StatusBannerProps) {
  const colorClasses = bannerColors[color];
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`${onClick ? "w-full text-left cursor-pointer" : ""} border rounded-xl p-4 transition-colors ${colorClasses} ${className}`}
    >
      {children}
    </Tag>
  );
}
