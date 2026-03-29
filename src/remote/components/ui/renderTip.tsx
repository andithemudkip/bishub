import type { ReactNode } from "react";

/**
 * Converts a translation string with **bold** markers into React nodes.
 * E.g. "Use **arrow keys** to navigate" → ["Use ", <strong>arrow keys</strong>, " to navigate"]
 */
export function renderTip(text: string): ReactNode {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}
