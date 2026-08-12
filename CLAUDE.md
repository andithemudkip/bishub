# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

BisHub is a church display app (Electron + React + TypeScript). A fullscreen **display** window projects content (text, hymns, Bible verses, video, images) on a secondary monitor; a **remote** window on the primary monitor (and web remotes on phones/tablets) controls it.

## 🚨 Invariants

These can't be derived from the code. Always apply them.

### Web Remote Parity

Anything in the Electron remote UI must also work from web remotes (mobile/tablet browsers on the same network) whenever it makes sense. The main computer runs Electron; other devices connect via Socket.io on port 3847.

Electron-only is acceptable **only** when the feature inherently can't run remotely — native file pickers, revealing files in Finder/Explorer, direct filesystem/hardware access. In those cases, hide the control with `!library.isElectron`.

For any action that runs in the main process (downloads, adding to libraries, playback, etc.):

1. **Electron path**: `window.electronAPI!.someAction(...)` → IPC handler in `electron/main.ts`
2. **Web path**: `socketRef.current?.emit("someAction", ...)` → handler in `electron/server.ts` calling the same backend function
3. **Progress/state broadcasts**: `windowManager.broadcastToAll(...)` for Electron AND `io.emit(...)` in `server.ts` for web
4. **Type the event**: add to `ClientToServerEvents` / `ServerToClientEvents` in `src/shared/types.ts`

When adding an action, check the sibling hook (`useVideoLibrary`, `useAudioLibrary`, `useImageLibrary`, etc.) — both IPC and Socket.io branches of the `useEffect` and `useCallback`s must be updated together.

### Mirror `TextMode.tsx` ↔ `ScaledSlide`

`LivePreview` renders a scaled-down replica of the display at a virtual 1920×1080, then CSS-scales it. Any change to layout or font sizing in `src/display/modes/TextMode.tsx` must be mirrored in `ScaledSlide` inside `src/remote/components/preview/LivePreview.tsx`, or the preview will drift from the real display.

### Do NOT mutate cached data objects

Hymns (`assets/hymnals/{slug}.json`) and Bible data (`assets/bible.xml`, USFX format) are parsed once and cached in memory. Treat cached objects as immutable — clone before modifying.

### Internationalization

All user-facing text goes through `getTranslations(settings.language)` from `src/shared/i18n.ts`. Never hardcode strings — add keys to both `ro` and `en` in `i18n.ts` first. Bible book names/abbreviations are localized in `src/shared/bibleParser.ts`. Language-specific assets live at `assets/{language}/`; falls back to default paths.

### Mobile responsiveness

The remote UI must work on phones and tablets (320px+). Use Tailwind's `sm:`/`md:`/`lg:`/`xl:` prefixes and flex/grid with proper wrapping.

## UI Design System

Use the shared components — don't hand-roll equivalents:

- **`src/remote/components/ui/`** — `Card`, `StatusBanner`, `Select`, `PositionPicker`, `BibleTranslationPicker`, `renderTip`
- **`src/remote/components/icons/ui.tsx`** — SVG icons (Close, Chevrons, Play/Pause, etc.). Never use ASCII (✕, ←, →, ◀, ▶, ■) for UI.
- **`src/shared/utils.ts`** — check here before writing any utility. Electron imports from `../src/shared/utils`, renderer uses `@shared/utils`.

Styling conventions:

- **Card**: `bg-gray-800/50 border border-gray-700/50 rounded-xl` (use `<Card>` with optional `compact` prop)
- **Buttons**: ghost/outline — `bg-{color}-600/20 text-{color}-400 hover:bg-{color}-600/30 border border-{color}-600/40`. Avoid solid colored backgrounds.
- **Pill groups**: `bg-gray-900/50 border border-gray-700/50 rounded-lg overflow-hidden`
- **Inputs**: `bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`
- **List items**: `bg-gray-900/50 border border-gray-700/30 rounded-lg`; selected adds `border-blue-500/50 bg-blue-950/20`
- **Focus rings**: `focus-visible:ring-2` (not `focus:ring-2`) to avoid rings on mouse clicks

## Architecture

**Three windows:**
- Display (`src/display/`) — fullscreen on secondary monitor
- Remote (`src/remote/`) — control interface on primary monitor
- Main process (`electron/`) — state, networking, IPC

**Entry points:** `display.html` → `src/display/main.tsx`, `remote.html` → `src/remote/main.tsx`, `electron/main.ts`.

**Communication:** IPC (preload bridge in `electron/preload.ts`) for the Electron remote; Socket.io (port 3847) for web remotes.

**State:** `StateManager` in `electron/state.ts` (observer pattern). `DisplayState` = `{ mode, idle, text, video, audio, image }`; mode is `'idle' | 'text' | 'video' | 'image'`. Changes broadcast to all clients.

**Slide splitting:** text splits on `\n\n` or `---`. Hymn slides with 8+ lines auto-split at the midpoint (verses and chorus).

**TTML karaoke:** word-synced lyrics live on `TextState.syncedLyrics` (`ParsedTTML` from `src/shared/ttmlParser.ts`). Toggled by `AppSettings.syncedLyrics`; reuses the existing audio pipeline — no new content type.

**Live Preview** (`src/remote/components/preview/LivePreview.tsx`):
- Text: `ScaledSlide` at virtual 1920×1080, CSS-scaled (see invariant above)
- Video: thumbnail via `/api/videos/thumbnail/:id` with play/pause + progress overlay
- Image: current image or slideshow frame
- Idle: clock + wallpaper indicator, plus `AudioOverlay` when audio is playing

**Bundled binaries** (`bin/{darwin,win32,linux}/`, shipped via `extraResources`):
- `yt-dlp` — YouTube downloads
- `ffmpeg` / `ffprobe` — video/audio processing, thumbnails, duration
- `qjs` (QuickJS-NG) — JS runtime yt-dlp uses for YouTube extraction

**OTA binary updates:** on startup, `checkForBinaryUpdates()` in `electron/ytdlp.ts` silently fetches newer yt-dlp / QuickJS-NG from GitHub releases into `userData/bin/`. `getBinaryPath()` prefers OTA binaries over bundled ones, so yt-dlp stays current without an app release.

## Key files (non-obvious ones)

- `electron/state.ts` — central state, observer pattern
- `electron/server.ts` — Express + Socket.io, all web-remote handlers
- `electron/windowManager.ts` — multi-monitor window management, `broadcastToAll`
- `src/shared/i18n.ts` — translations (always route UI text through this)
- `src/shared/utils.ts` — shared utilities (check before duplicating)
- `src/display/modes/TextMode.tsx` ↔ `src/remote/components/preview/LivePreview.tsx` — must stay in sync

Everything else is discoverable via Grep / Glob.

## Development Commands

```bash
npm run electron:dev    # Vite + Electron with HMR (normal dev loop)
npm run dev             # Vite only (builds preload first)
npm run typecheck       # Type-check all three tsconfigs (main + node + electron)
npm run lint            # ESLint — run before declaring work done; all rules are errors
npm run lint:fix        # Auto-fix what ESLint can
npm run build           # typecheck + bundle renderer — use to verify before declaring work done
npm run electron:build  # Package for current platform locally (no publish)
npm run build:mac       # Package macOS locally
npm run build:win       # Package Windows locally
npm run release         # Build + publish to GitHub (current platform)
npm run release:mac
npm run release:win
npm run build:preload   # Rebundle preload.ts manually
npm run build:ttml      # Rebundle TTML hymns manually
```

No test scripts exist — verify work by running `npm run build`, which chains `typecheck → lint → bundle`. Either step failing aborts the build, so `build` green ≈ code is shippable. For faster iteration during a change, run `npm run typecheck` and `npm run lint` directly.

**Linting** uses flat ESLint config (`eslint.config.js`) with `typescript-eslint` + `react-hooks` + `react-refresh`. All enabled rules are errors — including `any`, `@ts-ignore`, `no-require-imports`, `exhaustive-deps`, and `only-export-components`. The baseline is zero; keep it that way. React-hooks v7 rules (`set-state-in-effect`, `refs`, `purity`, `immutability`, `preserve-manual-memoization`) are disabled — they'd need a wider refactor. Don't reach for `eslint-disable` to unblock yourself; fix the underlying issue.

**Three tsconfigs, check all three.** Default `tsc` only checks `tsconfig.json` (renderer, `src/`). Electron-side code is covered by `tsconfig.node.json` (`electron/` + `src/shared`) and `electron/tsconfig.json` (electron LSP/type-check — vite-plugin-electron does the actual bundle). If only one looks clean, the others may still be broken — run `npm run typecheck`, or target one with `typecheck:main` / `typecheck:node` / `typecheck:electron`.

**TTML bundling**: `build:ttml` compiles `assets/hymns/*.ttml` into `assets/hymns-ttml.json` and runs automatically before every dev/build command. If you add a new `.ttml` file, restart the dev server (or rerun a build) for it to appear.

Path alias: `@shared/` → `src/shared/`.
