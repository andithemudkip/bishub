import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  /** Compact padding (p-3 sm:p-4) vs default (p-4 sm:p-6) */
  compact?: boolean;
  className?: string;
}

/**
 * Standard section container used throughout the app.
 * Subtle border with slightly elevated background.
 */
export function Card({ children, compact, className = "" }: CardProps) {
  return (
    <div
      className={`bg-gray-800/50 border border-gray-700/50 rounded-xl ${compact ? "p-3 sm:p-4" : "p-4 sm:p-6"} ${className}`}
    >
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
