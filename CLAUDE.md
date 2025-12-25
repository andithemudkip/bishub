# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BisHub is a church display application built with Electron + React + TypeScript. It displays content (text, hymns, Bible verses, video) on a projection screen while allowing remote control from another window or device.

## Development Commands

```bash
npm run electron:dev    # Start development (Vite + Electron with HMR)
npm run build           # Full production build
npm run dev             # Vite dev server only (without Electron)
npm run build:preload   # Bundle preload.ts separately (required before electron:dev)
```

## Architecture

### Three-Window System
- **Display Window** (`src/display/`) - Fullscreen on secondary monitor, renders content
- **Remote Window** (`src/remote/`) - Control interface on primary monitor
- **Main Process** (`electron/`) - Electron backend, state management, networking

### Entry Points
- `display.html` → `src/display/main.tsx` - Projection display
- `remote.html` → `src/remote/main.tsx` - Remote control interface
- `electron/main.ts` - Electron main process

### Communication Flow
1. **IPC** (Electron main ↔ Renderer) - via `electron/preload.ts` bridge
2. **Socket.io** (Remote clients ↔ Server) - port 3847, enables external device control

### State Management
Central `StateManager` in `electron/state.ts` uses observer pattern:
- DisplayState: `{ mode, idle, text, video }` where mode is 'idle' | 'text' | 'video'
- Changes broadcast to all connected clients via Socket.io
- Slides are created by splitting text on `\n\n` or `---` markers

### Data Loading
- Hymns: `assets/hymns.json` - parsed and cached in memory
- Bible: `assets/bible.xml` - USFX format, parsed with regex
- Language-specific assets: `assets/{language}/hymns.json`, `assets/{language}/bible.xml`
- Falls back to default paths if language-specific files don't exist

### Internationalization (i18n)
- Translations in `src/shared/i18n.ts` - Romanian (`ro`) and English (`en`)
- Bible parser supports language-specific book names/abbreviations in `src/shared/bibleParser.ts`
- Current data is Romanian only; English data can be added at `assets/en/`

## Key Files

| File | Purpose |
|------|---------|
| `electron/main.ts` | App lifecycle, window creation, IPC handlers |
| `electron/state.ts` | Central state management |
| `electron/server.ts` | Express + Socket.io server |
| `electron/windowManager.ts` | Multi-monitor window management |
| `electron/dataLoader.ts` | Hymn/Bible data parsing |
| `src/shared/types.ts` | Shared TypeScript interfaces |
| `src/shared/i18n.ts` | UI translations (Romanian/English) |
| `src/shared/bibleParser.ts` | Bible reference parsing with language support |

## Path Alias

`@shared/` maps to `src/shared/` - use for shared types between Electron and React.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `→` / `PageDown` | Next slide |
| `←` / `PageUp` | Previous slide |
| `Escape` | Go to idle mode |

## Build Pipeline

1. TypeScript compiles with strict mode
2. esbuild bundles `electron/preload.ts` to CommonJS
3. Vite bundles React apps (separate entry points)
4. electron-builder packages native app (DMG/NSIS)
