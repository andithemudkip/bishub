import {
  app,
  BrowserWindow,
  Menu,
  webContents,
  type MenuItemConstructorOptions,
} from "electron";
import { getTranslations, type Language } from "../src/shared/i18n";

const ZOOM_STEP = 0.5;
const MIN_ZOOM_LEVEL = -5;
const MAX_ZOOM_LEVEL = 5;

const isMac = process.platform === "darwin";

/**
 * Electron's built-in `zoomin`/`zoomout` roles resolve their target through
 * `webContents.getFocusedWebContents()`, which is null while a native menu is
 * open on Windows — so clicking "Zoom In" in the menu bar silently does
 * nothing. Menu click handlers receive the owning window directly, so prefer
 * that and only fall back to the focused contents (keyboard accelerators).
 */
function zoomBy(window: BrowserWindow | undefined, delta: number) {
  const contents = window?.webContents ?? webContents.getFocusedWebContents();
  if (!contents) return;
  const next = contents.getZoomLevel() + delta;
  contents.setZoomLevel(Math.min(MAX_ZOOM_LEVEL, Math.max(MIN_ZOOM_LEVEL, next)));
}

function resetZoom(window: BrowserWindow | undefined) {
  const contents = window?.webContents ?? webContents.getFocusedWebContents();
  if (!contents) return;
  contents.setZoomLevel(0);
}

export function buildAppMenu(language: Language) {
  const t = getTranslations(language).menu;

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([{ role: "appMenu" }] as MenuItemConstructorOptions[])
      : []),
    {
      label: t.file,
      submenu: [{ role: isMac ? "close" : "quit", label: isMac ? t.close : t.quit }],
    },
    {
      label: t.edit,
      submenu: [
        { role: "undo", label: t.undo },
        { role: "redo", label: t.redo },
        { type: "separator" },
        { role: "cut", label: t.cut },
        { role: "copy", label: t.copy },
        { role: "paste", label: t.paste },
        { role: "selectAll", label: t.selectAll },
      ],
    },
    {
      label: t.view,
      submenu: [
        { role: "reload", label: t.reload },
        { role: "toggleDevTools", label: t.toggleDevTools },
        { type: "separator" },
        {
          label: t.actualSize,
          accelerator: "CommandOrControl+0",
          click: (_item, window) => resetZoom(window),
        },
        {
          label: t.zoomIn,
          accelerator: "CommandOrControl+Plus",
          click: (_item, window) => zoomBy(window, ZOOM_STEP),
        },
        {
          label: t.zoomOut,
          accelerator: "CommandOrControl+-",
          click: (_item, window) => zoomBy(window, -ZOOM_STEP),
        },
        { type: "separator" },
        { role: "togglefullscreen", label: t.toggleFullscreen },
      ],
    },
    {
      label: t.window,
      submenu: [
        { role: "minimize", label: t.minimize },
        ...(isMac
          ? ([{ role: "front" }] as MenuItemConstructorOptions[])
          : ([{ role: "close", label: t.close }] as MenuItemConstructorOptions[])),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/**
 * `CommandOrControl+Plus` only matches Ctrl+Shift+= on Windows/Linux layouts,
 * so plain Ctrl+= (the key people actually press, and what the menu advertises
 * as "Ctrl +") never fires. Fill in the variants the accelerator table misses.
 * Deliberately skips combos already registered above so zoom never double-steps,
 * and skips macOS, where the native key equivalents already work.
 */
export function installZoomKeyShim() {
  if (isMac) return;

  app.on("web-contents-created", (_event, contents) => {
    contents.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown" || !input.control || input.alt || input.meta) {
        return;
      }

      const window = BrowserWindow.fromWebContents(contents) ?? undefined;

      // Ctrl+= (unshifted) and Ctrl+NumpadAdd — "Plus" binds VKEY_OEM_PLUS+Shift
      // and "0"/"-" are already bound, so none of these overlap.
      if ((input.key === "=" && !input.shift) || input.code === "NumpadAdd") {
        zoomBy(window, ZOOM_STEP);
        event.preventDefault();
      } else if (input.code === "NumpadSubtract") {
        zoomBy(window, -ZOOM_STEP);
        event.preventDefault();
      } else if (input.code === "Numpad0") {
        resetZoom(window);
        event.preventDefault();
      }
    });
  });
}
