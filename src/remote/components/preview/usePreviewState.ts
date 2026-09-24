import { useState, useCallback } from "react";

const STORAGE_KEY_WIDTH = "preview-panel-width";
const STORAGE_KEY_COLLAPSED = "preview-collapsed";

const MIN_WIDTH = 200;
const MAX_WIDTH_PERCENT = 0.5;
const DEFAULT_WIDTH = 300;

interface UsePreviewStateOptions {
  isMobile: boolean;
}

interface PreviewState {
  isOpen: boolean;
  panelWidth: number;
  toggle: () => void;
  open: () => void;
  setWidth: (width: number) => void;
  isResizing: boolean;
  startResize: () => void;
  endResize: () => void;
}

export function usePreviewState({
  isMobile,
}: UsePreviewStateOptions): PreviewState {
  // Load initial state from localStorage
  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_WIDTH;
    const stored = localStorage.getItem(STORAGE_KEY_WIDTH);
    return stored ? parseInt(stored, 10) : DEFAULT_WIDTH;
  });

  // Open vs. collapsed is the operator's choice and sticks — including across
  // idle. The panel used to open only while presenting and forget a collapse
  // on every idle, but it now shows loaded layers, activity and schedules,
  // which are worth seeing with nothing on screen.
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_COLLAPSED) === "true";
    } catch {
      return false;
    }
  });

  const [isResizing, setIsResizing] = useState(false);

  const persistCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
    try {
      localStorage.setItem(STORAGE_KEY_COLLAPSED, String(collapsed));
    } catch {
      // Private mode / blocked storage: the choice just won't persist.
    }
  }, []);

  const toggle = useCallback(() => {
    persistCollapsed(!isCollapsed);
  }, [isCollapsed, persistCollapsed]);

  const open = useCallback(() => persistCollapsed(false), [persistCollapsed]);

  const setWidth = useCallback((width: number) => {
    const maxWidth = window.innerWidth * MAX_WIDTH_PERCENT;
    const clampedWidth = Math.min(Math.max(width, MIN_WIDTH), maxWidth);
    setPanelWidth(clampedWidth);
    localStorage.setItem(STORAGE_KEY_WIDTH, String(clampedWidth));
  }, []);

  const startResize = useCallback(() => setIsResizing(true), []);
  const endResize = useCallback(() => setIsResizing(false), []);

  return {
    isOpen: !isCollapsed,
    panelWidth: isMobile ? 0 : panelWidth,
    toggle,
    open,
    setWidth,
    isResizing,
    startResize,
    endResize,
  };
}

export { MIN_WIDTH, MAX_WIDTH_PERCENT, DEFAULT_WIDTH };
