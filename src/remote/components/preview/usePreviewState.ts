import { useState, useEffect, useCallback } from "react";
import type { DisplayMode } from "../../../shared/types";

const STORAGE_KEY_WIDTH = "preview-panel-width";
const STORAGE_KEY_COLLAPSED = "preview-collapsed";

const MIN_WIDTH = 200;
const MAX_WIDTH_PERCENT = 0.5;
const DEFAULT_WIDTH = 300;

interface UsePreviewStateOptions {
  mode: DisplayMode;
  isMobile: boolean;
}

interface PreviewState {
  isOpen: boolean;
  panelWidth: number;
  toggle: () => void;
  setWidth: (width: number) => void;
  isResizing: boolean;
  startResize: () => void;
  endResize: () => void;
}

export function usePreviewState({
  mode,
  isMobile,
}: UsePreviewStateOptions): PreviewState {
  // Load initial state from localStorage
  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_WIDTH;
    const stored = localStorage.getItem(STORAGE_KEY_WIDTH);
    return stored ? parseInt(stored, 10) : DEFAULT_WIDTH;
  });

  const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY_COLLAPSED) === "true";
  });

  const [isResizing, setIsResizing] = useState(false);

  // Auto-open when mode changes to non-idle, auto-close when idle
  const isDisplaying = mode !== "idle";

  // Preview is open if:
  // 1. We are displaying something (not idle)
  // 2. AND user hasn't manually collapsed it
  const isOpen = isDisplaying && !isManuallyCollapsed;

  // Reset manual collapse when going to idle
  useEffect(() => {
    if (!isDisplaying) {
      setIsManuallyCollapsed(false);
    }
  }, [isDisplaying]);

  const toggle = useCallback(() => {
    setIsManuallyCollapsed((prev) => {
      const newValue = !prev;
      localStorage.setItem(STORAGE_KEY_COLLAPSED, String(newValue));
      return newValue;
    });
  }, []);

  const setWidth = useCallback((width: number) => {
    const maxWidth = window.innerWidth * MAX_WIDTH_PERCENT;
    const clampedWidth = Math.min(Math.max(width, MIN_WIDTH), maxWidth);
    setPanelWidth(clampedWidth);
    localStorage.setItem(STORAGE_KEY_WIDTH, String(clampedWidth));
  }, []);

  const startResize = useCallback(() => setIsResizing(true), []);
  const endResize = useCallback(() => setIsResizing(false), []);

  return {
    isOpen,
    panelWidth: isMobile ? 0 : panelWidth,
    toggle,
    setWidth,
    isResizing,
    startResize,
    endResize,
  };
}

export { MIN_WIDTH, MAX_WIDTH_PERCENT, DEFAULT_WIDTH };
