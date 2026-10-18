import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY_WIDTH = "preview-panel-width";
const STORAGE_KEY_COLLAPSED = "preview-collapsed";

const MIN_WIDTH = 200;
const MAX_WIDTH_PERCENT = 0.5;
const DEFAULT_WIDTH = 300;

interface UsePreviewStateOptions {
  isMobile: boolean;
  /**
   * Fold the panel away for now without touching the saved choice — Settings
   * needs the width. Opening it anyway lasts until `autoCollapse` turns off.
   */
  autoCollapse?: boolean;
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
  autoCollapse = false,
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

  // Opened by hand while auto-collapsed: shown, but not saved as the choice.
  const [openedAnyway, setOpenedAnyway] = useState(false);
  useEffect(() => {
    setOpenedAnyway(false);
  }, [autoCollapse]);

  const isOpen = !isCollapsed && (!autoCollapse || openedAnyway);

  const persistCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
    try {
      localStorage.setItem(STORAGE_KEY_COLLAPSED, String(collapsed));
    } catch {
      // Private mode / blocked storage: the choice just won't persist.
    }
  }, []);

  const open = useCallback(() => {
    if (autoCollapse) setOpenedAnyway(true);
    persistCollapsed(false);
  }, [autoCollapse, persistCollapsed]);

  const toggle = useCallback(() => {
    if (!isOpen) open();
    // Closing what was only opened for this visit leaves the saved choice alone.
    else if (autoCollapse) setOpenedAnyway(false);
    else persistCollapsed(true);
  }, [isOpen, open, autoCollapse, persistCollapsed]);

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
    open,
    setWidth,
    isResizing,
    startResize,
    endResize,
  };
}

export { MIN_WIDTH, MAX_WIDTH_PERCENT, DEFAULT_WIDTH };
