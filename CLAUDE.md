# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BisHub is a church display application built with Electron + React + TypeScript. It displays content (text, hymns, Bible verses, video) on a projection screen while allowing remote control from another window or device.

## 🚨 DEFAULT DEVELOPMENT PRACTICES

**Always apply these without being asked:**

### Internationalization (i18n)

- **All user-facing text MUST use i18n** from `src/shared/i18n.ts`
- Never hardcode strings - always add to translations object first
- Support both Romanian (`ro`) and English (`en`) languages
- Use the pattern: `const t = useTranslation(); ... {t('key')}`
- Add new keys to both language objects in i18n.ts

### Mobile Responsiveness

- **All UI components MUST be mobile-responsive by default**
- Use Tailwind's responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`
- Test layouts work on small screens (320px+)
- Remote control interface should be fully functional on phones/tablets
- Use flexbox/grid with proper wrapping for different screen sizes

## Development Commands

### Development

```bash
npm run dev             # Vite dev server only (builds preload first)
npm run electron:dev    # Start development (Vite + Electron with HMR)
npm run preview         # Preview production build
```

### Local Building (no GitHub publishing)

```bash
npm run build           # Build only (no bundling)
npm run electron:build  # Bundle for current platform locally
npm run build:mac       # Bundle for macOS locally
npm run build:win       # Bundle for Windows locally
```

### Release to GitHub

```bash
npm run release         # Build and publish for current platform
npm run release:mac     # Build and publish macOS version
npm run release:win     # Build and publish Windows version
```

### Utilities

```bash
npm run build:preload   # Bundle preload.ts separately (if needed manually)
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
- **Remember**: Always use `useTranslation()` hook for all UI strings

## Common Patterns

```tsx
// i18n usage in React components
import { useTranslation } from "@shared/i18n";

function MyComponent() {
  const t = useTranslation();
  return <button>{t("buttonLabel")}</button>;
}

// Responsive Tailwind classes
<div className="flex flex-col md:flex-row gap-4">
  <button className="w-full md:w-auto px-4 py-2">{t("action")}</button>
</div>;
```

## Key Files

| File                        | Purpose                                                               |
| --------------------------- | --------------------------------------------------------------------- |
| `electron/main.ts`          | App lifecycle, window creation, IPC handlers                          |
| `electron/state.ts`         | Central state management                                              |
| `electron/server.ts`        | Express + Socket.io server                                            |
| `electron/windowManager.ts` | Multi-monitor window management                                       |
| `electron/dataLoader.ts`    | Hymn/Bible data parsing                                               |
| `src/shared/types.ts`       | Shared TypeScript interfaces                                          |
| `src/shared/i18n.ts`        | **UI translations (Romanian/English) - use for ALL user-facing text** |
| `src/shared/bibleParser.ts` | Bible reference parsing with language support                         |

## Tech Stack Details

- **Styling**: Tailwind CSS (configured in `tailwind.config.js`)
- **Build**: Vite for React, esbuild for Electron preload
- **Packaging**: electron-builder
- **Communication**: Socket.io for real-time updates
- **Path Alias**: `@shared/` → `src/shared/`

## Keyboard Shortcuts

| Key              | Action          |
| ---------------- | --------------- |
| `→` / `PageDown` | Next slide      |
| `←` / `PageUp`   | Previous slide  |
| `Escape`         | Go to idle mode |

## Build Pipeline

1. TypeScript compiles with strict mode
2. esbuild bundles `electron/preload.ts` to CommonJS
3. Vite bundles React apps (separate entry points)
4. electron-builder packages native app (DMG/NSIS)
