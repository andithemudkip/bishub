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
- Use the pattern: `const t = getTranslations(settings.language); ... {t.key}`
- Add new keys to both language objects in i18n.ts

### Mobile Responsiveness

- **All UI components MUST be mobile-responsive by default**
- Use Tailwind's responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`
- Test layouts work on small screens (320px+)
- Remote control interface should be fully functional on phones/tablets
- Use flexbox/grid with proper wrapping for different screen sizes

### Shared Utilities

- **Use `src/shared/utils.ts`** for common functions — don't duplicate utility logic
- Available utilities: `getFileUrl`, `formatDuration`, `formatFileSize`, `formatDate`, `removeDiacritics`, `normalizeForSearch`, `findOptimalFontSize`, `getSecurityKeyFromURL`, `updateProgressList`, `formatTimeAgo`
- Electron code imports from `../src/shared/utils`, renderer code uses `@shared/utils`

### UI Design System

- **Use shared UI components** from `src/remote/components/ui/Card.tsx` and `src/remote/components/icons/ui.tsx`
- **`<Card>`** — standard section container with `compact` prop for tighter padding. Uses `bg-gray-800/50 border border-gray-700/50 rounded-xl`
- **`<StatusBanner>`** — colored accent banner with `color` prop (blue/green/yellow/red) and optional `onClick`. Uses `rounded-xl` with translucent backgrounds
- **Icons**: Use `CloseIcon`, `ChevronLeftIcon`, `ChevronRightIcon`, `StopIcon`, `CollapseRightIcon`, `ExpandLeftIcon` from `icons/ui.tsx` — never use ASCII characters (✕, ←, →, ◀, ▶, ■) for UI elements
- **Buttons**: Use ghost/outline style for actions — `bg-{color}-600/20 text-{color}-400 hover:bg-{color}-600/30 border border-{color}-600/40`. Avoid solid colored backgrounds
- **Pill groups**: Related buttons grouped in `bg-gray-900/50 border border-gray-700/50 rounded-lg overflow-hidden` containers
- **Inputs**: Use `bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`
- **List items**: Use `bg-gray-900/50 border border-gray-700/30 rounded-lg` with `border-blue-500/50 bg-blue-950/20` for selected state
- **Focus rings**: Use `focus-visible:ring-2` (not `focus:ring-2`) for interactive elements to avoid showing rings on mouse clicks

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

- DisplayState: `{ mode, idle, text, video, audio }` where mode is 'idle' | 'text' | 'video'
- Changes broadcast to all connected clients via Socket.io
- Slides are created by splitting text on `\n\n` or `---` markers
- Hymn slides with 8+ lines are automatically split at the midpoint (both verses and chorus)

### Data Loading

- Hymns: `assets/hymns.json` - parsed and cached in memory (do NOT mutate cached objects)
- Bible: `assets/bible.xml` - USFX format, parsed with regex
- Language-specific assets: `assets/{language}/hymns.json`, `assets/{language}/bible.xml`
- Falls back to default paths if language-specific files don't exist

### Internationalization (i18n)

- Translations in `src/shared/i18n.ts` - Romanian (`ro`) and English (`en`)
- Bible parser supports language-specific book names/abbreviations in `src/shared/bibleParser.ts`
- Current data is Romanian only; English data can be added at `assets/en/`
- **Remember**: Always use `getTranslations(language)` for all UI strings

### Bundled Binaries

Third-party binaries are stored in `bin/{darwin,win32,linux}/` and bundled via `extraResources` in electron-builder:

- **yt-dlp** - YouTube video downloading
- **ffmpeg/ffprobe** - Video/audio processing, thumbnail generation, duration extraction
- **qjs** (QuickJS-NG) - Lightweight JS runtime used by yt-dlp for YouTube extraction

**OTA Updates**: On every app startup, `checkForBinaryUpdates()` silently checks GitHub releases for newer versions of yt-dlp and QuickJS-NG, downloading them to `userData/bin/`. The `getBinaryPath()` function prefers OTA-updated binaries over bundled ones. This means yt-dlp stays current with YouTube API changes without requiring a new app release.

### Live Preview

The `LivePreview` component (`src/remote/components/preview/LivePreview.tsx`) renders a scaled-down replica of the actual display:

- **Text mode**: Uses `ScaledSlide` — renders at a virtual 1920×1080 resolution with the exact same structure/styling as `TextMode.tsx`, then CSS-scales it down. This ensures the preview is pixel-perfect.
- **Video mode**: Shows the video thumbnail via `/api/videos/thumbnail/:id` (requires `videoId` in `VideoState`), with play/pause indicator and progress bar.
- **Idle mode**: Shows clock and wallpaper indicator, plus an `AudioOverlay` when audio is playing.

When modifying `TextMode.tsx` layout or font sizing, the same changes must be mirrored in `ScaledSlide` within `LivePreview.tsx`.

## Common Patterns

```tsx
// i18n usage in React components
import { getTranslations } from "@shared/i18n";

function MyComponent({ settings }) {
  const t = getTranslations(settings.language);
  return <button>{t.buttonLabel}</button>;
}

// Shared utilities
import { formatDuration, getFileUrl, normalizeForSearch } from "@shared/utils";

// UI components
import { Card, StatusBanner } from "../components/ui/Card";
import { CloseIcon, ChevronRightIcon } from "../components/icons/ui";

// Section container
<Card>
  <h2 className="text-lg font-semibold mb-4">{t.section.title}</h2>
  {/* content */}
</Card>

// Ghost button (primary action)
<button className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40">
  {t.action}
</button>

// Destructive ghost button
<button className="px-3 py-1.5 rounded-lg text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/40">
  {t.delete}
</button>

// Pill button group
<div className="flex items-center bg-gray-900/50 border border-gray-700/50 rounded-lg overflow-hidden">
  <button className="px-3 py-2 hover:bg-gray-700 transition-colors">Left</button>
  <button className="px-3 py-2 hover:bg-gray-700 transition-colors text-blue-400">Right</button>
</div>

// Progress tracking in hooks (for upload/download progress lists)
import { updateProgressList } from "@shared/utils";
setUploads((prev) => updateProgressList(prev, progress, setUploads));
```

## Key Files

| File                        | Purpose                                                               |
| --------------------------- | --------------------------------------------------------------------- |
| `electron/main.ts`          | App lifecycle, window creation, IPC handlers                          |
| `electron/state.ts`         | Central state management                                              |
| `electron/server.ts`        | Express + Socket.io server                                            |
| `electron/windowManager.ts` | Multi-monitor window management                                       |
| `electron/dataLoader.ts`    | Hymn/Bible data parsing and formatting                                |
| `electron/ytdlp.ts`         | YouTube downloading, bundled binary management, OTA updates           |
| `electron/utils.ts`         | ffmpeg/ffprobe path resolution, `extractDurationWithFfprobe`          |
| `src/shared/types.ts`       | Shared TypeScript interfaces                                          |
| `src/shared/i18n.ts`        | **UI translations (Romanian/English) - use for ALL user-facing text** |
| `src/shared/utils.ts`       | **Shared utility functions - use instead of duplicating logic**       |
| `src/shared/bibleParser.ts` | Bible reference parsing with language support                         |
| `src/display/modes/TextMode.tsx` | Display text rendering with auto font sizing                     |
| `src/remote/components/preview/LivePreview.tsx` | Scaled preview replica of the display       |
| `src/remote/components/MediaUploader.tsx` | Unified upload component (video + audio)            |
| `src/remote/components/ui/Card.tsx` | **Shared Card and StatusBanner components**                |
| `src/remote/components/icons/ui.tsx` | **Shared SVG icon components (Close, Chevrons, Stop, etc)** |
| `src/remote/components/bible/*` | Bible page sub-components (SmartSearchBar, BrowseTab, SearchResultsTab, VerseListView) |

## Tech Stack Details

- **Styling**: Tailwind CSS (configured in `tailwind.config.js`)
- **Build**: Vite for React, esbuild for Electron preload
- **Packaging**: electron-builder
- **Communication**: Socket.io for real-time updates
- **Path Alias**: `@shared/` → `src/shared/`

## Keyboard Shortcuts

| Key              | Action                                              |
| ---------------- | --------------------------------------------------- |
| `→` / `PageDown` | Next slide                                          |
| `←` / `PageUp`   | Previous slide                                      |
| `Escape`         | Go to idle mode (or back from Bible verse list view) |
| `Enter`          | Bible: load reference / present highlighted verse    |
| `F5`             | Focus search input                                   |

## Build Pipeline

1. TypeScript compiles with strict mode
2. esbuild bundles `electron/preload.ts` to CommonJS
3. Vite bundles React apps (separate entry points)
4. electron-builder packages native app (DMG/NSIS)
